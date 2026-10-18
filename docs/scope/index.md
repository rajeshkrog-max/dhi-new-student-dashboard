# Scope map: DHI, one app

DHI is one product with two parts in this repo. This page maps where each part's scope lives and how far along it is.

| Part | Scope | Where it lives | Rollup |
|---|---|---|---|
| Repo wide (combine both parts onto one platform) | [_root/scope.md](_root/scope.md) | `docs/scope/_root/` | 2 of 18 done (rows 1 and 2), 1 in progress (row 3, built, verify next), 15 planned (rows 4 and 7 to 10 now verify the result, rows 16 to 18 added from spec 0001), plus 2 enrolled for context |
| DhiRise student funnel (live at dhirise.com/dhiinterviews) | [scope.md](../../apps/joining/docs/scope/scope.md) | `apps/joining/docs/scope/` | 1 of 35 done, 23 in progress, 9 planned, 2 existing (counted from its At a glance table on 2026-10-17) |
| Student house (the dashboard) | [house/index.md](house/index.md) | `docs/scope/house/` (index plus platform, rooms and brain) | 1 of 24 done (row 1, make the app responsive), 1 in progress (row 2, people, roles, invites and institutes, designed), 22 planned (every room on server data, the DHI Brain), plus 1 existing for context. Counseling and calls are deferred on purpose |

The funnel's scope stays in its own folder so its rows, specs and links keep working. It is linked here, not copied, so the two cannot drift. Cross part work (one database, one account, one host, the move itself) lives in the repo wide scope.
