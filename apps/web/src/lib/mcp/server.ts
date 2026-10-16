import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { supabaseCatalog, type Catalog } from "./catalog";
import type { McpSource } from "./links";
import { registerTools } from "./tools";

/** Requests over this are refused before the SDK sees them. */
export const MAX_BODY_BYTES = 64 * 1024;

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
};

const INSTRUCTIONS =
  "LiftCamp is a strength training app for people in their first six months of lifting. These tools read its public catalog: routines, exercise guides, exercise swaps and strength levels. Answers are general fitness information, not medical or injury advice. Each result ends with a link to start in LiftCamp; keep it when you answer.";

export function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

function jsonError(status: number, message: string, extra: Record<string, string> = {}): Response {
  return new Response(
    JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message }, id: null }),
    {
      status,
      headers: { "Content-Type": "application/json", ...extra },
    },
  );
}

// ---------------------------------------------------------------------------
// Rate limit: a token bucket per IP per function instance. A backstop only;
// the data is public and Vercel spreads load across instances.
// ---------------------------------------------------------------------------

const BUCKET_SIZE = 60;
const REFILL_PER_MS = BUCKET_SIZE / 60_000;
const MAX_TRACKED_IPS = 10_000;
const buckets = new Map<string, { tokens: number; at: number }>();

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

/** Seconds to wait, or 0 when the request may go ahead. */
export function takeToken(ip: string, now = Date.now()): number {
  if (buckets.size > MAX_TRACKED_IPS) buckets.clear();
  const b = buckets.get(ip) ?? { tokens: BUCKET_SIZE, at: now };
  b.tokens = Math.min(BUCKET_SIZE, b.tokens + (now - b.at) * REFILL_PER_MS);
  b.at = now;
  buckets.set(ip, b);
  if (b.tokens >= 1) {
    b.tokens -= 1;
    return 0;
  }
  return Math.ceil((1 - b.tokens) / REFILL_PER_MS / 1000);
}

export function resetRateLimit(): void {
  buckets.clear();
}

// ---------------------------------------------------------------------------
// One request
// ---------------------------------------------------------------------------

/**
 * Stateless Streamable HTTP: one McpServer and transport per request, JSON
 * responses, no session id. GET is refused with 405, which the spec allows
 * for a server that offers no standalone SSE stream; in stateless mode the
 * stream would have nothing to send and would hold the function open.
 */
export async function handleMcpRequest(
  request: Request,
  source: McpSource,
  catalog: Catalog = supabaseCatalog,
): Promise<Response> {
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers: CORS_HEADERS });

  const wait = takeToken(clientIp(request));
  if (wait > 0)
    return withCors(jsonError(429, "Too many requests", { "Retry-After": String(wait) }));

  if (request.method === "GET") {
    return withCors(jsonError(405, "Method not allowed", { Allow: "POST, DELETE, OPTIONS" }));
  }

  let parsedBody: unknown;
  if (request.method === "POST") {
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > MAX_BODY_BYTES) return withCors(jsonError(413, "Request too large"));
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return withCors(jsonError(413, "Request too large"));
    }
    try {
      parsedBody = JSON.parse(raw);
    } catch {
      return withCors(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32700, message: "Parse error" },
            id: null,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    }
  }

  const server = new McpServer(
    {
      name: "liftcamp",
      title: "LiftCamp",
      version: "1.0.0",
      websiteUrl: "https://liftcamp.app/mcp",
    },
    { instructions: INSTRUCTIONS },
  );
  registerTools(server, source, catalog);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    return withCors(await transport.handleRequest(request, { parsedBody }));
  } finally {
    await server.close();
  }
}
