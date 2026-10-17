# Connector tools (`src/lib/app-data`)

## Overview

A client for the platform connectors (Google Drive, Google Calendar, Gmail, Outlook and others), pre wired by the app template. A server function calls a connector tool through `callTool`, and the gate answers with the signed in person's access. No DHI room uses it yet. It is separate from sign in (`src/lib/auth`) and from the demo data (`src/lib/dhi`).

## Key files

| File | Owns |
|---|---|
| `client.server.ts` | `callTool`, token lookup from the request, the connector host choice (staging, production, or `GROK_CONNECTORS_URL`). Server only |
| `server-only.ts` | `assertAppDataServerOnly`, which throws if the module reaches the browser |
| `types.ts` | `ConnectorType`, tool name maps (`GoogleDriveTools`, `GoogleCalendarTools`), `CONNECTOR_TOKEN_HEADER`, result types. Safe for the client |
| `login.ts` | `isLoginRequired`, `isConnectorPending`, `redirectToLoginIfRequired`. Safe for the client |
| `errors.ts` | `classifyCallToolError`, turns a failed result into a kind and a plain message |
| `readiness.ts` | `getConnectorReadiness` server function, answers whether a usable token is on the request |
| `readiness-schedule.ts`, `use-connector-readiness.ts` | Probe delays and the `useRefetchWhenConnectorReady` hook for the preview panel |
| `index.ts` | The client safe surface (types, login helpers, errors, the hook). Does not export `callTool` |

## Conventions

- Call connector tools only from a `createServerFn` handler, with a dynamic `import("@/lib/app-data/client.server")`. Components import from `@/lib/app-data`, never from `client.server`.
- Check results with `isLoginRequired` and `isConnectorPending` before reading data, and show `classifyCallToolError` messages instead of raw errors.
- Tests sit beside the module (`app-data.test.ts`, `readiness-schedule.test.ts`) and run in `npm test`. Keep new pure logic in a small module so it can be tested the same way.

## Gotchas

- `GROK_CONNECTOR_ACCESS_TOKEN` is read only outside production. Deployed builds take the token from the `x-connector-access-token` request header.
- The server remembers the last token the gate rejected and reports "not ready" until a fresh one arrives. Do not retry a call with a token that was just refused.
- With a local host and no `GROK_CONNECTORS_URL`, no connector host is found and calls cannot run.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
