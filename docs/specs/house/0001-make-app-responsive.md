# 0001. Make the student house responsive on phone, tablet and desktop

**Date**: 2026-10-18
**Status**: Accepted

## Summary

The student house was drawn for a desktop screen. On a 360 pixel phone the 686 pixel side menu sits on top of the page, so a student scrolls past 11 menu items before seeing any room, and several rooms spill sideways or clip. This spec keeps one layout that adapts: below 1024 pixels the side menu becomes a pinned top bar with a slide in drawer, one shared sheet replaces the fixed pop ups, and each room gets its own phone layout. Desktop at 1024 pixels and wider must look and behave as today. A repeatable script proves every room at four widths so a later change cannot quietly break one.

## Context

**Workspace**: the student house (repo root, `src/`), scope `docs/scope/house/`, row 1. The stack is TanStack Start, React 19 and Tailwind CSS 4. No data, schema or sign in changes are involved.

The house screen is one route, `src/routes/home.tsx`, that holds the menu, the page header and the active room. The rooms live under `src/components/dhi/`. The frame is a two column grid (a 220 pixel menu, then the room) that switches on at 768 pixels, with the whole frame fixed to the screen height and each room scrolling inside it. Below 768 pixels the grid is one column, so the full menu stacks above the room.

Measured on the running app on 2026-10-18 at 360, 768 and 1280 pixel wide screens:
- At 360, the menu is 686 pixels tall and the room starts 714 pixels down, below the first screen.
- At 360, Study hour spills sideways. At 768 (menu beside a 480 pixel room), the Home lamps card and two Habit tracker cards spill sideways.
- Mood tracker has about 370 controls under 40 pixels tall at every width (the calendar cells and day buttons).

A read of the room files found more that the measurement cannot see yet (to be confirmed when each room is built): pop ups with no height cap or inner scroll (exam submit, habit compose, mood form), side panels that cut their bottom content, the exam question numbers hidden below 768 with nothing in their place, the study hour timer hidden on phones, tips that appear only on hover or in a `title` attribute (unreachable by touch), and about 70 spots using text of 9 to 11 pixels. `@radix-ui/react-dialog` and `vaul` are installed in `package.json` but nothing uses them yet.

Other work in flight: the platform move (specs `_root/0001` to `0006`) touches `src/lib/auth/`, `src/lib/db.ts`, `package.json` and config. This work touches only `src/routes/home.tsx`, `src/components/dhi/`, `src/styles.css`, `src/routes/__root.tsx` and `src/routes/index.tsx` (the sign in page, which spec 0003 may also change).

Room rules in `BACKEND.md` ("Rooms in this repo", "Do not") are product rules. They must hold on every screen size.

## Requirements

**User stories**:
- As a student on a phone, I want to reach any room in one tap and see it right away, so that I do not scroll past a long menu first.
- As a student on a phone or tablet, I want every room to fit my screen with large, readable controls, so that I can use it with one thumb and no zooming.
- As a student sitting an exam on a phone, I want to jump between questions and see why other rooms are locked, so that I am never stuck or confused.
- As the person who shows the demo on a desktop, I want nothing to change on a wide screen, so that the demo I already show stays safe.

**Acceptance criteria** (the contract, each independently checkable):
- **AC-1**: Below 1024 pixels wide the 220 pixel side menu is not shown. A pinned top bar is shown instead, holding the menu button on the left, the DHI mark, and the bell with its dot on the right. Each control is at least 44 by 44 pixels. At 360 by 740 on Home, the room title is visible without scrolling.
- **AC-2**: The menu button opens a drawer from the left holding, top to bottom: the search box (only below 768 pixels), all 11 rooms, Leave and the profile card. Picking a room closes the drawer and opens that room. Esc, tapping outside and a close button (at least 44 pixels) also close it. Focus moves into the drawer on open and back to the menu button on close, and the page behind does not scroll while it is open. Resizing or rotating to 1024 pixels or wider while it is open closes it.
- **AC-3**: During an exam sitting, the drawer shows every room except Exams greyed and not tappable, and Leave too, with the line "Exam is going on" as plain visible text in the drawer, never only a hover tip. The drawer search shows "Search banned in exam". From 1024 pixels the side menu keeps today's hover tip.
- **AC-4**: Below 1024 pixels the whole page scrolls and the top bar stays pinned. From 1024 pixels the frame is as today: the page does not scroll and the room scrolls inside it.
- **AC-5**: Every room, the two "coming soon" rooms (Counseling, Progress) and the sign in page at `/` show no sideways page scroll at 360, 768, 1024 and 1280 pixels wide. No visible element extends past the screen unless it sits inside a box that is meant to scroll sideways and is marked as such.
- **AC-6**: Nothing is cut off or overlapping. At 360 by 640 every part of every room can be reached by scrolling the page or a marked scroll box. This covers Study hour, the habit side panel, the mood archive drawer and every pop up, and the room still works with the on screen keyboard open.
- **AC-7**: On touch widths (below 1024 pixels or a coarse pointer) every button, link, input, select and switch is at least 44 by 44 pixels, counting padding and invisible hit area. Named exceptions only: the seven column day cells of the mood calendar (at least 42 wide and 44 tall), links inside a sentence, and elements marked decorative.
- **AC-8**: On touch widths, text a student reads is at least 12 pixels. Purely decorative badges and counters are exempt and marked.
- **AC-9**: Every pop up and side panel uses one shared Sheet: exam submit, meal logger, mood form, mood archive drawer, habit compose, habit slide, study hour chat, and the DHI desk Sittings list and drawings pane. On a phone each Sheet fits within 90 percent of the screen height, scrolls inside, has a close control of at least 44 pixels, closes on Esc, traps focus and stops page scroll behind it.
- **AC-10**: Below 768 pixels the exam question jump is a sideways scrolling row of numbered buttons, 44 pixels each, above the question, with the current number scrolled into view and the same done colours as today. From 768 pixels it is the column as today.
- **AC-11**: At 360 pixels the mood calendar shows all seven day columns, with cells about 43 wide and 44 tall, one finger per day.
- **AC-12**: Study hour on a phone shows your own tile first, the other students in a sideways strip below it, a "View all" button that keeps its page, and the chat as a Sheet. The time left is visible on phones. The room scrolls with the page and nothing clips at 360 by 640.
- **AC-13**: DHI desk on a phone shows the chat filling the room with the composer visible without scrolling the page (keyboard closed), a "Sittings" button beside the room title with the coins left as a chip next to it, the Sittings list in a Sheet, and the drawings pane opening full screen over the chat with a close button.
- **AC-14**: Every explanation that today appears only on hover or in a `title` attribute (the exam lock tips, the disabled back button in Exams, the timer note, the habit colour names) is also visible text or a tap reachable label on touch widths.
- **AC-15**: Charts and grids fit. The habit chart plot is at least 200 pixels wide at 360, with readable axis labels. The stat cards, quick access tiles and room grids reflow without a card or tile narrower than its content.
- **AC-16**: From 1024 pixels wide nothing changes except bug fixes found on the way. Before and after screenshots of every room at 1024 and 1280 differ only where a bug was fixed.
- **AC-17**: No room rule changes. The exam lock, the hint slider that must not reveal the answer, modules scoring once at the end, the habit cap of five and the desk cache rule behave as before, and no screen labels a student weak, average or bright.
- **AC-18**: A repeatable script, `pnpm responsive:sweep`, opens every room and the sign in page at 360, 768, 1024 and 1280 pixels wide against the running dev server, prints a table, and exits non zero on any failure of AC-5, AC-7 or AC-8. The rules for what counts as overflow, a small target or small text sit in a pure module with `node:test` tests that `pnpm test:house` runs.

## Options considered

### Option 1: One layout that adapts, with a shared drawer and Sheet

Keep one component tree. Add a top bar and drawer below 1024 pixels, one shared Sheet for pop ups and side panels, a `touch` style variant for target and text sizes, and a phone layout inside each room that needs one.

**Pros**:
- Desktop code paths stay the same, so AC-16 is easy to hold.
- The room rules stay in one place next to each room, as `BACKEND.md` asks.
- Uses a dependency already installed.

**Cons**:
- Several rooms need real reflow work, not just class changes (Study hour, DHI desk).
- Some components carry both a phone and a desktop layout, which is more branches to read.

### Option 2: Rebuild the rooms phone first

Redraw every room for the narrowest screen, then add room as width grows.

**Pros**:
- The cleanest end result, with no leftover desktop assumptions.

**Cons**:
- Touches every desktop screen, against the rule that desktop stays as is.
- The largest change, with the most risk to the room rules.

### Option 3: Separate phone screens chosen by screen width

Render different room components on a phone than on a desktop.

**Pros**:
- Each version can be exactly right for its screen.

**Cons**:
- Every rule and every bug fix must be made twice, and the two drift apart.
- Demo data and store calls get duplicated.

## Decision

**Chosen option**: Option 1: One layout that adapts, with a shared drawer and Sheet.

Add a pinned top bar and drawer below 1024 pixels, one shared Sheet on Radix Dialog, a `touch` variant for 44 pixel targets and 12 pixel text, and a phone layout per room, all gated so that 1024 pixels and wider is unchanged, and prove it with a sweep script.

**Implementation skills**: none installed for this area.

**Decisions made with the engineer** (fixed requirements for the build):
- Phone menu: top bar with a menu button and a drawer (not a bottom tab bar, not a chip strip).
- The side menu shows from 1024 pixels. Tablets in portrait use the drawer.
- Narrowest supported screen: 360 pixels. The sweep also checks 768, 1024 and 1280.
- Touch targets at least 44 by 44 pixels. Text at least 12 pixels where a student reads it.
- Search lives in the drawer on phones. The exam lock reads as visible text. Below 1024 the page scrolls. The sign in page is in the pass.
- Drawer and Sheet tool: Radix Dialog (`@radix-ui/react-dialog`). The sweep is a Playwright script in `scripts/`, plus `/check verify` by eye.
- Top bar: menu button, DHI mark, bell. The profile card moves into the drawer. The room title and subtitle stay under the top bar, with a smaller title.

**Decisions made by the architect** (RECOMMEND items; pick, reason, runner up):
- **A `touch` variant, not scattered `max-lg:` classes.** Define `@custom-variant touch (@media (pointer: coarse), (max-width: 1023.98px))` in `src/styles.css` and use it for every 44 pixel and 12 pixel rule. Reason: one name for "this is a touch or small screen", and a touch laptop at 1280 still gets big targets. Runner up: `max-lg:` only, which misses large touch screens.
- **Header search stays from 768 pixels, drawer search only below 768** (`md:hidden`). Reason: a tablet in portrait has room for the box in the header, and one box shows at a time.
- **The bell lives in one `NotificationBell` component**, shown in the top bar below 1024 and in the page header from 1024. Reason: one dot, one place per size.
- **One `HouseMenu` component** (the 11 rooms, Leave, exam lock) rendered in the side menu and in the drawer, so both read the same `NAV` list and the same `locked` state. Reason: two copies would drift.
- **Do not set `viewport-fit=cover`.** Browsers add the notch margins themselves in a normal tab. Runner up: set it and pad with `env(safe-area-inset-*)`, worth revisiting if the house is installed to the home screen.
- **Use `dvh` units, never `h-screen`,** so the phone address bar and keyboard do not cut content. Fix `min-h-screen` in `src/lib/error-component.tsx`.
- **Rooms that fill the frame (DHI desk, Study hour) get a viewport based height below 1024** (for example `h-[calc(100dvh-9rem)]` with a floor of about 32rem, tuned during the build) so the composer and controls stay on screen while the page scrolls.
- **Existing right side panels (mood archive, habit slide) become Sheets on the right,** full width below 640 pixels. Same content, same actions.
- **Motion:** drawer and Sheet slide with `motion-safe:` transitions only.
- **Chart axes:** the habit chart narrows its label column below 640 pixels (about 84 instead of 118) with 12 pixel labels that truncate, so the plot keeps at least 200 pixels.
- **Sweep hooks:** `data-room="<id>"` on each menu item, `data-testid="menu-button"` on the menu button, `data-decorative` on exempt badges, and `data-scroll-x` on boxes that scroll sideways on purpose.

## Rationale

The pain is one frame problem plus a handful of room problems. The frame problem (the stacked 686 pixel menu) is solved once, in `home.tsx`. The rooms already use some breakpoints, so most need adjustment, not redesign. That makes adapting the existing tree the cheapest way to meet "desktop unchanged" (AC-16) and "rules stay next to the room" (AC-17). A rebuild or a second set of phone screens would put the demo and the room rules at risk for no student benefit.

The drawer beats a bottom tab bar because there are 11 rooms and only 4 slots, and picking four would rank the rooms. Radix Dialog beats vaul and a hand built layer because it gives focus trap, Esc, scroll lock and screen reader support for the least new surface, and it is already installed. Moving the side menu start from 768 to 1024 pixels fixes the tablet: at 768 the room beside a 220 pixel menu is only 480 pixels wide, which is what spilled the Home and Habit cards.

The sweep script is part of the decision, not an extra. Responsive breakage returns whenever a room changes, and an Alpha level pass has no automated check otherwise. The existing `scripts/browser-smoke.mjs` assumes a Linux sandbox and its own output paths, so the sweep is a small separate script that follows the repo's pattern of a thin runner over a pure, tested module.

## Feature design

**Data model sketch**: none. No storage key, schema or migration changes. The demo stores in `src/lib/dhi/` are untouched.

**State**: no new stored state. One new local boolean, `menuOpen`, in `StudentHome`. The `locked` and `tab` state stay where they are.

**API surface**: none.

**Layout contract**:

| Width | Menu | Page scroll | Header search | Bell | Profile chip in header |
|---|---|---|---|---|---|
| below 640 | drawer | whole page, top bar pinned | in the drawer | top bar | no (in drawer) |
| 640 to 767 | drawer | whole page | in the drawer | top bar | yes |
| 768 to 1023 | drawer | whole page | header | top bar | yes |
| 1024 and up | side menu, 220 pixels | frame fixed, room scrolls inside (as today) | header | header | yes |

**Shared pieces** (new, under `src/components/dhi/`):
- `house-menu.tsx`: the 11 rooms, Leave, the exam lock, used by the side menu and the drawer.
- `sheet.tsx`: Radix Dialog wrapper. `side` is `left` (menu), `right` (room side panels) or `bottom` (forms below 640, a centred dialog from 640). It caps height at 90dvh, scrolls inside, and has a 44 pixel close button.
- `notification-bell.tsx`: the bell and its dot.
- `src/styles.css`: the `touch` variant.

**Per room** (what changes on a phone; desktop unchanged):

| Room | Changes |
|---|---|
| Home | Reflow cards and the three column row; calendar and chip text to 12 pixels; lamps card fits at 768 |
| Exams | Submit modal to Sheet; jump row replaces hidden column; milestone and lane buttons to 44; title only tips to visible text; timer text to 12 pixels |
| Meals | Logger to Sheet; the name, unit and quantity row wraps; steppers to 44 |
| Mood | Calendar cells about 43 by 44 with trimmed phone padding; form and archive drawer to Sheets; day buttons to 44 |
| Habits | Compose to Sheet; slide to a right Sheet; swatches and chips to 44; colour names visible; chart axis narrows |
| Modules | Labels to 12 pixels; check grids |
| Blog | Cards stack until there is room; toolbar and tag chips to 44; check the editor toolbar keeps its selection when tapped |
| Study hour | Own tile first, strip of others, View all kept, chat Sheet, timer shown, page scroll |
| DHI desk | Chat fills, Sittings button and coins chip, Sittings Sheet, drawings full screen |
| Counseling, Progress | Placeholder card fits |
| Sign in (`/`) | Check at four widths, fix only what breaks |

**Value sourcing**:
| Action | Value displayed | Source |
|---|---|---|
| Top bar and drawer | Which room is open | `tab` state in `StudentHome` |
| Drawer rooms | Names and icons | the existing `NAV` array in `src/routes/home.tsx` |
| Drawer and top bar | Exam frozen or not | `locked` state in `StudentHome`, set by `PapersDesk` |
| Drawer footer | Student name and initials | `HOME.student` in `src/lib/dhi/home-demo.ts` |
| Top bar | Bell dot | always shown, as today (no unread count exists) |
| Sweep | Which rooms to visit and how to open them | `data-room` attributes on menu items (the drawer is opened first below 1024) |

**Key invariants**:
- Anything changed for phones is gated to the `touch` variant or a width below 1024, so 1024 and up keeps today's look.
- A frozen room can never be opened from the drawer, same as the side menu today.
- No change to storage keys, demo data or room rules.

**Security model**: none. Demo data only, one seat. No new data is read or written.

**Configuration required**:
- `pnpm responsive:sweep` script entry in `package.json` (the house keeps `pnpm`, set by spec `_root/0006`).
- The sweep uses the existing `playwright` dev dependency and the dev server at `localhost:8080`. No new packages.

**Edge cases and failures**:
- Drawer open while the window rotates or resizes to 1024 or wider: it closes (AC-2).
- The exam ends while the drawer is open: the rooms unfreeze in place.
- Long names (student name, room names) truncate with `min-w-0` and never push the layout.
- Landscape phones (about 740 by 360) use the same drawer and page scroll as portrait.
- Browser zoom to 200 percent on a 720 pixel window (about 360 CSS pixels) wraps text and does not clip.
- Slow or failing room: the existing `RoomGate` error card is checked at 360.
- Android back leaves the page instead of closing the drawer. Rooms are not routes today, so this is not new.

**Critical test scenarios** (each maps to an acceptance criterion):
- Happy path: open Home at 360 by 740, tap the menu button, pick Meal Tracker, the drawer closes and Meals shows, verifies **AC-1**, **AC-2**.
- Exam: start a sitting on a 360 wide screen, open the drawer, every room except Exams is greyed with the visible notice, verifies **AC-3**.
- Failure case: rotate a phone with the drawer open from 700 to 1100 pixels wide, the drawer closes and the side menu shows, verifies **AC-2**, **AC-4**.
- Sweep: run `pnpm responsive:sweep` on the finished build, it exits zero, verifies **AC-5**, **AC-7**, **AC-8**, **AC-18**.
- Desktop: compare before and after screenshots at 1024 and 1280, verifies **AC-16**.
- Rules: sit an exam and play a module on a phone, the lock and the scoring behave as on desktop, verifies **AC-17**.

## Build plan

Ordered as Tracer Bullet (the house default): a first thin thread through the shell, one room (Home) and the proof script, then the other rooms one at a time. Each room slice ends with the sweep passing for that room.

**Slice 1: the thread (shell, Home, sweep)**
1. [x] Save before screenshots of every room at 1024 and 1280 (kept out of the repo, in a scratch folder), satisfies **AC-16**.
2. [x] Add the sweep: `scripts/responsive-verdict.mjs` (pure rules for overflow, target size, text size, with the named exceptions), `scripts/responsive-verdict.test.mjs`, `scripts/responsive-sweep.mjs` (thin Playwright runner, four widths, touch emulation below 1024) and the `responsive:sweep` entry. Run it once and keep the failure list as the work queue, satisfies **AC-18**, **AC-5**, **AC-7**, **AC-8**.
3. [x] Add the `touch` variant and the shared `Sheet`, satisfies **AC-9**.
4. [x] Extract `HouseMenu` and `NotificationBell`; build the top bar and drawer in `home.tsx`; set the layout contract and the page scroll model; add the sweep hooks; show the exam notice in the drawer, satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-14**.
5. [x] Make Home pass at all four widths, satisfies **AC-5**, **AC-6**, **AC-7**, **AC-8**, **AC-15**.

**Slice 2: the rooms** (one task per room, run the sweep after each)
6. [x] Exams, satisfies **AC-9**, **AC-10**, **AC-14**, **AC-7**, **AC-8**.
7. [x] Mood, satisfies **AC-9**, **AC-11**, **AC-7**.
8. [x] Meals, satisfies **AC-9**, **AC-6**, **AC-7**.
9. [x] Habits, satisfies **AC-9**, **AC-14**, **AC-15**, **AC-7**.
10. [x] Modules and Blog, satisfies **AC-5**, **AC-7**, **AC-8**.
11. [x] Study hour, satisfies **AC-6**, **AC-9**, **AC-12**.
12. [x] DHI desk, satisfies **AC-6**, **AC-9**, **AC-13**. Check the phone layout against `docs/DHI Desk Design v1.pdf` first and flag any conflict.
13. [x] Sign in page, the two coming soon rooms and `src/lib/error-component.tsx` (`min-h-dvh`), satisfies **AC-5**, **AC-7**. Do this last to limit overlap with spec 0003.

**Slice 3: close out**
14. Run the sweep clean, compare desktop screenshots, run the room rules by hand, satisfies **AC-16**, **AC-17**, **AC-18**.
15. Check once on a real phone (address bar, keyboard in the DHI desk composer and the Blog editor, the habit chart) and note it in the verify result, satisfies **AC-6**.

## Consequences

**Positive**:
- Every room opens on a phone with the content first, large controls and readable text.
- A repeatable check stops responsive breakage coming back.
- One shared Sheet and one shared menu replace several one off pop ups and a stacked menu.

**Negative / tradeoffs**:
- Tablets in portrait lose the always visible side menu and use the drawer instead.
- Text is 12 pixels on touch widths but unchanged on desktop, so a few labels differ between the two.
- The mood calendar cells are about 43 pixels wide, 1 pixel under 44, an accepted named exception.
- Study hour and DHI desk carry two layouts each, which means more branches to maintain.
- The sweep needs a running dev server and is not part of `pnpm test:house`; only its rules module is.
- The sweep cannot judge overlap or taste, so `/check verify` by eye is still needed.

**Neutral**:
- `@radix-ui/react-dialog` starts being used; `vaul` stays unused and can be dropped later in the shared dependency list (spec `_root/0005`).
- `AGENTS.md` still says `npm` for the house commands; the repo now uses `pnpm`.

## Follow-up

- [ ] `docs/DHI Desk Design v1.pdf` could not be read while writing this spec. Check the DHI desk phone layout (AC-13) against it at build time and flag any conflict before building.
- [ ] Root `AGENTS.md` lists `npm` commands while the repo uses `pnpm` (spec `_root/0006`). Update it when `/sync` runs.
- [ ] Do the sign in page (`/`) last (task 13). Spec 0003 (shared sign in) may rewrite it.
- [ ] If the house is later installed to a phone home screen, revisit `viewport-fit=cover` and safe area padding.
- [ ] The search box searches nothing yet. When it becomes real, check the drawer placement and results layout on a phone.
