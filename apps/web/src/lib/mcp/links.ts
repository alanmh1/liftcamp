import { appStoreUrl } from "@liftcamp/shared";

/** The two directories that list the server. One URL each, so page views and
 *  App Store installs say which assistant sent them. */
export const MCP_SOURCES = ["chatgpt", "claude"] as const;
export type McpSource = (typeof MCP_SOURCES)[number];

export function isMcpSource(v: string | null | undefined): v is McpSource {
  return (MCP_SOURCES as readonly string[]).includes(v ?? "");
}

const BASE_URL = "https://liftcamp.app";

/** A site page tagged for the page view log. `pageviews.ts` records
 *  utm_source; utm_medium is carried for anyone reading the URL. */
export function siteLink(path: string, source: McpSource): string {
  const url = new URL(path, BASE_URL);
  url.searchParams.set("utm_source", source);
  url.searchParams.set("utm_medium", "mcp");
  return url.toString();
}

/** The App Store page, tagged mcp_chatgpt or mcp_claude in App Store Connect. */
export function storeLink(source: McpSource): string {
  return appStoreUrl(`mcp_${source}`);
}

/** The closing line of every tool result. */
export function startLine(path: string, source: McpSource): string {
  return `Start this in LiftCamp: [liftcamp.app${path}](${siteLink(path, source)}) · [iPhone app](${storeLink(source)})`;
}
