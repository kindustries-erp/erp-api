# Inventory Audit Handoff

- GeneratedAt: 2026-07-11T13:22:25
- TotalMismatchRows: 4210
- SourceFolder: docs/tasks/artifacts/20260711-inventory-audit

## Phase Counts

- receipt-line-vs-txn: 34
- production-gi-lines-vs-txn: 4046
- sales-delivered-vs-gi-lines: 11
- balance-vs-ledger: 119

## Top 20 Largest Absolute qty_diff

| phase_key                  | primary_ref    | item_id                              | qty_diff |
| -------------------------- | -------------- | ------------------------------------ | -------: |
| production-gi-lines-vs-txn | XK-20260603-51 | 87dc9ea0-dd94-4501-8c03-11bc2e67d684 | -600.000 |
| production-gi-lines-vs-txn | XK-20260603-52 | 87dc9ea0-dd94-4501-8c03-11bc2e67d684 | -600.000 |
| production-gi-lines-vs-txn | XK-20260523-51 | 87dc9ea0-dd94-4501-8c03-11bc2e67d684 | -600.000 |
| production-gi-lines-vs-txn | XK-20260523-51 | ff3e0b1a-7f57-46cf-ad64-881d461e9eab | -465.000 |
| production-gi-lines-vs-txn | XK-20260603-51 | ff3e0b1a-7f57-46cf-ad64-881d461e9eab | -465.000 |
| production-gi-lines-vs-txn | XK-20260603-52 | ff3e0b1a-7f57-46cf-ad64-881d461e9eab | -465.000 |
| production-gi-lines-vs-txn | XK-20260523-51 | 6d99150f-927c-4d2c-974c-28a5bcd3a4a3 | -450.000 |
| production-gi-lines-vs-txn | XK-20260603-51 | 6d99150f-927c-4d2c-974c-28a5bcd3a4a3 | -450.000 |
| production-gi-lines-vs-txn | XK-20260603-52 | 6d99150f-927c-4d2c-974c-28a5bcd3a4a3 | -450.000 |
| production-gi-lines-vs-txn | XK-20260603-51 | c4863812-a2b4-4175-99a9-79334ef73558 | -420.000 |
| production-gi-lines-vs-txn | XK-20260523-51 | c4863812-a2b4-4175-99a9-79334ef73558 | -420.000 |
| production-gi-lines-vs-txn | XK-20260603-52 | c4863812-a2b4-4175-99a9-79334ef73558 | -420.000 |
| production-gi-lines-vs-txn | XK-20260520-54 | 87dc9ea0-dd94-4501-8c03-11bc2e67d684 | -360.000 |
| production-gi-lines-vs-txn | XK-20260523-51 | ec90fbde-a900-41f3-9ec4-f79f8d104392 | -360.000 |
| production-gi-lines-vs-txn | XK-20260603-51 | ec90fbde-a900-41f3-9ec4-f79f8d104392 | -360.000 |
| production-gi-lines-vs-txn | XK-20260603-52 | ec90fbde-a900-41f3-9ec4-f79f8d104392 | -360.000 |
| production-gi-lines-vs-txn | XK-20260520-55 | 87dc9ea0-dd94-4501-8c03-11bc2e67d684 | -320.000 |
| production-gi-lines-vs-txn | XK-20260520-57 | 87dc9ea0-dd94-4501-8c03-11bc2e67d684 | -320.000 |
| production-gi-lines-vs-txn | XK-20260520-58 | 87dc9ea0-dd94-4501-8c03-11bc2e67d684 | -320.000 |
| production-gi-lines-vs-txn | XK-20260603-52 | eb4c2f31-9631-4528-a611-230f89f6027c | -300.000 |

## Notes

- File CSV da gom tat ca mismatch vao mot bang duy nhat.
- Cot row_json giu full payload de agent khac truy vet chi tiet.
