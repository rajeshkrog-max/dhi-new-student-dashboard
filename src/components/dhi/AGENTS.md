# House room components (`src/components/dhi`)

## Overview

The screens of the student house: one component per room, plus the shared frame pieces (menu, Sheet, bell). Rooms read their demo stores from `src/lib/dhi/` (see its AGENTS.md). The layout was made responsive under spec `house/0001`; the rules below keep it that way when a room changes.

## Key files

| File | Owns |
|---|---|
| `house-menu.tsx` | The room list, Leave and the exam lock. Rendered in the side menu and in the phone drawer, so both read the same `NAV` list (in `src/routes/home.tsx`) and the same `locked` state |
| `sheet.tsx` | The one pop up and side panel, on Radix Dialog. `side` is `left` (menu drawer), `right` (room side panels, full width below 640 px) or `bottom` (forms below 640 px, a centred dialog from 640). Caps at 90dvh and scrolls inside |
| `notification-bell.tsx` | The bell and its dot. One component, shown in the top bar below 1024 px and in the page header from 1024 px |
| `room-actions.tsx` | Slot for a room's header actions (`ROOM_ACTIONS_ID`) |
| `enter-screen.tsx` | The Enter screen (Google, the dev only test form, the demo link), used by `/` and the front door `/enter` (spec 0008) |
| `notification-bell.tsx` | The bell in the top bar and the wide screen header (it is drawn twice, so a browser proof must use `:visible`). It lists what `waiting.mine` returns, each with a button into its room (house spec 0017) |
| `convex-session.tsx` | The one place the Convex client and the shared sign in provider are joined, plus the neutral waiting screen |
| `house-screens.tsx`, `house-session.tsx`, `join-page.tsx`, `staff/` | The people screens (house spec 0002): not in a house, paused, the Join step, and the staff area with its sections (`parent-consent-section.tsx` is the school's parent consent screen, house spec 0005) |
| `funnel-link-card.tsx` | The card on Your data that links the student's DhiRise check to the house, or unlinks it. Link and download only: the card says erasing here does not erase the check |
| `consent-screen.tsx`, `your-data.tsx` | What a student sees before they enter (the notice, I agree locked until the end is read, waiting for the school) and Your data (consent, parent sharing, who has looked, download, erase). `/dashboard` shows `LockedHouse` for `consentNeeded` and `withdrawn`; Your data is also a menu item (house spec 0005) |
| `parent-page.tsx` | The weekly parent page at `/parent#<code>` (house spec 0022): no sign in, no Convex session, one call to `parentReport.open` through `ConvexHttpClient`, English and Hinglish. It shows only what comes back. A Worker route `dhirise.com/parent*` carries it |
| one folder or file per room | `sleep-tracker.tsx`, `mood-tracker.tsx`, `habits/`, `meals/meals-real.tsx`, `exams/exams-room.tsx`, `modules/modules-real.tsx`, `blog/blog-real.tsx`, `study/study-hour-real.tsx` (with the after session card, and for a Live seat the hour's call: `study/hour-call.tsx`, loaded only when joined, and `study/hour-recordings.tsx`; house spec 0027), `brain/brain-report.tsx` (the Progress page), `home-score.tsx` (the score card on Home). `desk/desk-real.tsx` (the DHI desk: coins, saved talks, ask, feedback on the student's own writing, practice questions on a topic (five, or a longer set of ten), a study story, a checked diagram, ask about the answer, the care words; house spec 0016). `counsel/` (house spec 0024): `counsel-room.tsx` (the student's bookings, free times and shared recordings), `counsel-call.tsx` (the Stream call, loaded only when opened: a lobby, then the call with the house's own named buttons) and `counsel-recordings.tsx`. The mood help button opens Counseling |
| `staff/` sections | `papers-section.tsx` (build, send, mark, review posts and hours), `results-section.tsx` (the institute admin's marks), `foods-section.tsx`, `films-section.tsx`, `hour-section.tsx`, `desk-section.tsx` (the DHI admin's monthly coins for the desk), `counsel-section.tsx` (the counselor's Sessions, and recordings shared with any staff member under Your data), `data-section.tsx` (a staff member's own download), `school-report-section.tsx` (the school report, house spec 0025: the institute admin and teachers), `hour-calls-section.tsx` (Hour calls for teachers and DHI admins: moderate the open hour, watch and share its recordings), `home-section.tsx` (Home, the first screen of every staff role but a counselor), `overview-section.tsx` and `counselors-section.tsx` (the DHI admin's, house spec 0026), `student-papers.tsx` (a teacher's page for one student, from My students), and the class pause on `classes-section.tsx` |

## Conventions

- Phone changes are gated to the `touch` variant (`@custom-variant touch` in `src/styles.css`: coarse pointer, or under 1024 px) or to a width below 1024 px. From 1024 px up the look stays as it was. Do not scatter `max-lg:` classes where `touch:` says the same thing.
- On touch, tap targets are at least 44 by 44 px and text a student reads is at least 12 px. The narrowest supported screen is 360 px.
- Use `dvh`, never `h-screen`. Rooms that fill the frame (DHI desk, Study hour) get a viewport based height below 1024 px.
- Pop ups and side panels use `Sheet`, not a new modal. Motion uses `motion-safe:` only.
- Sweep hooks: `data-room="<id>"` on each menu item, `data-testid="menu-button"` on the menu button, `data-decorative` on badges exempt from the size check, `data-scroll-x` on a box that scrolls sideways on purpose. Keep them when you restructure a room.
- Room rules in `BACKEND.md` ("Rooms in this repo" and "Do not") stay with the room. A responsive change never changes what a room does.

## Commands

```bash
pnpm dev                 # the sweep needs the dev server on localhost:8080
pnpm responsive:sweep    # visits every room at 360, 768, 1024 and 1280 px; exits non zero on overflow, small targets or small text
```

## Gotchas

- A frozen room (an exam is running) must never open from the drawer. Both menus get this from `locked`, so do not add a second room list.
- Do not set `viewport-fit=cover`. Revisit it only if the house is installed to the home screen.
- Rooms are not routes yet, so the Android back button leaves the page instead of closing the drawer.
- Stream's prebuilt call buttons have no accessible name, so both calls draw the house's own (`call/device-buttons.tsx`: microphone, camera, share screen; and leave) from Stream's hooks, hide the tile menu, and give the tile names and initials Stream's light text (`.dhi-call` in `styles.css`). Keep it that way when the SDK is upgraded, and rerun axe on the calls.
- A call screen leaves its call in one place only, the cleanup that ends its client. A second leave on unmount leaves the call React's development mode just joined (house spec 0027).

## Related specs

- [house/0001 make the app responsive](../../../docs/specs/house/0001-make-app-responsive.md)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
