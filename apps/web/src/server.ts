import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

/** Public marketing HTML: cached at the edge for 5 minutes, then served stale
 *  for up to a day while it revalidates. The homepage reads the App Store
 *  rating, cached 24 hours on the server, so 5 minutes is well inside that.
 *  /admin, /login, server functions and the MCP endpoints stay uncached. */
const MARKETING_CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=86400";

function isMarketingPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/about" ||
    pathname === "/mcp" ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    /^\/(guides|routines|exercises)(\/|$)/.test(pathname)
  );
}

function withMarketingCache(request: Request, response: Response): Response {
  if (request.method !== "GET" && request.method !== "HEAD") return response;
  if (response.status !== 200) return response;
  if (!isMarketingPath(new URL(request.url).pathname)) return response;
  if (!(response.headers.get("content-type") ?? "").includes("text/html")) return response;
  const headers = new Headers(response.headers);
  headers.set("cache-control", MARKETING_CACHE_CONTROL);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** 301 a page path with an uppercase letter to its lowercase form, so
 *  /Exercises/Barbell-Squat does not serve a duplicate of the real page.
 *  Skips /admin, server functions and API paths, invite codes (/i/<code>,
 *  matched exactly), and anything with a file extension. */
function lowercaseRedirect(request: Request): Response | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === path.toLowerCase()) return null;
  if (/^\/(admin|api|_serverFn|_server|i)(\/|$)/i.test(path)) return null;
  if (/\.[a-z0-9]+$/i.test(path)) return null;
  url.pathname = path.toLowerCase();
  return new Response(null, { status: 301, headers: { location: url.toString() } });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const redirect = lowercaseRedirect(request);
      if (redirect) return redirect;
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return withMarketingCache(request, await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
