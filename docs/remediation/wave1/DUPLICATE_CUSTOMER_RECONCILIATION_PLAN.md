# Duplicate customer reconciliation plan (QA-022, QA-028)

Status: a plan and a read-only finder. No customer is merged, deleted or changed by anything in this branch, and none may be without ROF's written approval of each case.

## 1. Find (read only)

Run [duplicate-customers-DRYRUN.sql](duplicate-customers-DRYRUN.sql) on a copy of production. It lists applicants sharing a PAN, mobile, Aadhaar (by hash), e-mail, registration number or form number, booking numbers that disagree with the applicant record, names out of step with their parts, and, for each group, what hangs on the applicant (bookings, plans, receipts, demands, allocations). Queries 1 to 7 are evidence; query 8 (same name) is only a hint, two people can share a name.

## 2. Classify (ROF Finance and Sales operations, per group)

| Case | Meaning | Action |
|---|---|---|
| Same person, two records | one customer entered twice | choose the surviving record; merge by the steps in section 3 |
| Same person, one record is only a lead | no booking, plan or receipt on it | can be retired after approval, history kept |
| Shared contact, different people (family, an office number, a broker) | not a duplicate | leave, and record why |
| Reused registration or form number | two applicants hold one number | ROF decides which keeps it; the other gets a new number through the normal screen (the software now refuses a duplicate on edit) |
| Stale display name | `name` differs from the first and last name | correct through the normal edit (it now keeps `name` in step) |

## 3. If ROF approves a merge (not built, to be agreed first)

A merge is not a delete. Per approved pair:
1. Freeze both records for the run; take a backup and a before report (bookings, plans, demands, receipts, allocations, commissions, documents, communications, loans, parking, co-applicants).
2. Choose the surviving record; keep its identity numbers; keep the other's numbers in a mapping table (`old id, new id, who approved, when`).
3. Re-point the dependent rows in one transaction, one table at a time, checking totals before and after (receipts total, demands total, cleared money, bookings, unit links). A unit can be held by one applicant only; if both hold a unit the pair is not a duplicate, it is two customers.
4. The retired record is marked, not deleted; its audit history stays; the audit log gets one entry naming both ids and the approver.
5. Run the money reconciliation (Customer Wise Balance, the reconciliation lists) before and after and attach both.
6. Rollback: the mapping table and the before report allow the rows to be pointed back; keep them for the retention period.

## 4. Controls already in the software (this branch)

- A registration or form number cannot be written onto an applicant if another applicant (or another applicant's booking) holds it, whether through the applicant edit, the booking edit or a document edit (case and spaces ignored).
- A document edit of a name keeps the stored display name in step with the first and last name.
- PAN and mobile duplicates per project were already refused on create and edit.

## 5. Not covered, needs ROF's decision

- Scope of uniqueness: per project (today) or across the company.
- Whether an Aadhaar or e-mail match blocks a save or only warns (neither is checked today; Aadhaar is stored as an unsalted hash).
- Whether a co-applicant may share a PAN or mobile with another customer (a spouse on two units is normal); co-applicants are not run through the duplicate check today.
- Whether a cancelled booking's numbers may be reused; the unique index counts them and the form-number check does not (a raw database error can surface).
- Whether the unique indexes (migration 149) exist in production: they are created only when no duplicates exist, so production may have none. Run the finder first.
