// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { createRequire } from "node:module";
import path from "node:path";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

// Resolve entities through Node rather than process.cwd(). Under pnpm workspaces
// the package is hoisted to the repo root, not apps/web/node_modules.
const require = createRequire(import.meta.url);
const entitiesLib = path.dirname(require.resolve("entities/lib/decode.js"));
const entitiesRoot = path.dirname(entitiesLib);

// Load non-VITE_ env vars (e.g. SUPABASE_SERVICE_ROLE_KEY) into process.env for
// server routes only. These are NOT injected into the client bundle.
const serverEnv = loadEnv(process.env.NODE_ENV || "development", process.cwd(), "");
Object.assign(process.env, serverEnv);

// Origin for og:image and twitter:image (src/lib/metadata-base.ts). Vercel
// exposes its system variables at build time, so this is fixed per deploy.
function metadataBase(): string {
  if (process.env.VERCEL_ENV === "production") return "https://liftcamp.app";
  const host = process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL;
  return host ? `https://${host}` : "http://localhost:3000";
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    define: {
      __LC_METADATA_BASE__: JSON.stringify(metadataBase()),
    },
    resolve: {
      alias: {
        "entities/lib/decode.js": path.join(entitiesLib, "decode.js"),
        "entities/lib/encode.js": path.join(entitiesLib, "encode.js"),
        entities: entitiesRoot,
      },
    },
  },
});
