import { resolve } from "node:path";
import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
// @ts-expect-error JS plugin alongside the TS vite config
import { grokPwaPlugin } from "./scripts/grok-pwa-plugin.mjs";
// @ts-expect-error JS plugin alongside the TS vite config
import { appEnvPlugin } from "./scripts/app-env-plugin.mjs";
import { authProxy } from "./scripts/auth-proxy.mjs";
import { authProxyPreviewPlugin } from "./scripts/auth-proxy-preview.mjs";
import { funnelApiProxy, funnelLocalPlugin } from "./scripts/funnel-local.mjs";

// `0.0.0.0:8080` is the live-preview contract — don't change host/port.
// The dev server starts once `src/router.tsx` and `src/routes/` exist — see
// AGENTS.md § "First scaffold".
export default defineConfig(({ command, isPreview, mode }) => {
  // /api/auth goes to the shared Convex deployment (spec 0007). The dev server reads the one shared proxy object as `server.proxy`;
  // the built Worker served by `vite preview` gets the same object through authProxyPreviewPlugin below.
  const convexSiteUrl = loadEnv(mode, process.cwd(), "").CONVEX_SITE_URL;
  // The dev server also serves the funnel's built interview and forwards its other /api routes (scripts/funnel-local.mjs), so both parts share
  // one address and one sign in cookie, as they will on dhirise.com (spec 0004, spec 0008).
  const proxy = { ...authProxy(convexSiteUrl), ...funnelApiProxy(convexSiteUrl) };
  return {
    // `PUBLIC_CONVEX_URL` is the only non VITE_ value the page reads (spec 0007).
    envPrefix: ["VITE_", "PUBLIC_"],
    server: {
      host: "0.0.0.0",
      port: 8080,
      strictPort: true,
      proxy,
    },
    preview: {
      host: "127.0.0.1",
      port: 8081,
      strictPort: true,
    },
    resolve: { tsconfigPaths: true },
    plugins: [
      // Preview only, and before the Cloudflare plugin answers: `preview.proxy` is never reached once the Worker handles requests.
      authProxyPreviewPlugin(convexSiteUrl),
      // Dev-only /__app-env: the client env the running server resolved, for the preview tooling.
      appEnvPlugin(),
      // Dev only: the funnel's built files at /dhiinterviews on this same address.
      funnelLocalPlugin({ distDir: resolve(process.cwd(), "apps/joining/dist") }),
      // PWA head + ?install=1 tutorial page; runs before Start.
      grokPwaPlugin(),
      tailwindcss(),
      tanstackStart(),
      // The build is a Cloudflare Worker (spec 0007, AC-12). The dev server keeps running the app in Node, as it always did.
      ...(command === "build" || isPreview
        ? [cloudflare({ viteEnvironment: { name: "ssr" } })]
        : []),
      viteReact(),
    ],
  };
});
