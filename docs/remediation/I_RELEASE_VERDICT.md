# I. Release verdict

**FAIL**

Reasons, none of which a green local suite changes:
1. Nothing is deployed, committed or merged. The live build is still `976afd9`, which the retest failed.
2. The P0 financial figures (QA-032, QA-001, QA-005) are fixed in code and in tests, but were not read against the real bookings, and QA-001 and QA-005 depend on ROF decisions (PLC GST, discount basis).
3. QA-002, QA-003 and A-101 need approved financial years, GST slabs, project GSTIN and rounding rules from ROF. Invoicing is blocked until they exist.
4. QA-008 and QA-009 are held behind flags that stay off, and QA-010 depends on the Super Admin policy.
5. No browser test ran, the `dist` is not rebuilt, and the owner sign-offs (malware clean-up, credential rotation) are not evidenced.

What the work does establish: one place each for the cancelled-booking rule, the per-head GST rule and the money rule; 29 unit tests and 51 database and HTTP checks pass from a clean database; every historical inconsistency found is listed, not repaired.

Path to CONDITIONAL: rebuild `dist`, commit and run CI, deploy to a staging project, run H against real figures, and get answers to the register in E for BR-02, BR-03, BR-07 and the discount basis.
