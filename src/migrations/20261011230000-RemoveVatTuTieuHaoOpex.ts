import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveVatTuTieuHaoOpex20261011230000 implements MigrationInterface {
  name = 'RemoveVatTuTieuHaoOpex20261011230000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "kgara_operating_expenses"
      WHERE "category_key" = 'VAT_TU_TIEU_HAO';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "kgara_operating_expenses" (
        "id", "period_year", "period_month", "category_key", "category_name", "amount", "oj_amount", "created_at", "updated_at"
      ) VALUES
        ('88279f8c-3df9-4b1b-9cc1-624cb4646ef3', 2026, 1, 'VAT_TU_TIEU_HAO', 'Vật tư tiêu hao', 15000000.00, 0.00, now(), now()),
        ('7c02383b-ad57-47c7-8aa7-c123edd4cb0f', 2026, 2, 'VAT_TU_TIEU_HAO', 'Vật tư tiêu hao', 15000000.00, 0.00, now(), now()),
        ('53ac458b-0bac-4a32-acd9-2beedeb3256b', 2026, 3, 'VAT_TU_TIEU_HAO', 'Vật tư tiêu hao', 15000000.00, 0.00, now(), now()),
        ('2e6ec8f3-de4d-4e96-b2c2-8cd3e96ae85f', 2026, 4, 'VAT_TU_TIEU_HAO', 'Vật tư tiêu hao', 15000000.00, 0.00, now(), now()),
        ('e15aea7c-ff5e-4d94-9ffe-8d733a01ff7c', 2026, 5, 'VAT_TU_TIEU_HAO', 'Vật tư tiêu hao', 15000000.00, 0.00, now(), now()),
        ('9133c7b7-7b13-45f9-b773-cabc4117662e', 2026, 6, 'VAT_TU_TIEU_HAO', 'Vật tư tiêu hao', 15000000.00, 0.00, now(), now()),
        ('25678f2a-6548-468e-ba6c-dde858dd88ff', 2026, 7, 'VAT_TU_TIEU_HAO', 'Vật tư tiêu hao', 15000000.00, 0.00, now(), now()),
        ('c01997aa-e03f-459a-8868-993adfdf26d0', 2026, 8, 'VAT_TU_TIEU_HAO', 'Vật tư tiêu hao', 15000000.00, 0.00, now(), now()),
        ('330c74dc-6636-466f-9f9f-f2fdee91a238', 2026, 9, 'VAT_TU_TIEU_HAO', 'Vật tư tiêu hao', 15000000.00, 0.00, now(), now()),
        ('c4a953a7-b62e-4664-afee-22ea9d52d23c', 2026, 10, 'VAT_TU_TIEU_HAO', 'Vật tư tiêu hao', 15000000.00, 0.00, now(), now()),
        ('8f302a45-c6bc-40a4-b5c4-fa5216142f7a', 2026, 11, 'VAT_TU_TIEU_HAO', 'Vật tư tiêu hao', 15000000.00, 0.00, now(), now()),
        ('c26e22f4-b591-483c-9e60-e7f6207704f9', 2026, 12, 'VAT_TU_TIEU_HAO', 'Vật tư tiêu hao', 15000000.00, 0.00, now(), now())
      ON CONFLICT ("id") DO NOTHING;
    `);
  }
}
