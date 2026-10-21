# End-to-end pass (random inputs)

`api-test-end-to-end.mjs` builds a project from nothing and books it, then checks that the modules agree with each other. Every run picks new random areas, prices, plan splits, GST rate (0/1/5/12/18%), PLC type and add-on type, and prints its seed (`SEED=123 node api-test-end-to-end.mjs` repeats a run).

1. **Build:** company → project → two towers → 6–10 units → unit location + PLC rate (flat or per sq ft) → GST slab, rate and mapping → payment plan with a random split of 100% (a further 0.5% is refused) → add-on charge billed on random rows.
2. **Book 2–4 random units** (create, then complete): checks each booking keeps the PLC it was offered, has one demand per plan row, carries add-on = master amount × the % set on the plan, and the unit leaves "available".
3. **After booking:** double booking refused (409); the booked unit's price, the plan, the GST rate that priced it, and the plan's deletion are all locked; an unbooked unit can still be re-priced; rate report, unit list and tower summary add up; money received on the first instalment blocks cancelling add-on billed there; role checks (sales executive, read-only) hold.
4. **Random bad input:** 400 random requests (`FUZZ=2500` for more) to 30 set-up and booking endpoints, plus 120 random query strings, using values such as `1e308`, null bytes, text-direction characters, SQL, markup, very long text, impossible dates, nested objects, broken JSON. None may answer with a server error.
5. **Books still balance:** units, demands, PLC amounts and the GST rate are unchanged after all of that.

**What the first runs found and fixed:** completing a booking failed with a server error on every database built from the migrations (the code saves the allocation as `booked`, the enum never had that value; migration 109 adds it); a second booking of a unit gave 500 instead of 409; Booking and Applicant endpoints answered bad ids, huge numbers, too-long text and null bytes with 500 (now 400); a name sent as a number or list crashed Add Applicant; the booking list took page and page size without checking.
