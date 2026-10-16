import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { isMcpSource } from "@/lib/mcp/links";
import { handleMcpRequest } from "@/lib/mcp/server";

// Remote MCP server over the public catalog, one URL per directory listing it
// (/mcp/chatgpt, /mcp/claude) so links say where a visit came from. No auth,
// no user data, read-only. The tools live in src/lib/mcp/.
async function handle({ request, params }: { request: Request; params: { source: string } }) {
  if (!isMcpSource(params.source)) return new Response("Not found", { status: 404 });
  return handleMcpRequest(request, params.source);
}

export const Route = createFileRoute("/mcp_/$source")({
  server: {
    handlers: {
      GET: handle,
      POST: handle,
      DELETE: handle,
      OPTIONS: handle,
    },
  },
});
