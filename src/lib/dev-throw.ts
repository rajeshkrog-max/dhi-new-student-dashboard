// Dev only: lets `pnpm responsive:sweep` reach the error page and the "This room paused" card on purpose (spec house/0003, AC-13).
// `?__throw=1` on /dashboard throws in the page, `?__throw=room` throws inside a room. In a production build `import.meta.env.DEV` is false,
// so the body is removed and the address does nothing.
export function devThrow(kind: "1" | "room"): void {
  if (!import.meta.env.DEV || typeof window === "undefined") return;
  if (new URLSearchParams(window.location.search).get("__throw") !== kind) return;
  throw new Error(`__throw=${kind}: thrown on purpose by the dev only look sweep`);
}

// Rendered inside a room's error boundary so `?__throw=room` has something to break.
export function DevRoomThrow() {
  devThrow("room");
  return null;
}
