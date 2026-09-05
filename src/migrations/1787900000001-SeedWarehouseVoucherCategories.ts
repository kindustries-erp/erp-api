import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedWarehouseVoucherCategories1787900000001 implements MigrationInterface {
  name = 'SeedWarehouseVoucherCategories1787900000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "erp_bom_categories" (
        "id", "module_key", "code", "name", "description", "is_active", "is_deleted", "created_at", "updated_at"
      ) VALUES
      -- 1. GOODS_RECEIPT (Phiếu Nhập Kho)
      (gen_random_uuid(), 'GOODS_RECEIPT', 'PURCHASE', 'Nhập mua hàng NCC', 'Nhập kho từ đơn mua hàng nhà cung cấp (PO)', true, false, NOW(), NOW()),
      (gen_random_uuid(), 'GOODS_RECEIPT', 'PRODUCTION', 'Nhập thành phẩm SX', 'Nhập kho thành phẩm lắp ráp từ lệnh sản xuất (MO)', true, false, NOW(), NOW()),
      (gen_random_uuid(), 'GOODS_RECEIPT', 'TRANSFER', 'Nhập chuyển kho', 'Nhập kho luân chuyển giữa các chi nhánh / kho hàng', true, false, NOW(), NOW()),
      (gen_random_uuid(), 'GOODS_RECEIPT', 'RETURN', 'Nhập trả hàng', 'Nhập hàng trả lại từ khách hàng hoặc đại lý', true, false, NOW(), NOW()),
      (gen_random_uuid(), 'GOODS_RECEIPT', 'OTHER', 'Nhập khác', 'Các luồng nhập kho đặc thù khác', true, false, NOW(), NOW()),

      -- 2. GOODS_ISSUE (Phiếu Xuất Kho)
      (gen_random_uuid(), 'GOODS_ISSUE', 'SALES', 'Xuất bán hàng', 'Xuất kho giao hàng theo đơn bán hàng (SO)', true, false, NOW(), NOW()),
      (gen_random_uuid(), 'GOODS_ISSUE', 'PRODUCTION', 'Xuất NVL sản xuất', 'Xuất cấp phát linh kiện / vật tư cho lệnh sản xuất (MO)', true, false, NOW(), NOW()),
      (gen_random_uuid(), 'GOODS_ISSUE', 'TRANSFER', 'Xuất chuyển kho', 'Xuất kho luân chuyển giữa các chi nhánh / kho hàng', true, false, NOW(), NOW()),
      (gen_random_uuid(), 'GOODS_ISSUE', 'SCRAP', 'Xuất hủy / Hao hụt', 'Xuất hủy hàng hỏng, hao hụt hoặc thanh lý', true, false, NOW(), NOW()),
      (gen_random_uuid(), 'GOODS_ISSUE', 'WARRANTY', 'Xuất bảo hành', 'Xuất linh kiện đổi trả hoặc phục vụ bảo hành', true, false, NOW(), NOW()),

      -- 3. INVENTORY_ADJUSTMENT (Phiếu Điều Chỉnh / Kiểm Kê)
      (gen_random_uuid(), 'INVENTORY_ADJUSTMENT', 'CYCLE_COUNT', 'Kiểm kê định kỳ', 'Cân đối số liệu kiểm kê thực tế theo định kỳ', true, false, NOW(), NOW()),
      (gen_random_uuid(), 'INVENTORY_ADJUSTMENT', 'SURPLUS', 'Điều chỉnh thừa tồn kho', 'Ghi tăng số dư tồn kho do phát hiện thừa thực tế', true, false, NOW(), NOW()),
      (gen_random_uuid(), 'INVENTORY_ADJUSTMENT', 'SHORTAGE', 'Điều chỉnh thiếu hụt', 'Ghi giảm số dư tồn kho do phát hiện thiếu hụt / mất mát', true, false, NOW(), NOW()),
      (gen_random_uuid(), 'INVENTORY_ADJUSTMENT', 'RECLASSIFY', 'Phân loại lại', 'Điều chỉnh phân loại, tình trạng hoặc quy cách mặt hàng', true, false, NOW(), NOW())
      
      ON CONFLICT ("module_key", "code") DO UPDATE
      SET "name" = EXCLUDED."name",
          "description" = EXCLUDED."description",
          "is_active" = true,
          "is_deleted" = false,
          "updated_at" = NOW();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "erp_bom_categories" 
      WHERE "module_key" IN ('GOODS_RECEIPT', 'GOODS_ISSUE', 'INVENTORY_ADJUSTMENT');
    `);
  }
}
