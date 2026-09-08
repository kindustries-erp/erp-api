import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedInventoryItemSystemAttributes1788800000000 implements MigrationInterface {
  name = 'SeedInventoryItemSystemAttributes1788800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Determine table name (erp_module_attribute_defs or legacy erp_bom_attribute_defs)
    const tableRes = await queryRunner.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('erp_module_attribute_defs', 'erp_bom_attribute_defs')
      ORDER BY CASE WHEN table_name = 'erp_module_attribute_defs' THEN 1 ELSE 2 END
      LIMIT 1;
    `);

    const tableName = tableRes?.[0]?.table_name || 'erp_module_attribute_defs';

    // 2. Default options for INVENTORY_ITEM system attributes
    const defaultUomOptions = JSON.stringify([
      {
        value: 'CAI',
        label: 'Cái',
        labelEn: 'Piece',
        labels: { vi: 'Cái', en: 'Piece' },
      },
      {
        value: 'BO',
        label: 'Bộ',
        labelEn: 'Set',
        labels: { vi: 'Bộ', en: 'Set' },
      },
      {
        value: 'KG',
        label: 'Kilogram (kg)',
        labelEn: 'Kilogram (kg)',
        labels: { vi: 'Kilogram (kg)', en: 'Kilogram (kg)' },
      },
      {
        value: 'LIT',
        label: 'Lít (l)',
        labelEn: 'Liter (l)',
        labels: { vi: 'Lít (l)', en: 'Liter (l)' },
      },
      {
        value: 'MET',
        label: 'Mét (m)',
        labelEn: 'Meter (m)',
        labels: { vi: 'Mét (m)', en: 'Meter (m)' },
      },
      {
        value: 'CHIEC',
        label: 'Chiếc',
        labelEn: 'Unit',
        labels: { vi: 'Chiếc', en: 'Unit' },
      },
      {
        value: 'HOP',
        label: 'Hộp',
        labelEn: 'Box',
        labels: { vi: 'Hộp', en: 'Box' },
      },
      {
        value: 'BINH',
        label: 'Bình',
        labelEn: 'Bottle/Jar',
        labels: { vi: 'Bình', en: 'Bottle/Jar' },
      },
      {
        value: 'CUON',
        label: 'Cuộn',
        labelEn: 'Roll',
        labels: { vi: 'Cuộn', en: 'Roll' },
      },
      {
        value: 'GOI',
        label: 'Gói',
        labelEn: 'Pack',
        labels: { vi: 'Gói', en: 'Pack' },
      },
    ]);

    const defaultItemTypeOptions = JSON.stringify([
      {
        value: 'RAW_MATERIAL',
        label: 'Nguyên vật liệu (NVL)',
        labelEn: 'Raw Material',
        labels: { vi: 'Nguyên vật liệu (NVL)', en: 'Raw Material' },
      },
      {
        value: 'SEMI_FINISHED',
        label: 'Bán thành phẩm (BTP)',
        labelEn: 'Semi-Finished Goods',
        labels: { vi: 'Bán thành phẩm (BTP)', en: 'Semi-Finished Goods' },
      },
      {
        value: 'FINISHED_GOODS',
        label: 'Thành phẩm (TP)',
        labelEn: 'Finished Goods',
        labels: { vi: 'Thành phẩm (TP)', en: 'Finished Goods' },
      },
      {
        value: 'SPARE_PART',
        label: 'Phụ tùng / Linh kiện',
        labelEn: 'Spare Part / Component',
        labels: { vi: 'Phụ tùng / Linh kiện', en: 'Spare Part / Component' },
      },
      {
        value: 'SERVICE',
        label: 'Dịch vụ / Nhân công',
        labelEn: 'Service / Labor',
        labels: { vi: 'Dịch vụ / Nhân công', en: 'Service / Labor' },
      },
      {
        value: 'CONSUMABLE',
        label: 'Vật tư tiêu hao',
        labelEn: 'Consumable',
        labels: { vi: 'Vật tư tiêu hao', en: 'Consumable' },
      },
    ]);

    const defaultTrackingPolicyOptions = JSON.stringify([
      {
        value: 'NONE',
        label: 'Không quản lý theo dõi',
        labelEn: 'None (Quantity Only)',
        labels: { vi: 'Không quản lý theo dõi', en: 'None (Quantity Only)' },
      },
      {
        value: 'SERIAL',
        label: 'Theo dõi theo Serial',
        labelEn: 'Serial Tracking',
        labels: { vi: 'Theo dõi theo Serial', en: 'Serial Tracking' },
      },
      {
        value: 'LOT',
        label: 'Theo dõi theo Lô (Lot)',
        labelEn: 'Lot / Batch Tracking',
        labels: { vi: 'Theo dõi theo Lô (Lot)', en: 'Lot / Batch Tracking' },
      },
      {
        value: 'CUSTOM',
        label: 'Theo dõi Barcode tùy chỉnh',
        labelEn: 'Custom Barcode Tracking',
        labels: {
          vi: 'Theo dõi Barcode tùy chỉnh',
          en: 'Custom Barcode Tracking',
        },
      },
      {
        value: 'VEHICLE',
        label: 'Theo dõi Xe (VIN/Khung/Máy)',
        labelEn: 'Vehicle (VIN/Engine/Frame)',
        labels: {
          vi: 'Theo dõi Xe (VIN/Khung/Máy)',
          en: 'Vehicle (VIN/Engine/Frame)',
        },
      },
    ]);

    const defaultItemFeaturesOptions = JSON.stringify([
      {
        value: 'CAN_BE_SOLD',
        label: 'Có thể bán',
        labelEn: 'Can be Sold',
        labels: { vi: 'Có thể bán', en: 'Can be Sold' },
      },
      {
        value: 'CAN_BE_PURCHASED',
        label: 'Có thể mua',
        labelEn: 'Can be Purchased',
        labels: { vi: 'Có thể mua', en: 'Can be Purchased' },
      },
      {
        value: 'CAN_BE_MANUFACTURED',
        label: 'Có thể sản xuất',
        labelEn: 'Can be Manufactured',
        labels: { vi: 'Có thể sản xuất', en: 'Can be Manufactured' },
      },
    ]);

    // Upsert helper function
    const upsertSystemAttr = async (
      code: string,
      name: string,
      nameEn: string,
      fieldType: string,
      optionsJson: string,
      sortOrder: number,
      aliases: string[] = [],
    ) => {
      const aliasList = [code, ...aliases].map((a) => `'${a}'`).join(', ');
      const existing = await queryRunner.query(`
        SELECT id, code FROM "${tableName}"
        WHERE "module_key_global" = 'INVENTORY_ITEM'
          AND "is_global" = true
          AND "is_deleted" = false
          AND "code" IN (${aliasList})
        LIMIT 1;
      `);

      if (existing && existing.length > 0) {
        await queryRunner.query(
          `
          UPDATE "${tableName}"
          SET "is_system" = true,
              "code" = $1,
              "name" = $2,
              "name_en" = $3,
              "field_type" = $4,
              "options" = $5::jsonb,
              "sort_order" = $6,
              "is_active" = true,
              "is_deleted" = false
          WHERE "id" = $7;
        `,
          [
            code,
            name,
            nameEn,
            fieldType,
            optionsJson,
            sortOrder,
            existing[0].id,
          ],
        );
      } else {
        await queryRunner.query(
          `
          INSERT INTO "${tableName}" (
            "id", "is_global", "module_key_global", "code", "name", "name_en",
            "field_type", "options", "sort_order", "is_required", "is_active", "is_system", "is_deleted"
          ) VALUES (
            gen_random_uuid(), true, 'INVENTORY_ITEM', $1, $2, $3,
            $4, $5::jsonb, $6, false, true, true, false
          );
        `,
          [code, name, nameEn, fieldType, optionsJson, sortOrder],
        );
      }
    };

    // 1. uom
    await upsertSystemAttr(
      'uom',
      'Đơn vị tính (ĐVT)',
      'Unit of Measure (UOM)',
      'SELECT',
      defaultUomOptions,
      1,
      ['type_inventory_uom', 'inventory_uom', 'unit'],
    );

    // 2. item_type
    await upsertSystemAttr(
      'item_type',
      'Loại mặt hàng',
      'Item Type',
      'SELECT',
      defaultItemTypeOptions,
      2,
      ['type_inventory_item_type', 'inventory_item_type', 'item_category'],
    );

    // 3. tracking_policy
    await upsertSystemAttr(
      'tracking_policy',
      'Chính sách theo dõi định danh',
      'Tracking Policy',
      'SELECT',
      defaultTrackingPolicyOptions,
      3,
      [
        'type_inventory_tracking_policy',
        'inventory_tracking_policy',
        'tracking',
      ],
    );

    // 4. item_features
    await upsertSystemAttr(
      'item_features',
      'Tính chất nghiệp vụ',
      'Business Attributes',
      'SELECT',
      defaultItemFeaturesOptions,
      4,
      ['item_attributes', 'business_features', 'item_properties'],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tableRes = await queryRunner.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('erp_module_attribute_defs', 'erp_bom_attribute_defs')
      ORDER BY CASE WHEN table_name = 'erp_module_attribute_defs' THEN 1 ELSE 2 END
      LIMIT 1;
    `);

    const tableName = tableRes?.[0]?.table_name || 'erp_module_attribute_defs';

    await queryRunner.query(`
      DELETE FROM "${tableName}"
      WHERE "module_key_global" = 'INVENTORY_ITEM'
        AND "code" IN ('uom', 'item_type', 'tracking_policy', 'item_features')
        AND "is_system" = true;
    `);
  }
}
