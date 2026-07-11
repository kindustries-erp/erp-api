# Lessons Learned — Voucher Journal Trigger Fields

- ID: LL-2026-05-001
- Date: 2026-05-10
- Task Link: docs/tasks/task-02-posted-vouchers-journal-fix.md
- Owner: Hermes Agent

## Context
ERP FIX for AR/AP `open_amount`, removal of Journal Entry Draft state, and automatic Journal Entry creation when vouchers are posted.

## Issue / Symptom
DB smoke for the payment voucher posted trigger initially failed with:
- `record "new" has no field "updated_by"`

A preceding smoke insert also failed on existing payment voucher constraints when the test payload omitted a required external counterparty.

## Root Cause
The trigger implementation assumed `payment_vouchers.updated_by` existed. The actual staging schema has `created_by`, `approved_by`, but no `updated_by` column. Smoke data also must satisfy `gw_payment_vouchers_counterparty_target_chk`: external vouchers need `counterparty_id` and must not use `employee_id`.

## Fix Applied
- Replaced trigger `created_by` source with `COALESCE(NEW.approved_by::text, NEW.created_by::text)`.
- Updated smoke payload to include a valid `business_partners.id` as `counterparty_id` for `counterparty_source='EXTERNAL'`.
- Re-ran smoke transaction and verified posted payment vouchers create one posted Journal Entry and two balanced Journal Entry Lines.

## Preventive Action
Before writing DB triggers against runtime tables, inspect actual table columns and constraints with `information_schema.columns` and `pg_constraint`; then make smoke inserts satisfy all existing check constraints, not only the fields under change.
