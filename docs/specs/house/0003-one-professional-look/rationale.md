# 0003. One professional look for every page, the menu and loading screens (decision record)

Context, options and rationale for [the build spec](./index.md).

## Context

**Workspace**: the student house (repo root, `src/`), scope `docs/scope/house/rooms.md`, row 25. Stack: TanStack Start, React 19, Tailwind CSS 4. No data, schema or sign in changes.

Measured by reading the code on 2026-10-18:
- Three looks exist. The dashboard (`src/routes/home.tsx`) is light: paper background, glass cards with a 24 pixel corner, Fraunces headings and Outfit text. The Enter screen (`src/components/dhi/enter-screen.tsx`) is a dark video scene with its own buttons and fields. The error page (`src/lib/error-component.tsx`) is plain grey zinc and uses a dark mode no other page has.
- There is no not found page. There is one loading screen, `Waiting` in `convex-session.tsx`, which is the text "One moment…" and can stay forever if sign in never settles.
- The same card, button and chip markup is retyped in about 8 files (`border-white/80 bg-white/70` in 8, `bg-home text-paper` buttons in 8). `Glass`, `Stat`, `StateChip`, `ProfileCard` and `LINK_BUTTON` live inside `home.tsx` and are not shared.
- `styles.css` names 7 colours, but about 15 other hand typed hex values sit in components. Corner sizes in use: `[22px]`, `[24px]`, `[28px]`, `3xl`, `2xl`, `xl`, full. `--radius-card` is defined but unused. The page behind everything is near black (`#07070c`) and the browser bar colour (`#0b1f2a`) matches neither look.
- No `focus-visible` rule exists anywhere, so keyboard users see only the browser default where it still shows. The muted text colour `mute` (`#7a7389`) is about 4.0 to 1 against the paper background, under the 4.5 to 1 a small line needs.
- Both fonts load from Google Fonts at page open. Students are under 18, so each visit sends their address to a third party, and the text jumps when the fonts arrive.
- The Worker serves only its own paths on dhirise.com (`/`, `/enter*`, `/dashboard*`, `/home*`, `/assets/*` and the picture folders). Any other address, such as `/hello`, goes to the funnel on Cloudflare Pages and gets the funnel's own not found page. The sign in sweep `scripts/responsive-sweep.mjs` visits `/home`, which now redirects to `/dashboard` and then to the Enter screen for a visitor who is not signed in (spec 0008), so it very likely cannot reach the rooms today.

If nothing is decided, rows 5 to 16 build new rooms on whichever of the three looks the builder copies, and the drift grows with every room.

## Options considered

### Option 1: Shared kit, tokens, rooms adopt where identical (chosen)

Extract `Card`, `Button`, `Chip`, `Field`, `BrandMark`, `Notice`, `Skeleton` and `StatusPage` from `home.tsx` and the Enter screen, name tokens once, restyle the outer pages, and let each room swap only where its markup already matches.

**Pros**:
- One source for the look, and the next 10 rooms start on it.
- No room behaviour risk, because nothing is rewritten.

**Cons**:
- Rooms with slightly different markup keep local variants until a later pass, so the look is near, not total, inside those rooms.

### Option 2: Kit plus rewrite every room onto it

Same kit, but all 11 rooms are rewritten onto it.

**Pros**:
- Strongest consistency.

**Cons**:
- Touches about 2900 lines of room code (papers alone is 736), with the room rules in `BACKEND.md` at risk, and most of those rooms are rebuilt anyway in rows 5 to 16.

### Option 3: Tokens only, no shared components

Name colours, corners and type in `styles.css` and nothing else.

**Pros**:
- Smallest change.

**Cons**:
- Each page keeps its own markup, so drift returns on the next room. Loading and error pages still need shared parts.

## Rationale

The pain is drift: three looks, retyped parts, and a loading screen that says nothing. A kit fixes drift at its source, and the "adopt where identical" rule honours the forces in Context: rooms are large, most are rebuilt soon, and `BACKEND.md` forbids behaviour changes, so a rewrite spends effort and risk on code about to change. Tokens alone would not give loading and error pages their shared parts.

The Enter scene stays because it is the brand's one rich moment, and only its card, type and buttons change, which closes the visible gap without a regression in the first thing a student sees. Skeletons that match the frame remove the jump the current text screen causes. Self hosting fonts removes a third party request for students under 18 and the late font swap in one move; a 4.5 to 1 contrast and a focus ring are small changes that lift every page at once.
