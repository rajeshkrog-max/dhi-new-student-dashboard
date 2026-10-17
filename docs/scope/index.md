# Scope map: DHI, one app

DHI is one product with two parts in this repo. This page maps where each part's scope lives and how far along it is.

| Part | Scope | Where it lives | Rollup |
|---|---|---|---|
| Repo wide (combine both parts onto one platform) | [_root/scope.md](_root/scope.md) | `docs/scope/_root/` | 1 of 15 done (row 1), 2 in progress (rows 2 and 3, with their specs captured), plus 2 enrolled for context |
| DhiRise student funnel (live at dhirise.com/dhiinterviews) | [scope.md](../../apps/joining/docs/scope/scope.md) | `apps/joining/docs/scope/` | 1 of 35 done, 23 in progress, 9 planned, 2 existing (counted from its At a glance table on 2026-10-17) |
| Student house (the dashboard) | not scoped yet | `src/` | Deferred until the repo wide work is done. The plan to start from is the Master Spec and the Desk Design in `docs/`, listed under Deferred in the repo wide scope |

The funnel's scope stays in its own folder so its rows, specs and links keep working. It is linked here, not copied, so the two cannot drift. Cross part work (one database, one account, one host, the move itself) lives in the repo wide scope.
