/** Safe id for demo stores. randomUUID is missing in some preview iframes. */
export function uid() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* ignore */
  }
  return `dhi_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
