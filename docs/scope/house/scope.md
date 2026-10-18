# Scope: DHI student house (the dashboard)

The student house is the dashboard where a student lives after the funnel brings them in: home, exams, meals, mood, habits, modules, blog, DHI desk, study hour, counseling and progress. It runs on local demo data for one seat today. This scope covers work on the house screens themselves. The work that joins the house to the funnel's platform lives in [the repo wide scope](../_root/scope.md), and the big backend plan stays under Deferred there.

**Build approach:** Tracer Bullet (vertical slices, each built end to end, working). For responsive work that means one thin thread first: the page frame and one room working at phone, tablet and desktop widths, then the other rooms one by one. (basis: tracer bullet practice, the same approach the repo wide scope uses)
**Workflow:** Alpha (after develop: `/check verify`). The project default level of rigor for the house, chosen because this is a screen change on demo data with no student records at risk. `/architect` is the recommended first stop for a feature with a real decision, but skippable when you already know the build. Any feature can carry its own tag (e.g. `· Beta`) to do more or less. (your call, 2026-10-18)

_These are recommendations to keep your build orderly, not requirements. Skip anything that does not fit: if you already know how to build a feature, use `/develop` and skip `/architect`. You decide when a feature is `done`._

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| A | Student house screens on demo data | Existing | existing |
| 1 | Make the app responsive | Slice 1 | in-progress |

## Already built (for context)

### A. Student house screens on demo data · existing
All the rooms as screens, with local demo data for one seat. No real backend yet. code in `src/`, the backend brief in `BACKEND.md`

## Slice 1: works on every screen size

### 1. Make the app responsive · in-progress
Every room of the house reads and works well on a phone, a tablet and a desktop. That covers the side menu, the cards and grids, the calendar and charts, tables and lists, forms, and touch sized buttons. It does not change what any room does, and it keeps the room rules in `BACKEND.md`.
**Done when:** every room opens at phone, tablet and desktop widths with no sideways page scroll, nothing is cut off or overlaps, the menu can be opened and used by touch on a phone, and the controls are easy to tap.
- [x] Design it (spec): `/architect make the app responsive`
- [x] Build it: `/develop make the app responsive`
   - [x] The thread: sweep script, top bar and drawer, shared Sheet, Home at four widths (AC-1 to AC-9, AC-14, AC-15, AC-18)
   - [x] Exams, Mood, Meals and Habits on a phone (AC-7 to AC-11, AC-14, AC-15)
   - [x] Modules, Blog, Study hour and DHI desk on a phone (AC-5 to AC-9, AC-12, AC-13)
   - [x] Sign in page, placeholder rooms, desktop unchanged and room rules kept (AC-5, AC-16, AC-17)
- [x] Verify it: `/check verify make the app responsive`
Spec [0001](../../specs/house/0001-make-app-responsive.md) · code in `src/routes/home.tsx`, `src/components/dhi/`, `src/styles.css`, `scripts/responsive-*`

## Deferred

Out of scope for this pass.

- **Student house backend and the dashboard build**: tracked under Deferred in the [repo wide scope](../_root/scope.md) (Master Spec phases, DHI desk build, other houses)

## Legend

**The decision box.** Every feature carries exactly one, the sub task whose label ends with `(spec)`. Its wording varies (`Design it (spec)` normally), so skills locate it by that `(spec)` suffix, never by an exact label. Every other box is an execution box and `/architect` never ticks one.

**Feature lifecycle**: the scope updates as a feature moves; each row is what it shows and who sets it:

| State | Set by | The feature shows |
|---|---|---|
| `planned` · needs a decision | `/scope` | one box: `Design it (spec): /architect <feature>` |
| `in-progress` (designed) | **`/architect` at spec capture** | `Design it` ticked; spec linked; `Build it: /develop <feature>` + 2 to 5 milestones; the tier's closing boxes (`Verify it`, `Test it`, `Review it`, `Document it`) |
| `in-progress` (building) | `/develop` | milestone sub boxes tick one by one; code pointer filled |
| `in-progress` (verified) | `/check verify` | `Build it` and milestones ticked; `Verify it` ticked |
| `done` | **you, when you decide it is**; `/sync` reconciles | boxes you ran ticked, skipped ones marked skipped |

- **Next step** = the first unticked box (always a command or a tracked milestone).
- **needs a decision** = run `/architect` first; otherwise straight to `/develop`. The tag drops once the spec is captured.
- **Status** `planned`, `in-progress`, `done`, plus `existing` (before the workflow) and `dropped` (de scoped, kept for history).
- **Workflow** (header line) is the project default, what runs after `/develop`: Alpha = `/check verify`.
- **Pointer line** (`spec <n> · code in <path>`): the spec link added by `/architect`, the code path by `/develop`.

## References

**Project sources**
- `AGENTS.md` (root): the house stack (TanStack Start, React 19, Tailwind CSS 4) and the rules on not labelling students
- `BACKEND.md`: the room rules and the "Do not" list that every screen change must keep
- `docs/DHI Desk Design v1.pdf`: the desk design, which any responsive pass on the desk room should respect

**Practices and standards**
- Mobile first layout: design for the narrowest screen, then add room as width grows
- Touch target size: controls large enough to tap without mistakes (WCAG 2.2 target size guidance)
