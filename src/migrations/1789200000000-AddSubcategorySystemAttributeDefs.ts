import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubcategorySystemAttributeDefs1789200000000 implements MigrationInterface {
  name = 'AddSubcategorySystemAttributeDefs1789200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.query(`
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'erp_module_attribute_defs'
    `);
    const attrDefTable =
      tableExists.length > 0
        ? 'erp_module_attribute_defs'
        : 'erp_bom_attribute_defs';

    // 1. Subcategories for INVOICE_IN
    const invoiceInSubOptions = JSON.stringify([
      {
        value: 'EXP_ELECTRICITY',
        label: 'Tiền điện',
        labelEn: 'Electricity',
        labels: { vi: 'Tiền điện', en: 'Electricity' },
        parentValue: 'EXPENSE',
      },
      {
        value: 'EXP_WATER',
        label: 'Tiền nước',
        labelEn: 'Water',
        labels: { vi: 'Tiền nước', en: 'Water' },
        parentValue: 'EXPENSE',
      },
      {
        value: 'EXP_RENT',
        label: 'Tiền thuê mặt bằng',
        labelEn: 'Rent',
        labels: { vi: 'Tiền thuê mặt bằng', en: 'Rent' },
        parentValue: 'EXPENSE',
      },
      {
        value: 'EXP_TELECOM',
        label: 'Internet & Viễn thông',
        labelEn: 'Internet & Telecom',
        labels: { vi: 'Internet & Viễn thông', en: 'Internet & Telecom' },
        parentValue: 'EXPENSE',
      },
      {
        value: 'PUR_RAW_MATERIAL',
        label: 'Nguyên vật liệu',
        labelEn: 'Raw Materials',
        labels: { vi: 'Nguyên vật liệu', en: 'Raw Materials' },
        parentValue: 'PURCHASE',
      },
      {
        value: 'PUR_GOODS',
        label: 'Hàng hóa / Phụ tùng',
        labelEn: 'Finished Goods / Parts',
        labels: { vi: 'Hàng hóa / Phụ tùng', en: 'Finished Goods / Parts' },
        parentValue: 'PURCHASE',
      },
      {
        value: 'PUR_TOOLS',
        label: 'Công cụ dụng cụ',
        labelEn: 'Tools & Equipment',
        labels: { vi: 'Công cụ dụng cụ', en: 'Tools & Equipment' },
        parentValue: 'PURCHASE',
      },
    ]);

    await this.upsertSubcategoryDef(
      queryRunner,
      attrDefTable,
      'INVOICE_IN',
      'Phân loại chi tiết hóa đơn mua vào',
      'Input Invoice Subcategory',
      invoiceInSubOptions,
      2,
    );

    // 2. Subcategories for INVOICE_OUT
    const invoiceOutSubOptions = JSON.stringify([
      {
        value: 'TRADE_VEHICLE',
        label: 'Bán xe máy điện',
        labelEn: 'Electric Vehicles',
        labels: { vi: 'Bán xe máy điện', en: 'Electric Vehicles' },
        parentValue: 'TRADE',
      },
      {
        value: 'TRADE_PARTS',
        label: 'Bán linh kiện & Phụ tùng',
        labelEn: 'Spare Parts',
        labels: { vi: 'Bán linh kiện & Phụ tùng', en: 'Spare Parts' },
        parentValue: 'TRADE',
      },
      {
        value: 'SVC_REPAIR',
        label: 'Dịch vụ sửa chữa & Bảo dưỡng',
        labelEn: 'Repair & Maintenance',
        labels: {
          vi: 'Dịch vụ sửa chữa & Bảo dưỡng',
          en: 'Repair & Maintenance',
        },
        parentValue: 'SERVICE',
      },
      {
        value: 'SVC_TRANSPORT',
        label: 'Dịch vụ vận chuyển',
        labelEn: 'Logistics / Transport',
        labels: { vi: 'Dịch vụ vận chuyển', en: 'Logistics / Transport' },
        parentValue: 'SERVICE',
      },
    ]);

    await this.upsertSubcategoryDef(
      queryRunner,
      attrDefTable,
      'INVOICE_OUT',
      'Phân loại chi tiết hóa đơn bán ra',
      'Output Invoice Subcategory',
      invoiceOutSubOptions,
      2,
    );

    // 3. Subcategories for GOODS_RECEIPT
    const grSubOptions = JSON.stringify([
      {
        value: 'REC_PO_REGULAR',
        label: 'Nhập PO định kỳ',
        labelEn: 'Regular PO Receipt',
        labels: { vi: 'Nhập PO định kỳ', en: 'Regular PO Receipt' },
        parentValue: 'PO',
      },
      {
        value: 'REC_PO_URGENT',
        label: 'Nhập PO khẩn cấp',
        labelEn: 'Urgent PO Receipt',
        labels: { vi: 'Nhập PO khẩn cấp', en: 'Urgent PO Receipt' },
        parentValue: 'PO',
      },
      {
        value: 'REC_PROD_COMPLETE',
        label: 'Nhập thành phẩm hoàn chỉnh',
        labelEn: 'Finished Product Receipt',
        labels: {
          vi: 'Nhập thành phẩm hoàn chỉnh',
          en: 'Finished Product Receipt',
        },
        parentValue: 'PRODUCTION',
      },
      {
        value: 'REC_PROD_SEMI',
        label: 'Nhập bán thành phẩm',
        labelEn: 'Semi-finished Product Receipt',
        labels: {
          vi: 'Nhập bán thành phẩm',
          en: 'Semi-finished Product Receipt',
        },
        parentValue: 'PRODUCTION',
      },
      {
        value: 'REC_OTHER_DONATION',
        label: 'Nhập biếu tặng / Mẫu thử',
        labelEn: 'Sample / Donation Receipt',
        labels: {
          vi: 'Nhập biếu tặng / Mẫu thử',
          en: 'Sample / Donation Receipt',
        },
        parentValue: 'OTHER',
      },
      {
        value: 'REC_OTHER_BORROW',
        label: 'Nhập mượn tạm',
        labelEn: 'Temporary Borrow Receipt',
        labels: { vi: 'Nhập mượn tạm', en: 'Temporary Borrow Receipt' },
        parentValue: 'OTHER',
      },
    ]);

    await this.upsertSubcategoryDef(
      queryRunner,
      attrDefTable,
      'GOODS_RECEIPT',
      'Phân loại chi tiết nhập kho',
      'Goods Receipt Subcategory',
      grSubOptions,
      1,
    );

    // 4. Subcategories for GOODS_ISSUE
    const giSubOptions = JSON.stringify([
      {
        value: 'ISS_SALE_WHOLESALE',
        label: 'Xuất bán buôn / Đại lý',
        labelEn: 'Wholesale Delivery',
        labels: { vi: 'Xuất bán buôn / Đại lý', en: 'Wholesale Delivery' },
        parentValue: 'SALE',
      },
      {
        value: 'ISS_SALE_RETAIL',
        label: 'Xuất bán lẻ',
        labelEn: 'Retail Delivery',
        labels: { vi: 'Xuất bán lẻ', en: 'Retail Delivery' },
        parentValue: 'SALE',
      },
      {
        value: 'ISS_PROD_MATERIAL',
        label: 'Xuất cấp phát NVL',
        labelEn: 'Raw Material Issue',
        labels: { vi: 'Xuất cấp phát NVL', en: 'Raw Material Issue' },
        parentValue: 'PRODUCTION',
      },
      {
        value: 'ISS_OTHER_INTERNAL',
        label: 'Xuất dùng nội bộ',
        labelEn: 'Internal Use Issue',
        labels: { vi: 'Xuất dùng nội bộ', en: 'Internal Use Issue' },
        parentValue: 'OTHER',
      },
    ]);

    await this.upsertSubcategoryDef(
      queryRunner,
      attrDefTable,
      'GOODS_ISSUE',
      'Phân loại chi tiết xuất kho',
      'Goods Issue Subcategory',
      giSubOptions,
      1,
    );

    // 5. Subcategories for INVENTORY_ADJUSTMENT
    const iaSubOptions = JSON.stringify([
      {
        value: 'ADJ_COUNT_PERIODIC',
        label: 'Kiểm kê định kỳ tháng/quý',
        labelEn: 'Periodic Cycle Count',
        labels: { vi: 'Kiểm kê định kỳ tháng/quý', en: 'Periodic Cycle Count' },
        parentValue: 'CYCLE_COUNT',
      },
      {
        value: 'ADJ_COUNT_ANNUAL',
        label: 'Kiểm kê niên độ cuối năm',
        labelEn: 'Annual Year-end Count',
        labels: { vi: 'Kiểm kê niên độ cuối năm', en: 'Annual Year-end Count' },
        parentValue: 'CYCLE_COUNT',
      },
      {
        value: 'ADJ_DAMAGED_TRANSIT',
        label: 'Hỏng hóc trong vận chuyển',
        labelEn: 'In-transit Damage',
        labels: { vi: 'Hỏng hóc trong vận chuyển', en: 'In-transit Damage' },
        parentValue: 'DAMAGED',
      },
      {
        value: 'ADJ_DAMAGED_STORAGE',
        label: 'Hao mòn bảo quản kho',
        labelEn: 'Storage Degradation',
        labels: { vi: 'Hao mòn bảo quản kho', en: 'Storage Degradation' },
        parentValue: 'DAMAGED',
      },
    ]);

    await this.upsertSubcategoryDef(
      queryRunner,
      attrDefTable,
      'INVENTORY_ADJUSTMENT',
      'Phân loại chi tiết điều chỉnh',
      'Adjustment Subcategory',
      iaSubOptions,
      1,
    );
  }

  private async upsertSubcategoryDef(
    queryRunner: QueryRunner,
    table: string,
    moduleKey: string,
    name: string,
    nameEn: string,
    optionsJson: string,
    sortOrder: number,
  ): Promise<void> {
    const existing = await queryRunner.query(
      `
      SELECT id, options FROM "${table}"
      WHERE "module_key_global" = $1
        AND "is_global" = true
        AND "is_deleted" = false
        AND "code" = 'subcategory'
      LIMIT 1;
    `,
      [moduleKey],
    );

    if (existing && existing.length > 0) {
      await queryRunner.query(
        `
        UPDATE "${table}"
        SET "is_system" = true,
            "name" = $1,
            "name_en" = $2,
            "field_type" = 'SELECT',
            "options" = COALESCE("options", $3::jsonb),
            "sort_order" = $4,
            "updated_at" = NOW()
        WHERE "id" = $5;
      `,
        [name, nameEn, optionsJson, sortOrder, existing[0].id],
      );
    } else {
      await queryRunner.query(
        `
        INSERT INTO "${table}" (
          "id", "is_global", "module_key_global", "code", "name", "name_en",
          "field_type", "options", "sort_order", "is_required", "is_active", "is_system", "is_deleted",
          "created_at", "updated_at"
        ) VALUES (
          gen_random_uuid(), true, $1, 'subcategory', $2, $3,
          'SELECT', $4::jsonb, $5, false, true, true, false,
          NOW(), NOW()
        );
      `,
        [moduleKey, name, nameEn, optionsJson, sortOrder],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.query(`
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'erp_module_attribute_defs'
    `);
    const attrDefTable =
      tableExists.length > 0
        ? 'erp_module_attribute_defs'
        : 'erp_bom_attribute_defs';

    await queryRunner.query(`
      DELETE FROM "${attrDefTable}"
      WHERE "code" = 'subcategory' AND "is_system" = true;
    `);
  }
}
