# Verify: one professional look · spec 0003 · updated 2026-10-19
_Steps derived from spec 0003 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._
Setup for the browser steps: `pnpm --filter dhirise build`, then `pnpm dev` (port 8080), development backend only, `VITE_TEST_SIGNIN=true` in `.env.local`.

## UI / manual
- [x] Open `/enter` signed out at 360, 768 and 1280 px, in day and in night → one card from the kit, kit buttons and fields, no sideways scroll, every `landing-*` hook present, video still plays → AC-3, AC-11
- [x] Night Enter card over the brightest frame of the video: every line is readable → AC-3
- [x] Open `/dashboard` with the sign in calls held back (the sweep scenes `wait-dashboard` and `slow-dashboard` do this) → dashboard skeleton with the real frame and no room names; the slow line and Try again appear only after 8 seconds → AC-5, AC-6
- [x] Release the held calls (`settle-dashboard`, `settle-door`) → real screen replaces the skeleton, layout shift under 0.05 → AC-5
- [x] Open `/dashboard/nothing-here` and `/enter/nothing-here` → "This page is not here", brand top bar, one Back to the house button leading to `/dashboard` and `/` → AC-4, AC-7
- [x] Open `/dashboard?__throw=1` (dev only) → "Something went wrong" with Try again and Back to the house, the raw text only in the console → AC-7
- [ ] Open `/dashboard?__throw=room` (dev only) → "This room paused" in the room's place with the menu still working, no raw text, Open again clicks → AC-7, AC-12
- [x] Tab through the door, the dashboard and an error page → a visible ring on every stop, none on mouse clicks → AC-8
- [x] Sit an exam, then open the side menu (1280) and the drawer (360) → the same "Exam is going on" line in both, the other ten rooms and Leave cannot be pressed → AC-4, AC-12
- [x] Compare the side menu and the drawer → same brand mark, profile card, item style and active style → AC-4
- [x] Open any page with the network log open → no request to `fonts.googleapis.com` or `fonts.gstatic.com`; in a production build the two font files load from `/assets/` → AC-10
- [x] Reload the door and dashboard on a slow connection → no dark flash behind any page, text does not jump when the fonts arrive → AC-1, AC-10

## Commands
- [x] `pnpm responsive:sweep` → every room, scene, the door, error, not found and each loading screen are ok at 360, 768, 1024 and 1280 → AC-11, AC-13
- [x] `pnpm look:check` → ok within the baseline; add a stray `#c45c4a` to a component and it fails, add `look-ok: reason` on that line and it passes → AC-13
- [x] `node --test scripts/look-check.test.mjs scripts/responsive-verdict.test.mjs scripts/local-dev-guard.test.mjs` → all pass → AC-13
- [x] `pnpm typecheck && pnpm lint && pnpm test && pnpm build:all` → all green → AC-2
- [x] Search the production `dist/client` for `thrown on purpose` → no match (the dev throw hook is gone) → AC-13
- [x] `pnpm enter:check` → 18 of 18 steps pass (door hooks unchanged) → AC-3, AC-12
- [x] Contrast of every small text pair on the page, white cards, tinted cards, the night Enter card over pure white and black, and the dark panels → each at least 4.5 to 1, focus ring at least 3 to 1 → AC-3, AC-8, AC-9

## Value sourcing (one step per row of the spec's table)
- [x] Hold the calls 8.5 seconds on `/dashboard` → the slow line shows once `SLOW_WAIT_MS` (8000) has passed, and not at 1 second → AC-6
- [x] "Back to the house" from `/enter/x` goes to `/` and from `/dashboard/x` goes to `/dashboard` (`backToHouse` in `src/lib/entry.ts`, unit tested) → AC-7
- [x] Try again on a route error calls `reset()` and `router.invalidate()` (remove `?__throw=1` from the address, press Try again, the dashboard returns) → AC-7
- [x] Error, not found and loading screens show no student name or class, even for a signed in student (the sweep checks the name) → AC-4, AC-7
- [x] Menu profile card shows the signed in student's own name, initials and class from `useStudent()` → AC-4
- [x] Menu rooms and the lock come only from the one `NAV` list and the one `locked` state in `src/routes/home.tsx` → AC-4
- [x] Skeleton switches from top bar to side menu exactly at 1024 px → AC-5
- [ ] Change one token in `@theme` (for example `--color-gold`) → every use changes and no component holds the old value (`pnpm look:check`) → AC-1
- [x] The `mute` value in `src/styles.css` measures at least 4.5 to 1 on `#f4f0ea`, on white, and on every tinted card → AC-9

## Acceptance-criteria coverage
- AC-1 tokens and page colour: styles, look:check, reload step · AC-2 kit: typecheck and build, build:all · AC-3 door: Enter steps, contrast, enter:check · AC-4 menu and neutral pages: lock step, menu compare, not found step
- AC-5 skeletons: wait and settle steps, breakpoint step · AC-6 slow wait: wait and slow steps · AC-7 error and not found: the four page steps and Try again
- AC-8 focus ring: tab step, contrast · AC-9 mute: contrast, token step · AC-10 fonts: network step · AC-11 four widths: sweep · AC-12 rooms unchanged: sweep, lock step, room paused step · AC-13 proof: sweep, look:check, tests
