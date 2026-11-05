import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bảng PR và PO mới cho họ thường (không đụng erp_purchase_requests / erp_purchase_orders cũ).
 * CHECK giữ bất biến số lượng ngay ở DB: đặt không vượt yêu cầu, nhận không vượt đặt.
 * down() chỉ xóa các bảng vừa tạo, theo thứ tự phụ thuộc khóa ngoại.
 */
export class CreateProcurementTables20261105100500 implements MigrationInterface {
  name = 'CreateProcurementTables20261105100500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "erp_proc_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "request_no" varchar(255) NOT NULL,
        "request_date" date NOT NULL,
        "needed_date" date,
        "title" varchar(255),
        "requester_employee_id" uuid,
        "status" varchar(32) NOT NULL DEFAULT 'DRAFT',
        "ordering_status" varchar(16) NOT NULL DEFAULT 'NONE',
        "estimated_total" numeric(18,2) NOT NULL DEFAULT 0,
        "remarks" text,
        "submitted_by" uuid, "submitted_at" timestamptz,
        "approved_by" uuid, "approved_at" timestamptz,
        "rejected_by" uuid, "rejected_at" timestamptz, "reject_reason" text,
        "cancelled_by" uuid, "cancelled_at" timestamptz, "cancel_reason" text,
        "closed_at" timestamptz, "close_reason" text,
        "created_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_erp_proc_requests" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_erp_proc_requests_no" UNIQUE ("request_no")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_erp_proc_requests_status" ON "erp_proc_requests" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_erp_proc_requests_ordering" ON "erp_proc_requests" ("ordering_status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_erp_proc_requests_deleted" ON "erp_proc_requests" ("is_deleted")`,
    );

    await queryRunner.query(`
      CREATE TABLE "erp_proc_request_lines" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "request_id" uuid NOT NULL,
        "line_no" int NOT NULL,
        "line_type" varchar(16) NOT NULL,
        "item_id" uuid,
        "item_code" varchar(128),
        "item_name" varchar(255),
        "description" text,
        "qty_requested" numeric(18,3) NOT NULL,
        "qty_ordered" numeric(18,3) NOT NULL DEFAULT 0,
        "est_unit_price" numeric(18,3),
        "est_amount" numeric(18,3),
        "notes" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_erp_proc_request_lines" PRIMARY KEY ("id"),
        CONSTRAINT "FK_erp_proc_request_lines_request" FOREIGN KEY ("request_id") REFERENCES "erp_proc_requests"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_erp_proc_request_lines_type" CHECK ("line_type" IN ('GOODS','SERVICE')),
        CONSTRAINT "CHK_erp_proc_request_lines_qty" CHECK ("qty_ordered" >= 0 AND "qty_ordered" <= "qty_requested")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_erp_proc_request_lines_request" ON "erp_proc_request_lines" ("request_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_erp_proc_request_lines_item" ON "erp_proc_request_lines" ("item_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "erp_proc_orders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "order_no" varchar(255) NOT NULL,
        "order_date" date NOT NULL,
        "expected_date" date,
        "supplier_id" uuid,
        "supplier_name" varchar(255),
        "source_type" varchar(16) NOT NULL DEFAULT 'DIRECT',
        "request_id" uuid,
        "status" varchar(32) NOT NULL DEFAULT 'DRAFT',
        "fulfillment_status" varchar(16) NOT NULL DEFAULT 'NONE',
        "total_amount" numeric(18,2) NOT NULL DEFAULT 0,
        "approved_total" numeric(18,2),
        "issued_by" uuid, "issued_at" timestamptz,
        "cancelled_by" uuid, "cancelled_at" timestamptz, "cancel_reason" text,
        "closed_at" timestamptz, "close_reason" text,
        "remarks" text,
        "submitted_by" uuid, "submitted_at" timestamptz,
        "approved_by" uuid, "approved_at" timestamptz,
        "rejected_by" uuid, "rejected_at" timestamptz, "reject_reason" text,
        "created_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_erp_proc_orders" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_erp_proc_orders_no" UNIQUE ("order_no"),
        CONSTRAINT "CHK_erp_proc_orders_source" CHECK ("source_type" IN ('DIRECT','REQUEST')),
        CONSTRAINT "FK_erp_proc_orders_request" FOREIGN KEY ("request_id") REFERENCES "erp_proc_requests"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_erp_proc_orders_status" ON "erp_proc_orders" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_erp_proc_orders_fulfillment" ON "erp_proc_orders" ("fulfillment_status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_erp_proc_orders_supplier" ON "erp_proc_orders" ("supplier_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_erp_proc_orders_request" ON "erp_proc_orders" ("request_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_erp_proc_orders_deleted" ON "erp_proc_orders" ("is_deleted")`,
    );

    await queryRunner.query(`
      CREATE TABLE "erp_proc_order_lines" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "order_id" uuid NOT NULL,
        "line_no" int NOT NULL,
        "line_type" varchar(16) NOT NULL,
        "item_id" uuid,
        "item_code" varchar(128),
        "item_name" varchar(255),
        "description" text,
        "qty_ordered" numeric(18,3) NOT NULL,
        "qty_fulfilled" numeric(18,3) NOT NULL DEFAULT 0,
        "unit_price" numeric(18,3),
        "amount" numeric(18,3),
        "request_line_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_erp_proc_order_lines" PRIMARY KEY ("id"),
        CONSTRAINT "FK_erp_proc_order_lines_order" FOREIGN KEY ("order_id") REFERENCES "erp_proc_orders"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_erp_proc_order_lines_request_line" FOREIGN KEY ("request_line_id") REFERENCES "erp_proc_request_lines"("id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_erp_proc_order_lines_type" CHECK ("line_type" IN ('GOODS','SERVICE')),
        CONSTRAINT "CHK_erp_proc_order_lines_fulfilled" CHECK ("qty_fulfilled" >= 0 AND "qty_fulfilled" <= "qty_ordered")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_erp_proc_order_lines_order" ON "erp_proc_order_lines" ("order_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_erp_proc_order_lines_item" ON "erp_proc_order_lines" ("item_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_erp_proc_order_lines_request_line" ON "erp_proc_order_lines" ("request_line_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "erp_proc_order_acceptances" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "order_id" uuid NOT NULL,
        "order_line_id" uuid NOT NULL,
        "qty" numeric(18,3) NOT NULL,
        "accepted_by" uuid,
        "accepted_at" timestamptz NOT NULL,
        "note" text,
        "is_voided" boolean NOT NULL DEFAULT false,
        "voided_by" uuid, "voided_at" timestamptz, "void_reason" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_erp_proc_order_acceptances" PRIMARY KEY ("id"),
        CONSTRAINT "FK_erp_proc_acc_order" FOREIGN KEY ("order_id") REFERENCES "erp_proc_orders"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_erp_proc_acc_line" FOREIGN KEY ("order_line_id") REFERENCES "erp_proc_order_lines"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_erp_proc_acc_qty" CHECK ("qty" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_erp_proc_acc_order" ON "erp_proc_order_acceptances" ("order_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_erp_proc_acc_line" ON "erp_proc_order_acceptances" ("order_line_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "erp_proc_order_acceptances"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "erp_proc_order_lines"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "erp_proc_orders"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "erp_proc_request_lines"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "erp_proc_requests"`);
  }
}
