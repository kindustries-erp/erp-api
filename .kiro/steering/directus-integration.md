---
inclusion: fileMatch
fileMatchPattern: "src/**/*.service.ts"
---

# Directus Integration Guide

## Two Client Modes

### 1. Admin Client (global, injected)
For privileged operations: user management, schema reads, cross-user queries.

```typescript
@Inject(DIRECTUS_CLIENT) private readonly directus;

// Usage — runs as admin regardless of caller
await (this.directus as any).request(readUsers({ filter: { ... } }));
```

### 2. User-Scoped Client (per-request)
For operations that must respect the caller's Directus permissions.

```typescript
private getUserClient(token: string) {
  const url = this.config.getOrThrow<string>('DIRECTUS_URL');
  return createDirectus(url).with(staticToken(token)).with(rest());
}

// Usage — respects user's role/policy permissions
const client = this.getUserClient(token);
await client.request(readItems('gw_payment_vouchers', { ... }));
```

**Rule:** Always prefer user-scoped client unless the operation requires admin privileges.

## Common Directus SDK Operations

```typescript
import {
  readItems, readItem, createItem, createItems,
  updateItem, updateItems, deleteItem, deleteItems,
  readUsers, createUser, updateUser,
  aggregate,
} from '@directus/sdk';

// Read with pagination + filter
await client.request(readItems('gw_collection', {
  limit: pageSize,
  offset: (page - 1) * pageSize,
  sort: ['-created_at'],
  filter: { status: { _eq: 'ACTIVE' } },
  fields: ['id', 'name', 'related_id.*'],
}));

// Count
await client.request(readItems('gw_collection', {
  aggregate: { count: ['id'] },
  filter: { ... },
}));

// Create
await client.request(createItem('gw_collection', payload));

// Update
await client.request(updateItem('gw_collection', id, payload));

// Delete (hard)
await client.request(deleteItem('gw_collection', id));
```

## Filter Syntax (Directus)

```typescript
const filter: Record<string, any> = {};

// Exact match
filter.status = { _eq: 'CONFIRMED' };

// In list
filter.voucher_type = { _in: ['CASH_RECEIPT', 'CASH_PAYMENT'] };

// Date range
filter.voucher_date = { _gte: startDate, _lte: endDate };

// Text search (contains)
filter.description = { _contains: searchTerm };

// Null check
filter.deleted_at = { _null: true };

// Nested relation
filter.department_id = { name: { _contains: 'IT' } };

// Logical AND (default) / OR
filter._or = [
  { voucher_no: { _contains: search } },
  { description: { _contains: search } },
];
```

## Collection Naming Convention

All custom collections: `gw_<domain>_<entity>` (plural)
- `gw_payment_vouchers`
- `gw_payment_voucher_attachments`
- `gw_payment_voucher_approval_logs`
- `gw_employees`
- `gw_departments`
- `gw_positions`
- `gw_business_partners`
- `gw_business_partner_bank_accounts`
- `gw_cash_funds`
- `gw_company_bank_accounts`
- `gw_chart_of_accounts`
- `gw_accounting_accounts`
- `gw_opening_balances`
- `gw_voucher_numbering_configs`
- `gw_journal_entries`
- `gw_journal_entry_lines`

## Relational Fields

Directus uses `*` notation for deep fields:
```typescript
fields: ['*', 'department_id.*', 'position_id.name']
```

## Error Mapping

Always wrap Directus calls with error handling:
```typescript
try {
  const result = await client.request(readItems(...));
  return result;
} catch (error) {
  throwDirectusSdkError(error, 'Không thể đọc dữ liệu');
}
```
