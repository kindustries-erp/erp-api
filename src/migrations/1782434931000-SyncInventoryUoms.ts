import { MigrationInterface, QueryRunner } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

export class SyncInventoryUoms1782434931000 implements MigrationInterface {
  name = 'SyncInventoryUoms1782434931000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const jsonPath = path.join(process.cwd(), 'danh_sach_linh_kien.json');
    if (!fs.existsSync(jsonPath)) {
      console.warn(`Could not find ${jsonPath}. Skipping UOM sync.`);
      return;
    }

    const data: { maLinhKien: string; donVi: string }[] = JSON.parse(
      fs.readFileSync(jsonPath, 'utf8'),
    );

    const uomMap = new Map<string, string>(); // code -> id

    // Convert Vietnamese donVi to simple codes
    const buildUomCode = (name: string) => {
      const code = name
        .trim()
        .toUpperCase()
        .replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, 'A')
        .replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, 'E')
        .replace(/Ì|Í|Ị|Ỉ|Ĩ/g, 'I')
        .replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, 'O')
        .replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, 'U')
        .replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, 'Y')
        .replace(/Đ/g, 'D')
        .replace(/\s+/g, '_')
        .replace(/[^A-Z0-9_]/g, '');
      return code || 'UNKNOWN';
    };

    // Upsert unique UOMs
    const uniqueDonVi = Array.from(
      new Set(data.map((d) => d.donVi?.trim()).filter(Boolean)),
    );
    for (const name of uniqueDonVi) {
      const code = buildUomCode(name);
      await queryRunner.query(
        `INSERT INTO "erp_uoms" ("code", "name") VALUES ($1, $2) ON CONFLICT ("code") DO NOTHING`,
        [code, name],
      );
      const res = await queryRunner.query(
        `SELECT id FROM "erp_uoms" WHERE code = $1`,
        [code],
      );
      if (res && res.length > 0) {
        uomMap.set(code, res[0].id);
      }
    }

    // Update erp_inventory_items
    for (const row of data) {
      if (!row.maLinhKien || !row.donVi) continue;
      const sku = row.maLinhKien.trim();
      const code = buildUomCode(row.donVi);
      const uomId = uomMap.get(code);

      if (uomId) {
        await queryRunner.query(
          `UPDATE "erp_inventory_items" SET "uom_id" = $1 WHERE "sku" = $2`,
          [uomId, sku],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No-op for down since we can't reliably know previous UOMs
  }
}
