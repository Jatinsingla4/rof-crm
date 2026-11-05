# Plan integrity note (which plan document is available, and what it can and cannot be used for)

**Status: the plan file `USERS_ROLES_OWNER_POLICY_FINAL_PLAN(7).md` (v7) is MISSING. Only the older Desktop copy (called "v6" by the owner) is available.
Nothing here treats v6 as the final approved plan, and nothing reconstructs v7.**

| | v7 (the file the implementation phases used as the source of truth) | v6 (the only copy available now) |
|---|---|---|
| Path | `/Users/ketansingla/Downloads/USERS_ROLES_OWNER_POLICY_FINAL_PLAN(7).md` | `/Users/ketansingla/Desktop/ROF_USERS_ROLES_AUDIT/USERS_ROLES_OWNER_POLICY_FINAL_PLAN.md` |
| Present now | **No.** Not in Downloads; a search of the home directory (four levels deep) found no other copy | Yes |
| Size | 1,147 lines when it was read in an earlier session (not re-verifiable now) | 1,113 lines, 266 KB, file date 2026-11-04 14:45 (the folder's `SNAPSHOT_TIME.txt` says `2026-11-04T05:45:52Z`) |
| SHA-256 | unknown (the file is gone) | `cb03f8b85df7c177307d27f48dd989ba9b8181ac02b507fd1c58f96cab0f4980` |
| Revision | the owner's latest | its own closing record describes a "fourth revision" with addenda up to 6; the owner calls it v6 |

## What this means
- **The two files differ** (1,147 against 1,113 lines). I cannot say which statements differ. Any quotation in the decision-support documents taken from v6 is marked as such and may not match v7.
- **The implementation phases were built from v7.** They cannot now be re-checked line by line against it. Their evidence is the commits, tests and tracker, not a re-read of v7.
- **Owner-decision wording in these documents** (Q-D1 to Q-D5, Q-F4, Q-U1 to Q-U3, Q-A1, F1 to F17, gates G1 to G14) comes from the v6 copy where it is quoted, and from the tracker where it is not. If v7 changed any of them, **v7 wins**; supply the file and the quotations will be re-checked.
- **Do not edit or "restore" v7 from memory.** The plan is the owner's document. If a copy exists elsewhere (another machine, mail, a chat attachment), put it back in `/Users/ketansingla/Downloads/` or tell me where it is; until then v7 stays recorded as missing.

## How to review this note
Check the two rows "Present now" and "SHA-256": if you have the v7 file, compare its size and line count with the table; if you have the v6 file, its SHA-256 should match the value above (`shasum -a 256 <file>`).
