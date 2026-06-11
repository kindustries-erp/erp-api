import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInventoryUomsAndItemTypes20260611094500 implements MigrationInterface {
  name = 'AddInventoryUomsAndItemTypes20260611094500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS erp_uoms (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code varchar(100) NOT NULL UNIQUE,
        name varchar(255) NOT NULL,
        description text NULL,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS erp_item_types (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code varchar(100) NOT NULL UNIQUE,
        name varchar(255) NOT NULL,
        description text NULL,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      INSERT INTO erp_uoms (code, name, description)
      VALUES
        ('PCS', 'Cái', 'Đơn vị cái/chiếc'),
        ('KG', 'Kilogram', 'Đơn vị khối lượng kilogram'),
        ('M', 'Mét', 'Đơn vị chiều dài mét'),
        ('L', 'Lít', 'Đơn vị thể tích lít'),
        ('BOX', 'Hộp', 'Đơn vị hộp'),
        ('SET', 'Bộ', 'Đơn vị bộ')
      ON CONFLICT (code) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO erp_item_types (code, name, description)
      VALUES
        ('FG', 'Thành phẩm', 'Finished goods'),
        ('RAW', 'Nguyên vật liệu', 'Raw materials'),
        ('WIP', 'Bán thành phẩm', 'Work in progress'),
        ('GOODS', 'Hàng hóa', 'Trading goods'),
        ('SERVICE', 'Dịch vụ', 'Service item'),
        ('OTHER', 'Khác', 'Other inventory item type')
      ON CONFLICT (code) DO NOTHING
    `);

    await queryRunner.query(`
      UPDATE erp_inventory_items
      SET uom = UPPER(TRIM(uom))
      WHERE uom IS NOT NULL
    `);

    await queryRunner.query(`
      UPDATE erp_inventory_items
      SET item_type = UPPER(TRIM(item_type))
      WHERE item_type IS NOT NULL
    `);

    await queryRunner.query(`
      INSERT INTO erp_uoms (code, name, description)
      SELECT DISTINCT uom, uom, 'Backfilled from existing inventory items'
      FROM erp_inventory_items
      WHERE uom IS NOT NULL AND uom <> ''
      ON CONFLICT (code) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO erp_item_types (code, name, description)
      SELECT DISTINCT item_type, item_type, 'Backfilled from existing inventory items'
      FROM erp_inventory_items
      WHERE item_type IS NOT NULL AND item_type <> ''
      ON CONFLICT (code) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS erp_item_types`);
    await queryRunner.query(`DROP TABLE IF EXISTS erp_uoms`);
  }
}
