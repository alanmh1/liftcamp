import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { getSeoCatalog } from "@/lib/public-catalog.functions";
import { llmsTxt } from "@/lib/llms";
import { guideMetas } from "@/content/guides";

// Generated from the sitemap's feed, so a new routine, beginner block or
// guide shows up here without an edit. Prose and notes: src/lib/llms.ts and
// src/lib/llms-notes.ts.
export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: async () => {
        const body = llmsTxt(await getSeoCatalog(), guideMetas());
        return new Response(body, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
