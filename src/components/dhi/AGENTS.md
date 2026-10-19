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
| `convex-session.tsx` | The one place the Convex client and the shared sign in provider are joined, plus the neutral waiting screen |
| `house-screens.tsx`, `house-session.tsx`, `join-page.tsx`, `staff/` | The people screens (house spec 0002): not in a house, paused, the Join step, and the staff area with its sections (`parent-consent-section.tsx` is the school's parent consent screen, house spec 0005) |
| `consent-screen.tsx`, `your-data.tsx` | What a student sees before they enter (the notice, I agree locked until the end is read, waiting for the school) and Your data (consent, parent sharing, who has looked, download, erase). `/dashboard` shows `LockedHouse` for `consentNeeded` and `withdrawn`; Your data is also a menu item (house spec 0005) |
| one folder or file per room | `mood-tracker.tsx`, `meal-tracker.tsx`, `papers-desk.tsx`, `habits/`, `modules/`, `blog/`, `study/`, `desk/` |

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

## Related specs

- [house/0001 make the app responsive](../../../docs/specs/house/0001-make-app-responsive.md)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
