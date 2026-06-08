import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateErpCoreBusinessTables20260607170000 implements MigrationInterface {
  name = 'CreateErpCoreBusinessTables20260607170000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS erp_employees (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_code varchar(255) NOT NULL UNIQUE,
        full_name varchar(255) NOT NULL,
        email varchar(255) NULL,
        phone varchar(255) NULL,
        status varchar(255) NOT NULL DEFAULT 'ACTIVE',
        user_id uuid NULL,
        notes text NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS erp_business_partners (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code varchar(255) NOT NULL UNIQUE,
        name varchar(255) NOT NULL,
        display_name varchar(255) NULL,
        partner_type varchar(255) NOT NULL,
        tax_code varchar(255) NULL,
        phone varchar(255) NULL,
        email varchar(255) NULL,
        address text NULL,
        contact_name varchar(255) NULL,
        status varchar(255) NOT NULL DEFAULT 'ACTIVE',
        notes text NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS erp_inventory_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        sku varchar(255) NOT NULL UNIQUE,
        item_name varchar(255) NOT NULL,
        uom varchar(255) NOT NULL,
        item_type varchar(255) NOT NULL,
        status varchar(255) NOT NULL DEFAULT 'ACTIVE',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS erp_inventory_transactions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        transaction_type varchar(50) NOT NULL,
        document_type varchar(100) NULL,
        document_id uuid NULL,
        item_id uuid NULL,
        warehouse_code varchar(100) NULL,
        qty_in numeric(18,3) NOT NULL DEFAULT 0,
        qty_out numeric(18,3) NOT NULL DEFAULT 0,
        unit_cost numeric(18,3) NULL,
        transaction_date date NOT NULL,
        notes text NULL,
        created_by uuid NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS erp_inventory_balances (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        item_id uuid NULL,
        warehouse_code varchar(100) NULL,
        qty_on_hand numeric(18,3) NOT NULL DEFAULT 0,
        qty_reserved numeric(18,3) NOT NULL DEFAULT 0,
        avg_unit_cost numeric(18,3) NOT NULL DEFAULT 0,
        inventory_value numeric(18,3) NOT NULL DEFAULT 0,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS erp_boms (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        bom_code varchar(255) NOT NULL UNIQUE,
        bom_name varchar(255) NOT NULL,
        finished_good_item_id uuid NULL,
        version varchar(255) NOT NULL,
        status varchar(255) NOT NULL DEFAULT 'ACTIVE',
        effective_from date NULL,
        effective_to date NULL,
        notes text NULL,
        created_by uuid NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS erp_bom_lines (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        bom_id uuid NOT NULL,
        line_no integer NOT NULL,
        component_item_id uuid NULL,
        qty_required numeric(18,3) NOT NULL,
        uom varchar(100) NOT NULL,
        scrap_rate numeric(18,3) NULL,
        notes text NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS erp_purchase_requests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        request_no varchar(255) NOT NULL UNIQUE,
        request_date date NOT NULL,
        requester_employee_id uuid NULL,
        status varchar(255) NOT NULL DEFAULT 'ACTIVE',
        remarks text NULL,
        created_by uuid NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS erp_purchase_request_lines (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        purchase_request_id uuid NOT NULL,
        line_no integer NOT NULL,
        item_id uuid NULL,
        qty_requested numeric(18,3) NOT NULL,
        notes text NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS erp_purchase_orders (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        po_no varchar(255) NOT NULL UNIQUE,
        supplier_id uuid NULL,
        order_date date NOT NULL,
        expected_date date NULL,
        status varchar(255) NOT NULL DEFAULT 'ACTIVE',
        remarks text NULL,
        created_by uuid NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS erp_purchase_order_lines (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        purchase_order_id uuid NOT NULL,
        line_no integer NOT NULL,
        item_id uuid NULL,
        description text NULL,
        qty_ordered numeric(18,3) NOT NULL,
        qty_received numeric(18,3) NOT NULL DEFAULT 0,
        unit_price numeric(18,3) NULL,
        amount numeric(18,3) NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS erp_goods_receipts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        receipt_no varchar(255) NOT NULL UNIQUE,
        purchase_order_id uuid NULL,
        supplier_id uuid NULL,
        receipt_date date NOT NULL,
        status varchar(255) NOT NULL DEFAULT 'ACTIVE',
        remarks text NULL,
        created_by uuid NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS erp_goods_receipt_lines (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        goods_receipt_id uuid NOT NULL,
        line_no integer NOT NULL,
        purchase_order_line_id uuid NULL,
        item_id uuid NULL,
        qty_received numeric(18,3) NOT NULL,
        unit_cost numeric(18,3) NULL,
        amount numeric(18,3) NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS erp_goods_issues (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        issue_no varchar(255) NOT NULL UNIQUE,
        issue_date date NOT NULL,
        issue_type varchar(255) NOT NULL,
        customer_id uuid NULL,
        sales_order_id uuid NULL,
        status varchar(255) NOT NULL DEFAULT 'ACTIVE',
        remarks text NULL,
        created_by uuid NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS erp_goods_issue_lines (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        goods_issue_id uuid NOT NULL,
        line_no integer NOT NULL,
        sales_order_line_id uuid NULL,
        item_id uuid NULL,
        qty_issued numeric(18,3) NOT NULL,
        unit_cost numeric(18,3) NULL,
        amount numeric(18,3) NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS erp_sales_orders (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        so_no varchar(255) NOT NULL UNIQUE,
        customer_id uuid NULL,
        order_date date NOT NULL,
        status varchar(255) NOT NULL DEFAULT 'ACTIVE',
        remarks text NULL,
        created_by uuid NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS erp_sales_order_lines (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        sales_order_id uuid NOT NULL,
        line_no integer NOT NULL,
        item_id uuid NULL,
        qty_ordered numeric(18,3) NOT NULL,
        qty_reserved numeric(18,3) NOT NULL DEFAULT 0,
        qty_delivered numeric(18,3) NOT NULL DEFAULT 0,
        unit_price numeric(18,3) NULL,
        amount numeric(18,3) NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS erp_production_orders (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        reference_no varchar(255) NOT NULL,
        finished_good_item_id uuid NOT NULL,
        qty_to_produce numeric(18,3) NOT NULL,
        warehouse_code varchar(100) NULL,
        status varchar(50) NOT NULL DEFAULT 'POSTED',
        output_metadata jsonb NULL,
        created_by uuid NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS erp_production_order_materials (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        production_order_id uuid NOT NULL,
        item_id uuid NOT NULL,
        qty_required numeric(18,3) NOT NULL,
        unit_cost numeric(18,3) NULL,
        amount numeric(18,3) NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tables = [
      'erp_production_order_materials',
      'erp_production_orders',
      'erp_sales_order_lines',
      'erp_sales_orders',
      'erp_goods_issue_lines',
      'erp_goods_issues',
      'erp_goods_receipt_lines',
      'erp_goods_receipts',
      'erp_purchase_order_lines',
      'erp_purchase_orders',
      'erp_purchase_request_lines',
      'erp_purchase_requests',
      'erp_bom_lines',
      'erp_boms',
      'erp_inventory_balances',
      'erp_inventory_transactions',
      'erp_inventory_items',
      'erp_business_partners',
      'erp_employees',
    ];
    for (const table of tables) {
      await queryRunner.query(`DROP TABLE IF EXISTS ${table}`);
    }
  }
}
