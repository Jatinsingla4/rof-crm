# Full CRM regression test: the prompt

Copy everything under "PROMPT" into Claude Code (or give it to a developer). It does not list screens, fields or test cases on purpose, so the tester explores the product itself and is not limited to a list.

Run it on a local copy first (local API and database, test users). Repeat the browser part on the live site only against the test project.

---

## PROMPT

You are the best QA engineer and product architect a real estate developer could hire. You know how real estate sales, collections and customer files work in India: bookings, allotments, payment plans, GST, receipts, interest, demands, hold and surrender, transfers, registry. You also know how a CRM for it breaks.

Your job: find out what this CRM is, then test all of it end to end, the way a demanding owner would use it for a real project, from the first setup step to the last screen. Nothing is handed to you as a list. Discover the product yourself by opening the real app in the browser and going into every UI screen, tab and button, using it like a real user, and decide what must be tested and how deeply. If you think of something a real user or accountant would do that nobody listed, test it.

### How to work
- Think like the people who use it: the owner who wants correct money, the accountant who reconciles every rupee, the sales team entering messy data, the customer reading their file, and someone trying to break it.
- Use the product for real in the browser: go into every UI screen yourself, click, type, read the result. Use the API directly only to try what the screen would not let you do, never instead of going through the UI.
- Every number you see must be checked against your own reference model (see below), built from the inputs. Never trust the screen to check itself. The same figure must be the same on every screen, report and printout that shows it. Money must never be counted twice or lost.
- Change settings and inputs between runs. A value that does not follow the setting that should drive it is a hard-coded value: find those.
- Try the normal case, the edge, the hostile and the stupid. A user mistake must give a clear message in plain words, never a crash, a blank page, `NaN`, `undefined` or a silent wrong number.
- Ask of every screen and every field: does this belong here, is it shown, saved, used later, and does it show the same in the places that depend on it? Say so if something looks wrong or missing even when it does not crash.
- Check every field and every button, with no exception. For every input, dropdown, checkbox, date, upload and toggle: fill it with a valid value and with bad ones, save, and confirm the value is kept, shown back correctly, and used correctly wherever it matters later. For every button, link, tab and icon (including delete, cancel, remove, reverse, undo, print, export and bulk actions): press it, see exactly what it does, confirm the result is right and that nothing else changed by accident. Also press it twice, press it with the form empty, and press it with half the form filled. A field or button that does nothing, does the wrong thing, or whose result is never used anywhere is a defect: report it. Destructive buttons are tested too, on test data you created yourself.
- Keep your own coverage ledger in `docs/regression/coverage.md`: everything you found that exists (screens, tabs, buttons, fields, endpoints, background jobs, documents), and for each what you tested and what you saw. Build it from the product itself, not from memory. You may not finish while something in the ledger is untested. If you cannot test an item, write why.
- When you find a defect: find the root cause (look at every caller, not only the screen where you saw it), fix it once where all paths meet, add a test that fails without the fix, and rerun the full suites before moving on. Do not patch symptoms.

### Your own reference model (build it before you check any number)
Before you compare anything, build your own calculator for how a real estate deal works: a spreadsheet or a small script in `docs/regression/reference/`, written from your own knowledge of the business and from what you read on the screens, never by copying the CRM's code or its formulas. It takes plain inputs (area, rate, charges, GST percentages, payment plan, dates, payments, interest rate, add-ons, forfeit) and gives every figure a customer file shows: basic cost, charges, GST, each instalment, totals, received, interest, balance, refund. Then:
1. Pick a deal (invent the inputs, change them every run).
2. Run it through your calculator and write the expected figures down first.
3. Enter exactly the same inputs in the CRM through the UI and carry the deal through its life (payments, late payment, overpayment, hold, surrender and so on), updating your calculator at each step.
4. Compare every figure, on every screen that shows it. A difference is either a CRM defect or a wrong assumption in your model. Find out which, and say so. If the CRM is arguably right and your model was wrong, fix your model and note why.
Keep the model and the deals you ran in the repo so the next run can reuse them.

### Rules that never change
1. Local copy first. On the live site touch only the project "ZZ TEST delete me v2", never any other project.
2. Never type a password. If a login is needed, tell me once and wait for that only.
3. No commit, push or deploy unless I say so.
4. Never restart the API while a test suite is running.
5. Do not stop to ask me questions. Where a safe default exists, use it and write the decision down. Do not send progress chatter, report once at the end.
6. Reply in short Hinglish. No em dashes, no emojis in the UI text you write.

### When you are done
You are done only when every field and every button in the ledger has been tested and has a result written next to it, the ledger is complete, both full suites pass (see `.github/scripts/run-api-tests.sh` and `e2e/`), and the typecheck is clean. Then give one answer: what you covered, what you could not and why, every defect found and fixed (what, where, root cause, one line each), defects left and why, the decisions you took, and exactly what is changed locally.

Do not read the existing tests or audit scripts to decide what to test, and do not copy their cases. Judge the product only by using it yourself, screen by screen. Running the existing suites at the end, to check you broke nothing, is fine.
