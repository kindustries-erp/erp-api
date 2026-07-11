# Task: ERP Invoices Core — API scope

> **Created:** 2026-06-16  
> **Lane:** erp-core (Neon/Postgres)  
> **Repo:** `liouni-erp-api` (`/opt/repos/liouni-erp-core/liouni-erp-api`)  
> **Status:** DONE — verified build + tests PASS 2026-06-18  
> **Linked web task:** `liouni-erp-web/docs/tasks/20260616-172700-erp-invoices-and-po-invoice-field-web.md`

---

## Context

Yêu cầu từ PM 2026-06-16:
1. Gắn thêm field **số hóa đơn NCC** (`supplier_invoice_no`) vào đơn mua hàng
2. Tạo bảng hóa đơn mới `erp_invoices` trên Neon (Option B)
3. Expose qua API `erp-invoices-core` module mới

---

## Gate 0 — DB precheck

**Bảng hiện có liên quan:**
- `erp_purchase_orders` — cần thêm column `supplier_invoice_no`
- `erp_sales_orders` — FK target cho `erp_invoices.sales_order_id` (xác minh tên bảng thực tế trên Neon trước khi tạo FK)

**DB_GAP_FOUND** — cần migration trước khi code API.

---

## Scope 1A — Migration: `supplier_invoice_no`

**[NEW]** `src/migrations/20260616172700-add-supplier-invoice-no-to-po.ts`

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSupplierInvoiceNoPo20260616172700 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE erp_purchase_orders
        ADD COLUMN IF NOT EXISTS supplier_invoice_no VARCHAR(128) NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE erp_purchase_orders
        DROP COLUMN IF EXISTS supplier_invoice_no
    `);
  }
}
```

**Verify sau migration:**
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'erp_purchase_orders' AND column_name = 'supplier_invoice_no';
```

---

## Scope 1B — Migration: bảng `erp_invoices`

**[NEW]** `src/migrations/20260616172800-create-erp-invoices.ts`

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateErpInvoices20260616172800 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // NOTE: Kiểm tra tên thật của bảng sales orders trên Neon trước khi chạy
    // Run: SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%sales_order%';
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS erp_invoices (
        id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_no        VARCHAR(128) NOT NULL,
        serial_no         VARCHAR(64)  NULL,
        invoice_date      DATE         NOT NULL,
        direction         VARCHAR(16)  NOT NULL DEFAULT 'IN',
        status            VARCHAR(32)  NOT NULL DEFAULT 'DRAFT',

        seller_name       VARCHAR(255) NULL,
        seller_tax_code   VARCHAR(64)  NULL,
        seller_address    TEXT         NULL,
        seller_bank       VARCHAR(255) NULL,

        buyer_name        VARCHAR(255) NULL,
        buyer_tax_code    VARCHAR(64)  NULL,
        buyer_address     TEXT         NULL,

        description       TEXT         NULL,
        pre_vat_amount    NUMERIC(18,2) NOT NULL DEFAULT 0,
        vat_rate          NUMERIC(9,4)  NULL,
        vat_amount        NUMERIC(18,2) NOT NULL DEFAULT 0,
        discount_amount   NUMERIC(18,2) NOT NULL DEFAULT 0,
        total_amount      NUMERIC(18,2) NOT NULL DEFAULT 0,

        purchase_order_id UUID NULL,
        sales_order_id    UUID NULL,

        notes             TEXT         NULL,
        created_by        UUID         NULL,
        created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
        updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
      )
    `);

    // FK purchase_order_id (safe — bảng erp_purchase_orders chắc chắn tồn tại)
    await queryRunner.query(`
      ALTER TABLE erp_invoices
        ADD CONSTRAINT fk_erp_invoices_po
        FOREIGN KEY (purchase_order_id)
        REFERENCES erp_purchase_orders(id) ON DELETE SET NULL
    `);

    // FK sales_order_id — CHỈ thêm nếu bảng erp_sales_orders tồn tại trên Neon
    // Uncomment khi đã verify tên bảng:
    // await queryRunner.query(`
    //   ALTER TABLE erp_invoices
    //     ADD CONSTRAINT fk_erp_invoices_so
    //     FOREIGN KEY (sales_order_id)
    //     REFERENCES erp_sales_orders(id) ON DELETE SET NULL
    // `);

    await queryRunner.query(`
      CREATE INDEX idx_erp_invoices_direction ON erp_invoices(direction);
      CREATE INDEX idx_erp_invoices_invoice_date ON erp_invoices(invoice_date);
      CREATE INDEX idx_erp_invoices_po_id ON erp_invoices(purchase_order_id);
      CREATE INDEX idx_erp_invoices_so_id ON erp_invoices(sales_order_id);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS erp_invoices`);
  }
}
```

**Verify:**
```sql
SELECT table_name FROM information_schema.tables WHERE table_name = 'erp_invoices';
\d erp_invoices
```

---

## Scope 2A — Entity + DTO: `supplier_invoice_no` trên PO

**[MODIFY]** `src/purchase-orders-core/entities/erp_purchase_order.entity.ts`

Thêm sau field `remarks`:
```typescript
@Column({ type: 'varchar', length: 128, name: 'supplier_invoice_no', nullable: true })
supplierInvoiceNo: string | null;
```

**[MODIFY]** `src/purchase-orders-core/dto/create-purchase-order.dto.ts`

Thêm:
```typescript
@IsOptional()
@IsString()
@MaxLength(128)
supplierInvoiceNo?: string;
```

**[MODIFY]** `src/purchase-orders-core/dto/update-purchase-order.dto.ts`

Tương tự — `@IsOptional() supplierInvoiceNo?: string`.

> `toCoreDocument()` dùng spread `...data` nên field tự expose — không cần sửa service.

---

## Scope 2B — Module `erp-invoices-core`

### Cấu trúc cần tạo

```
src/erp-invoices-core/
├── erp-invoices-core.module.ts
├── erp-invoices-core.controller.ts
├── erp-invoices-core.service.ts
├── entities/
│   └── erp_invoice.entity.ts
└── dto/
    ├── create-erp-invoice.dto.ts
    └── update-erp-invoice.dto.ts
```

### Entity `erp_invoice.entity.ts`

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity({ name: 'erp_invoices' })
export class ErpInvoice {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'invoice_no', length: 128 }) invoiceNo: string;
  @Column({ name: 'serial_no', length: 64, nullable: true }) serialNo: string | null;
  @Column({ type: 'date', name: 'invoice_date' }) invoiceDate: string;
  @Index() @Column({ length: 16, default: 'IN' }) direction: string; // IN | OUT
  @Column({ length: 32, default: 'DRAFT' }) status: string;

  @Column({ name: 'seller_name', length: 255, nullable: true }) sellerName: string | null;
  @Column({ name: 'seller_tax_code', length: 64, nullable: true }) sellerTaxCode: string | null;
  @Column({ name: 'seller_address', type: 'text', nullable: true }) sellerAddress: string | null;
  @Column({ name: 'seller_bank', length: 255, nullable: true }) sellerBank: string | null;

  @Column({ name: 'buyer_name', length: 255, nullable: true }) buyerName: string | null;
  @Column({ name: 'buyer_tax_code', length: 64, nullable: true }) buyerTaxCode: string | null;
  @Column({ name: 'buyer_address', type: 'text', nullable: true }) buyerAddress: string | null;

  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'numeric', precision: 18, scale: 2, name: 'pre_vat_amount', default: 0 }) preVatAmount: string;
  @Column({ type: 'numeric', precision: 9, scale: 4, name: 'vat_rate', nullable: true }) vatRate: string | null;
  @Column({ type: 'numeric', precision: 18, scale: 2, name: 'vat_amount', default: 0 }) vatAmount: string;
  @Column({ type: 'numeric', precision: 18, scale: 2, name: 'discount_amount', default: 0 }) discountAmount: string;
  @Column({ type: 'numeric', precision: 18, scale: 2, name: 'total_amount', default: 0 }) totalAmount: string;

  @Column({ type: 'uuid', name: 'purchase_order_id', nullable: true }) purchaseOrderId: string | null;
  @Column({ type: 'uuid', name: 'sales_order_id', nullable: true }) salesOrderId: string | null;

  @Column({ type: 'text', nullable: true }) notes: string | null;
  @Column({ type: 'uuid', name: 'created_by', nullable: true }) createdBy: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
```

### Service `erp-invoices-core.service.ts`

- `findAll(query)`: filter theo `direction`, `date_from`, `date_to`, `search` (invoice_no/buyer_name/seller_name), page/pageSize, sort
- `findOne(id)`: findOneByOrFail
- `create(dto)`: save
- `update(id, dto)`: update
- `remove(id)`: delete

### Controller `erp-invoices-core.controller.ts`

```
GET    /api/v1/erp-invoices          — list (query: direction, date_from, date_to, search, page, pageSize)
POST   /api/v1/erp-invoices          — create
GET    /api/v1/erp-invoices/:id      — detail
PATCH  /api/v1/erp-invoices/:id      — update
DELETE /api/v1/erp-invoices/:id      — delete
```

Tất cả route cần `@UseGuards(JwtAuthGuard)` theo pattern của các module khác trong erp-core.

### Module + AppModule

**[MODIFY]** `src/app.module.ts` — import `ErpInvoicesCoreModule`.

---

## Verification

```bash
cd /opt/repos/liouni-erp-core/liouni-erp-api
bun run build
```

**API smoke:**
```bash
# Tạo invoice
curl -X POST http://localhost:10010/api/v1/erp-invoices \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"invoiceNo":"HD001","invoiceDate":"2026-06-16","direction":"IN","sellerName":"Công ty A","sellerTaxCode":"0123456789","preVatAmount":1000000,"vatRate":0.1,"vatAmount":100000,"totalAmount":1100000}'

# List
curl http://localhost:10010/api/v1/erp-invoices?direction=IN \
  -H "Authorization: Bearer <token>"

# PATCH PO với supplier_invoice_no
curl -X PATCH http://localhost:10010/api/v1/purchase-orders/<po-id> \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"supplierInvoiceNo":"HD-NCC-001"}'
```

---

## Rollback

```sql
-- Rollback 1A
ALTER TABLE erp_purchase_orders DROP COLUMN IF EXISTS supplier_invoice_no;

-- Rollback 1B
DROP TABLE IF EXISTS erp_invoices;
```

---

## Done checklist

- [x] Migration 1A chạy thành công, verify column tồn tại
- [x] Migration 1B chạy thành công, verify table + indexes
- [x] Entity PO có `supplierInvoiceNo`, DTO accept field
- [x] `ErpInvoice` entity + DTO tạo đúng
- [x] Service: list/get/create/update/remove hoạt động
- [x] Controller: 5 routes expose đúng, có guard JWT
- [x] AppModule import module mới
- [x] `bun run build` PASS — evidence 2026-06-18 (`nest build` exit 0)
- [x] Jest 18/18 PASS — evidence 2026-06-18
- [ ] API smoke live (cần `bun start:dev` + admin token)
