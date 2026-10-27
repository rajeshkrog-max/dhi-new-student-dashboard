// The pure rules of the study hour call (house spec 0027; the owner's answers of 2026-10-28). No imports, so the screens read the same numbers
// (`@dhi/backend/hourCallRules`). One call for each hour and institute, so a call only ever holds one institute's students. Every call is recorded on
// Stream; the recordings are deleted there after RECORDING_KEEP_DAYS.
export const HOUR_CALL_TYPE = "dhi_hour";
export const HOUR_CALL_MAX = 50; // people in one institute's call at once
export const RECORDING_KEEP_DAYS = 30; // the same as the study hour chat
export const SHARES_MAX = 20; // students one hour's recording may be shared with

// A 53 bit string hash (cyrb53), seeded, so two seeds give about 106 bits: enough that no two hour and institute pairs share a call.
function hash53(text: string, seed: number): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

// The call id of one institute's call in one hour. Stream call ids are at most 64 characters (two Convex ids are 65), so the pair is hashed into a
// short id that is the same every time.
export const callIdOf = (hourId: string, instituteId: string): string => `h${hash53(`${hourId}:${instituteId}`, 1)}${hash53(`${hourId}:${instituteId}`, 2)}`;
