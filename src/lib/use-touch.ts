import { useEffect, useState } from "react";

// True while the media query matches. False until mounted, so the server and the first client
// render agree. Use it only where different elements (not just classes) are needed.
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const list = window.matchMedia(query);
    const sync = () => setMatches(list.matches);
    sync();
    list.addEventListener("change", sync);
    return () => list.removeEventListener("change", sync);
  }, [query]);
  return matches;
}

// Mirrors the `touch` Tailwind variant: a small screen or a coarse pointer.
export function useTouch() {
  return useMediaQuery("(pointer: coarse), (max-width: 1023.98px)");
}
