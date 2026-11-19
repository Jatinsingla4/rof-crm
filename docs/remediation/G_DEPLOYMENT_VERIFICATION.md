# G. Deployment verification

**Not deployed.** Nothing from this work is on the live site. The live build stays `976afd9`.

| Item | State |
|---|---|
| Commit | none, working tree only on `fix/remediation-batch1` |
| CI run | none for this work (run 44084084928 belongs to `976afd9`) |
| Target environment | not chosen; the throwaway local database is not a staging environment |
| Migrations | none to apply |
| Feature flags | unchanged, nothing was switched |
| `/api/health` | the local build reports `commit: null`, so it can only be checked after a real deploy |
| Smoke test | not run on any deployed build |

Steps for release, in order: rebuild `packages/api/dist`; review the diff; commit on the owner's word; open a pull request; wait for CI; deploy only through the authorised workflow; check `/api/health` shows the new commit; run the smoke list in H; leave every financial flag off until finance approves.
