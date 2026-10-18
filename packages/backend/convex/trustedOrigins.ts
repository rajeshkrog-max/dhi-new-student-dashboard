// Which addresses may sign in (spec 0007, AC-10). Pure rules, so they can be tested without a deployment.
// `BETTER_AUTH_TRUSTED_ORIGINS` is a comma list of origins. Unset or empty means the list `[BETTER_AUTH_URL]`, which is
// exactly how sign in behaved before the list existed, so production is unchanged until the list is set on purpose.

// Splits the raw variable: trimmed, lowercased, no empty parts, no trailing slash, no repeats.
export function parseOriginList(raw: string | undefined): string[] {
  const seen = new Set<string>();
  for (const part of (raw ?? "").split(",")) {
    const origin = part.trim().toLowerCase().replace(/\/+$/, "");
    if (origin) seen.add(origin);
  }
  return [...seen];
}

// The `host` (name and port) of an origin, or null when the text is not an address.
function hostOf(origin: string): string | null {
  try {
    return new URL(origin).host.toLowerCase();
  } catch {
    return null;
  }
}

export type SignInOrigins = {
  // What Better Auth is given as `baseURL`: the plain site address, or the allow list with the site address as the fallback.
  baseURL: string | { allowedHosts: string[]; fallback: string };
  trustedOrigins: string[];
  // The hosts a forwarded host header may name. Empty means "not checked": the list is unset and nothing changes.
  allowedHosts: string[];
};

export function signInOrigins(siteUrl: string, rawList: string | undefined): SignInOrigins {
  const list = parseOriginList(rawList);
  // Unset or empty: today's behaviour, byte for byte.
  if (list.length === 0) return { baseURL: siteUrl, trustedOrigins: [siteUrl], allowedHosts: [] };
  // The site's own address always counts, so a list that forgets it cannot lock out the funnel's forwarder (it names that host) and sign in.
  const own = hostOf(siteUrl);
  const allowedHosts = [...new Set([...list.map(hostOf), own].filter((h): h is string => h !== null))];
  return { baseURL: { allowedHosts, fallback: siteUrl }, trustedOrigins: list, allowedHosts };
}

// True when a request names a forwarded host that is not on the list. No header is never a refusal: the base address is then
// `BETTER_AUTH_URL` (the fallback). The Convex platform itself fills `x-forwarded-host` with the deployment's own host when no proxy
// sent one, so `ownHost` (the host of CONVEX_SITE_URL) counts as "no claim" too. With no list nothing is checked, so production
// behaves as it does today.
export function isForbiddenForwardedHost(forwardedHost: string | null, allowedHosts: string[], ownHost?: string | null): boolean {
  if (allowedHosts.length === 0) return false;
  const host = forwardedHost?.trim().toLowerCase();
  if (!host) return false;
  if (ownHost && host === ownHost.trim().toLowerCase()) return false;
  return !allowedHosts.includes(host);
}

// The host of an address, or null.
export function hostOfUrl(url: string | undefined): string | null {
  return url ? hostOf(url) : null;
}
