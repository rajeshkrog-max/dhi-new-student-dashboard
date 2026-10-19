import type { ReactNode } from "react";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { GateProvider } from "@/lib/dhi/gate";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { NotFoundPage } from "@/components/dhi/ui/status-page";
import appCss from "../styles.css?url";

const APP_NAME = "DHI";

// The document (html, head, body) is the shell, and the app is the component inside it. If the app fails at the very top (say inside
// GateProvider) the error page still shows inside this shell, so it keeps its stylesheet (spec house/0003, AC-7).
function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <>
      <PreviewHostBridge />
      <GateProvider>
        <Outlet />
      </GateProvider>
    </>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      { name: "theme-color", content: "#f4f0ea" }, // look-ok: a meta tag cannot read a CSS variable; this is --color-page
      {
        name: "description",
        content: "DHI — invite-only campus house. Same student. Brighter dreams.",
      },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  shellComponent: RootDocument,
  component: RootComponent,
  notFoundComponent: NotFoundPage,
});
