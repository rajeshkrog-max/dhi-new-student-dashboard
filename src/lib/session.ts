const KEY = "dhi-session-v1";

export type DhiSession = {
  email: string;
  name: string;
  enteredAt: string;
};

const DEMO: DhiSession = {
  email: "suzzy@dhi.house",
  name: "Suzzy Glass",
  enteredAt: "",
};

let memory: DhiSession | null = null;

function readCookie(): DhiSession | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${KEY}=([^;]*)`));
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1])) as DhiSession;
  } catch {
    return null;
  }
}

function writeCookie(session: DhiSession) {
  if (typeof document === "undefined") return;
  document.cookie = `${KEY}=${encodeURIComponent(JSON.stringify(session))}; path=/; max-age=604800; SameSite=Lax`;
}

export function getSession(): DhiSession | null {
  if (memory?.enteredAt) return memory;
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      memory = JSON.parse(raw) as DhiSession;
      return memory;
    }
  } catch {
    /* iframe / private mode */
  }
  memory = readCookie();
  return memory;
}

export function setSession(email: string): DhiSession {
  const session: DhiSession = {
    ...DEMO,
    email: email.trim() || DEMO.email,
    enteredAt: new Date().toISOString(),
  };
  memory = session;
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    /* ignore */
  }
  try {
    writeCookie(session);
  } catch {
    /* ignore */
  }
  return session;
}

export function clearSession() {
  memory = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  try {
    if (typeof document !== "undefined") {
      document.cookie = `${KEY}=; path=/; max-age=0`;
    }
  } catch {
    /* ignore */
  }
}
