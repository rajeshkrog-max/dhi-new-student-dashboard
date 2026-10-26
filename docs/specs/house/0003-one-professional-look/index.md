# 0003. One professional look for every page, the menu and loading screens

**Date**: 2026-10-18
**Status**: Accepted

## Summary

The dashboard already looks polished, but the front door, the error page and the loading screen each look like a different product, and a student waiting for the dashboard sees only the words "One moment…". This spec makes the dashboard's look the single look: one small shared set of parts (card, button, chip, field, brand mark), named colours and corner sizes, one menu style, loading screens that hold the shape of the page they stand in for, and plain error and not found pages. It also moves the two fonts onto our own address, fixes the low contrast grey text, and adds a visible keyboard focus ring. No room changes what it does, and a check script stops the old look coming back.

## Requirements

**User stories**:
- As a student, I want every screen of DHI to look like it belongs to one product so that I trust it and know where I am.
- As a student, I want a loading screen shaped like the page that is coming so that nothing jumps when it arrives.
- As a student using a keyboard or a screen reader, I want a visible focus ring and readable small text so that I can use every page.
- As a builder of the next room, I want one small set of parts and named tokens so that a new room starts on the finished look.

**Acceptance criteria** (the contract, each independently checkable):
- **AC-1**: One light theme covers the house. `styles.css` names the colours, corner sizes, shadows and motion once, with the values in the token table under `## Feature design`. One token `--color-page` (`#f4f0ea`, today's `home-bg`) is the page background, the `theme-color` meta and the colour every contrast check measures against. `body` text becomes `home`, so text that sets no colour of its own stays readable. No dark flash shows behind any page.
- **AC-2**: A shared kit in `src/components/dhi/ui/` provides `Card`, `Button` (variants `solid`, `gold`, `quiet`, `link`), `Chip`, `Field`, `BrandMark`, `Notice`, `Skeleton` and `StatusPage`. The dashboard (`home.tsx`), the Enter screen, the error page, the not found page and the loading screens use them instead of local copies.
- **AC-3**: The Enter screen keeps its day and night video scene. Its card, heading, text, buttons and fields come from the kit, so it reads as the dashboard's look on a scene. In day mode the card is the dashboard's paper glass. In night mode the card is the dark glass at 70% opacity (up from 35%) and its muted lines use `paper/85`, and every text pair measures at least 4.5 to 1 against the worst case (the card over pure white, since the video changes). The Enter screen's form behaviour and `data-testid` hooks are unchanged. The scene container has a dark background colour taken from the night poster, so the paper page never flashes light before the poster paints.
- **AC-4**: The side menu and the phone drawer show the same brand mark, the same profile card, the same item style and active style, and the same visible "Exam is going on" line when locked. Both read the single `NAV` list and the single `locked` state. The error, not found and slow wait pages show the same brand top bar. The dashboard skeleton draws the real frame (top bar or side menu), and the door skeleton has no top bar. None of these pages shows a student name or data.
- **AC-5**: Three loading screens hold the shape of what they stand in for. A dashboard skeleton (top bar below 1024 px, side menu from 1024 px drawn as plain blocks with no room names, because `locked` is not known yet, a header, a row of cards) shows while `/dashboard` checks sign in. A door skeleton (the night poster, not the video, with a card the size of the Enter card, no top bar) shows while `/` and `/enter` check sign in. A `CardSkeleton` is provided for data that arrives later. Each is announced as "Loading" to a screen reader, never as blank. The content that replaces a skeleton does not move the frame: the sweep's layout shift score (a `PerformanceObserver` on `layout-shift`, from navigation until the page settles) stays under 0.05, and the greeting header reserves a minimum height equal to its skeleton so a wrapping name cannot push the cards.
- **AC-6**: After 8 seconds a loading screen keeps its shape and a `Notice` over it adds one calm line ("This is taking longer than usual.") and a Try again button that reloads the page. It does not switch to the error page. Before 8 seconds neither shows.
- **AC-7**: Error and not found pages use the kit, the brand top bar and the words in the copy table under `## Feature design`. The error page has two buttons, Try again and Back to the house. The not found page has one, Back to the house. Back to the house goes to `/` when the address starts with `/enter` and to `/dashboard` otherwise. The raw error text is never shown to a student; it goes to the browser console. A not found page exists for unknown paths under the house's own routes and answers with HTTP 404. Try again calls the router's `reset()` together with `router.invalidate()`, because invalidate alone does not clear a render error. A root level error (for example inside `GateProvider`) still shows a styled page with CSS, because the document shell is not inside the part that can fail. The `RoomGate` "This room paused" card follows the same rule.
- **AC-8**: One global `:focus-visible` ring appears on every button, link, field and `[role="button"]` on every page: a 2 px `home` line with a 2 px paper offset, so it shows on light and dark surfaces alike (at least 3 to 1 against what sits next to it, including the night Enter card, Study hour and the chat panels). Mouse and touch use does not show it.
- **AC-9**: The `mute` colour is darkened until all text under 24 px regular (or 18.7 px bold) passes 4.5 to 1 on `--color-page` and on white card surfaces, everywhere at once (today it is 3.98 to 1). Text on the dark Study hour and chat panels does not use `mute` and stays at or above 4.5 to 1.
- **AC-10**: Fraunces and Outfit load from our own address (`/assets/*`), with no request to `fonts.googleapis.com` or `fonts.gstatic.com`. A fallback font with matched size and line metrics keeps text from jumping while they load: metric overrides (`size-adjust`, `ascent-override`, `descent-override`, `line-gap-override`) written against Arial for Outfit and Georgia for Fraunces, with numbers taken from capsize or fontaine and recorded in `styles.css`. Fraunces loads the `opsz` and `wght` axes and Outfit the `wght` axis, Latin subset only.
- **AC-11**: All of it holds at 360, 768, 1024 and 1280 px: no sideways page scroll, tap targets at least 44 px and text at least 12 px on touch (house/0001 rules), and desktop from 1024 px looks as today except where AC-1, AC-8 and AC-9 change it on purpose.
- **AC-12**: No room's behaviour changes. A room swaps to a kit part only where its existing classes already match the part exactly. The frozen exam lock, every `data-room`, `data-testid`, `data-decorative` and `data-scroll-x` hook, and the room rules in `BACKEND.md` stay.
- **AC-13**: `pnpm responsive:sweep` reaches the dashboard again and visits every room, plus the door, the error page, the not found page and each loading screen, at the four widths. To reach the error and loading screens the sweep uses a dev only `?__throw=1` on `/dashboard` (guarded by `import.meta.env.DEV`, absent from a production build) and Playwright `page.route` to hold back the auth and Convex calls. It also visits `/dashboard/nothing-here` for not found. A new `pnpm look:check` scans `src/**/*.{ts,tsx,css}` (not `routeTree.gen.ts`, and not the `@theme` block or keyframes in `styles.css`) and fails on a hex colour, an `rgb()`, `rgba()` or `hsl()` value, a colour in an inline `style`, an SVG `fill` or `stroke` hex, `rounded-[…]`, or `rounded-xl|2xl|3xl`. A committed baseline `scripts/look-check.baseline.json` records the hits that exist today (so rooms AC-12 leaves alone do not fail), new hits fail, and the count may only go down. A line marked `look-ok: <reason>` is exempt. `look:check` runs in CI beside `pnpm lint` and `pnpm test`. The sweep needs the dev server, the dev backend and the test sign in, so it stays manual, like `enter:check`.

## Decision

**Chosen option**: Option 1: Shared kit, tokens, rooms adopt where identical.

The dashboard's look becomes the one look, carried by named tokens and a small kit in `src/components/dhi/ui/`, with loading, error, not found, the menu and the Enter card rebuilt on it, and a check script to hold it.

**Implementation skills**: `accessibility-review` (`anthropics/knowledge-work-plugins`, `.agents/skills/accessibility-review/`) · `design-system` (`anthropics/knowledge-work-plugins`, `.agents/skills/design-system/`)

Decided here without further questions (each with the runner up):
- Kit lives in `src/components/dhi/ui/` as one file per part, imported with `@/components/dhi/ui/<part>`. Runner up: one barrel file, rejected because it hides unused parts from the bundler.
- `Button` variants: `solid` (`bg-home text-paper`, the main action), `gold` (the one highlighted action, used for "Continue with Google" in night mode), `quiet` (`border-white/80 bg-white/70`), `link` (the `LINK_BUTTON` look). Default height 44 px on touch and 40 px from 1024 px, as the menu items already do. Runner up: a size prop, rejected because every button follows one rule.
- Day mode "Continue with Google" uses `solid`, not the green it has today. Runner up: keep `grove`, rejected so there is one main button colour.
- `Skeleton` is a muted block with a slow pulse under `motion-safe:` only. Runner up: shimmer sweep, rejected as busier and heavier on a phone.
- The sample data note and the sign out error banner become `Notice`.
- Dead `.day` class toggle on `<html>` in the Enter screen is removed, because no CSS reads it.
- The `mute` target value is chosen by the builder with a contrast script; `#6a6379` is the starting guess (about 5.0 to 1 on `#f4f0ea`).
- Fonts: `@fontsource-variable/fraunces` and `@fontsource-variable/outfit`, imported in `styles.css`; fallback faces use `size-adjust` against Georgia and system sans. Runner up: copy the font files into `public/fonts/`, rejected because a new `public/` folder needs a Worker route.
- Out of scope on purpose: the funnel interview and the funnel's own not found page (a different part), rooms becoming real routes (belongs to rows 5 to 16), and any dark theme for the dashboard.

## Feature design

**Data model sketch**: none. No tables, no stored values, no sign in or backend change.

**State transitions**: a wait has three states, `loading` (skeleton only), `slow` (skeleton plus the calm line and Try again, after 8000 ms), and `done` (content). `slow` returns to `done` if the wait ends. Try again reloads the page.

**Surface** (screens and parts):
| Part | Where it appears | Source of its content |
|---|---|---|
| `DashboardSkeleton` | `/dashboard` while `useConvexAuth` or `students.me` is not ready, replaces `Waiting` | none, fixed shape |
| `DoorSkeleton` | `/` and `/enter` while the front door waits, replaces `Waiting` | none, fixed shape |
| `CardSkeleton` | rooms later, for data arriving | none, fixed shape |
| `StatusPage` | root `notFoundComponent`, `defaultErrorComponent` | words from the copy table below; error text goes to `console.error` only |
| `Notice` over a skeleton | the slow state of any loading screen | the slow line in the copy table |
| `BrandMark` | side menu, drawer, top bar, all status pages | fixed "✦ DHI" mark |

**Token table** (written once in `@theme` in `styles.css`; values are today's, taken from the code on 2026-10-18; builder confirms contrast):
| Kind | Token | Value | Replaces |
|---|---|---|---|
| Colour | `page` | `#f4f0ea` | `home-bg`, the near black body `#07070c`, `theme-color` `#0b1f2a` |
| Colour | `paper` | `#f6f1e8` | `#f7f1e8` |
| Colour | `home`, `ink`, `gold`, `grove`, `lilac`, `peach`, `mint` | as in `styles.css` today | the same hex typed in rooms (`#2a2438`, `#e8c36a`, `#2f6b3a`, `#c9b6f2`, `#f7c9c0`, `#f6f1e8`) |
| Colour | `gold-ink` | `#1a1408` | `#1a1208` |
| Colour | `mute` | darker than `#7a7389`, starting guess `#6a6379` (5.03 to 1 on `page`) | `#7a7389` typed in a room |
| Colour | `danger` | `#c45c4a` (fills and borders; any text use must measure 4.5 to 1) | `#c45c4a` (9 uses) |
| Colour | `danger-ink` | `#7a2e24` | `#7a2e24` |
| Colour | `sand`, `sand-deep` | `#efeae3`, `#e8e4dc` | the same hex in Mood, Habits, DHI desk |
| Colour | `amber` | `#e08a3d` | the streak flame hex |
| Colour | `night`, `night-panel` | `#101218` (Enter night glass), `#07141c` (Study hour and Modules dark panels; `#0b1c26` and `#102833` fold into it or the baseline) | the same hex in those files |
| Corner | `card` / `panel` / `control` / `chip` / full | 24 px / 28 px / 16 px / 12 px / 999 px | `[22px]` and `[24px]` and `3xl` to `card`; `[28px]` and the old unused `--radius-card` to `panel`; `2xl` to `control`; `xl` to `chip` |
| Shadow | Tailwind `sm`, `md`, `lg`, `2xl` | the default steps; no custom `box-shadow` value in a component | the same steps in use today (17, 4, 5, 2 uses) |
| Motion | `--duration-sheet`, `--duration-lamp`, `--duration-pulse` | 220 ms, 3.4 s, 1.6 s | the sheet animations, `lamp-glow`, and the new skeleton pulse |

One off hex values that appear once and match no token (the pastel tints in Blog and Papers, `#e8dcff` in the dashboard menu gradient) go into the `look:check` baseline in build task 1 rather than getting a token.

**Copy table** (fixed strings in `ui/status-page.tsx` and `ui/skeleton.tsx`):
| Screen | Title | Words | Buttons |
|---|---|---|---|
| Not found | This page is not here | The address may be wrong, or the page may have moved. | Back to the house |
| Error | Something went wrong | We could not show this page. Please try again. | Try again, Back to the house |
| Room paused | This room paused | Something went wrong in this room. Open it again. | Open again |
| Slow wait | none | This is taking longer than usual. | Try again |
| Any skeleton | none | screen reader text "Loading" | none |

**Value sourcing** (every value a screen shows names where it comes from):
| Action | Value produced / displayed | Source |
|---|---|---|
| Slow wait | the 8 second threshold | one constant `SLOW_WAIT_MS = 8000` in `ui/skeleton.tsx` |
| Back to the house | the target address | `/` when the address starts with `/enter`, else `DASHBOARD_PATH` in `src/lib/entry.ts` |
| Try again | reload | `window.location.reload()` for a slow wait; `reset()` plus `router.invalidate()` for a route error |
| Error and not found copy | the words shown | the copy table above; the thrown error is only logged |
| Loading, error, not found pages | student name or initials | none, these pages are neutral and show no student data |
| Menu profile card | name, initials, class | `useStudent()` as today |
| Menu items and lock | rooms, `locked` | the single `NAV` list and `locked` state in `home.tsx` |
| Dashboard skeleton breakpoint | top bar or side menu | CSS at `lg` (1024 px), the same as the live frame |
| Colours, corners, shadows, motion | token values | `@theme` in `styles.css`, the only place they are written |
| Mute colour | the new value | builder's contrast script, target at least 4.5 to 1 on `#f4f0ea` and white |

**Key invariants**:
- A loading, error or not found page never shows a student's name, class, marks or any room data.
- The raw error message never reaches the page, only the console.
- Motion lives under `motion-safe:` only, including the existing `.lamp-glow`, `.streak-fire` and `.dhi-sit` classes in `styles.css`, which move under it in build task 1. A skeleton does not animate for a student who asks for less motion.
- The 8 second timer lives in a hook keyed to the route, not the component, so a remount does not restart it.
- A signed in student can see the door skeleton and then the dashboard skeleton in a row (the front door redirects after sign in). That is accepted.
- A skeleton has the same outer size and breakpoints as the content it stands in for.
- One list of rooms, one `locked` state. A frozen room never opens from either menu.
- No hand typed hex colour or free corner size in a component, unless a `look-ok: <reason>` comment marks a one off picture colour.

**Security model**: no new data and no new access. Neutral pages leak nothing about a student. Self hosted fonts remove a third party request (privacy gain for under 18 users). No compliance scope beyond what `BACKEND.md` already sets.

**Configuration required**: none. The two font packages are added to the house `package.json` with exact versions, within the `pnpm-workspace.yaml` release age rule.

**Critical test scenarios** (each maps to an acceptance criterion):
- Visit `/enter` signed out at 360, 768 and 1280 px in day and night: one card, kit buttons, no sideways scroll, `landing-*` hooks present, verifies **AC-3**, **AC-11**.
- Open `/dashboard` with the sign in check held back (slow network): the dashboard skeleton shows, then the dashboard appears with no layout jump; after 8 seconds the slow line and Try again show, verifies **AC-5**, **AC-6**.
- Open `/dashboard/nothing-here`: the not found page with the brand top bar and a Back to the house button; no student name, verifies **AC-4**, **AC-7**.
- Throw inside a route: the error page shows plain words and the console holds the message, verifies **AC-7**.
- Throw inside a room: "This room paused" shows no raw message and Open again works, verifies **AC-7**, **AC-12**.
- Tab through the dashboard, the Enter screen and an error page: a ring is visible on each stop, verifies **AC-8**.
- Contrast script over `styles.css` colours on paper, white card and Enter night card: every small text pair at least 4.5 to 1, verifies **AC-9**, **AC-3**.
- Load any page with the network log open: no request to a Google font host, fonts under `/assets/*`, verifies **AC-10**.
- Lock the house by sitting an exam: both menus show the same lock line and no room opens, verifies **AC-4**, **AC-12**.
- `pnpm look:check` on a file with a stray `#c45c4a`: fails, and passes with a `look-ok` marker, verifies **AC-13**.
- Full sweep at four widths across every room, door, error, not found and skeleton: no overflow, small targets or small text, verifies **AC-11**, **AC-13**.

## Build plan

Approach: Tracer Bullet (the house scope's default, `docs/scope/house/index.md`). One thin thread goes through every layer first (tokens, one kit part, one page), then the other pages thicken it. Workflow tier is Alpha (row 25).

1. **The thread.** Repair `responsive-sweep.mjs` so it signs in with the test form (as `enter-check.mjs` does; dev backend only, refuse production) and reaches `/dashboard`, and record the baseline. Then in `styles.css` name the tokens, set the page background and `theme-color` to the paper, add the global focus ring and the darker `mute`. Build `Card` and `BrandMark`, use them on the dashboard header and the `Waiting` screen. Move `.lamp-glow`, `.streak-fire` and `.dhi-sit` under `motion-safe`. Create the `look:check` baseline (`scripts/look-check.baseline.json`) so the allow list is settled before the end, satisfies **AC-1**, **AC-8**, **AC-9**, **AC-13**.
2. **The kit.** Add `Button`, `Chip`, `Field`, `Notice`, `Skeleton`, `StatusPage`. Move `Glass`, `Stat`, `StateChip`, `ProfileCard` and `LINK_BUTTON` out of `home.tsx` into it, satisfies **AC-2**, **AC-12**.
3. **The menu.** One brand mark, profile card, item style, active style and lock line for the side menu and the drawer, keeping `data-room`, `data-testid` and the single `NAV` and `locked`, satisfies **AC-4**, **AC-12**.
4. **Loading screens.** `DashboardSkeleton`, `DoorSkeleton`, `CardSkeleton`, the 8 second slow state, and the `Waiting` swap on `/dashboard`, `/` and `/enter`. The skeletons are also each route's `pendingComponent`, so the server HTML already holds the shape instead of a blank page (confirm the installed TanStack Start version renders it for `ssr: false` routes), satisfies **AC-5**, **AC-6**.
5. **Error and not found.** Rebuild `AppErrorComponent` on `StatusPage`, add a root `notFoundComponent` (HTTP 404), move the `<html>` document into the root `shellComponent` so a root error still has CSS, log the error to the console, and restyle `RoomGate`, satisfies **AC-7**, **AC-12**.
6. **The Enter screen.** Move the card, buttons, fields and tabs to the kit, keep the video and every hook, remove the dead `.day` toggle, satisfies **AC-3**, **AC-11**.
7. **Fonts.** Add the two fontsource packages with exact versions, import them, write the fallback faces, remove the Google `@import`, satisfies **AC-10**.
8. **Rooms.** Swap kit parts into rooms where classes already match exactly and replace stray hex values with tokens; leave anything that differs, satisfies **AC-1**, **AC-2**, **AC-12**.
9. **The proof.** Extend the sweep to the door, error, not found and loading screens (with the `?__throw=1` and `page.route` hooks and the layout shift score); add `scripts/look-check.mjs` and `pnpm look:check` with a test beside it; run both and the CI commands, satisfies **AC-11**, **AC-13**.

## Consequences

**Positive**:
- One look and one set of parts that rows 5 to 16 build on.
- Waiting and failing pages feel designed, and a student is never left on bare text.
- Keyboard and low vision users get a ring and readable small text on every page.
- No Google font request for students under 18.
- A check script catches drift, and a working sweep returns.

**Negative / tradeoffs**:
- Darker muted text and a 22 to 24 px corner change shift the dashboard slightly on desktop, on purpose.
- Rooms that differ from the kit keep local variants until their own rows rebuild them.
- Two small font packages join the dependencies and the first load carries the font files from our address.
- Skeletons are fixed shapes, so a future change to the dashboard layout must update the skeleton too.
- `look:check` adds a rule every new room must respect, and the `look-ok` marker can be abused.

**Neutral**:
- The funnel interview and its not found page keep their own look. A house not found page is reachable only under `/enter*`, `/dashboard*` and `/home*` on dhirise.com.
- The deployed Worker routes do not change, because fonts ship under `/assets/*`.
- `src/components/dhi/AGENTS.md` and `scripts/AGENTS.md` should gain the kit and the new command once built (done by `/sync`).

## Follow-up

- [ ] Confirm by running it that `responsive:sweep` cannot reach the rooms today (it visits `/home`, which redirects to a sign in); build task 1 repairs it
- [ ] A restyled funnel not found page and a matching look for the interview belong to `apps/joining`; raise a scope row if you want them
- [ ] Rooms becoming real routes (menu on every page, the Android back button) belongs with the real room rows
- [ ] `accessibility-review` and `design-system` were installed under `.agents/skills/` (symlinked for Claude Code, recorded in `skills-lock.json`). They are project wide, so they belong in a bullet under `## Agent skills` in root `AGENTS.md`
- [ ] Declined for now: the Tailwind theme skills, `no-ui-flash`, `loading-states` and the two accessibility MCP servers (`a11ymcp`, `accessibility-mcp-server`), so a later stage does not offer them again

Decision record: [rationale.md](./rationale.md) · verify steps: [verify.md](./verify.md)
