import { MigrationInterface, QueryRunner } from 'typeorm';

export class SyncMissingEntities1782394816687 implements MigrationInterface {
  name = 'SyncMissingEntities1782394816687';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_audit_logs_actor"`);
    await queryRunner.query(`DROP INDEX "public"."idx_audit_logs_created"`);
    await queryRunner.query(`DROP INDEX "public"."idx_audit_logs_entity"`);
    await queryRunner.query(`DROP INDEX "public"."idx_audit_logs_module"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_erp_inventory_lots_item_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_vehicles" ADD "production_order_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_branches" DROP CONSTRAINT "uq_erp_branches_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_branches" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_branches" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_branches" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_branches" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_audit_logs" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_audit_logs" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_item_types" DROP CONSTRAINT "erp_item_types_code_key"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_item_types" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_item_types" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_item_types" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_item_types" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_lots" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_lots" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_lots" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_lots" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_uoms" DROP CONSTRAINT "erp_uoms_code_key"`,
    );
    await queryRunner.query(`ALTER TABLE "erp_uoms" DROP COLUMN "created_at"`);
    await queryRunner.query(
      `ALTER TABLE "erp_uoms" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "erp_uoms" DROP COLUMN "updated_at"`);
    await queryRunner.query(
      `ALTER TABLE "erp_uoms" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_vehicles" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_vehicles" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_vehicles" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_vehicles" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_759b04bed2a84a7feb09baad57" ON "erp_branches" ("code") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_80034fbe3df3ce707e026f743b" ON "erp_item_types" ("code") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_0036a723360e3e7a5f80ff4d11" ON "erp_uoms" ("code") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0036a723360e3e7a5f80ff4d11"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_80034fbe3df3ce707e026f743b"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_759b04bed2a84a7feb09baad57"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_vehicles" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_vehicles" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_vehicles" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_vehicles" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "erp_uoms" DROP COLUMN "updated_at"`);
    await queryRunner.query(
      `ALTER TABLE "erp_uoms" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "erp_uoms" DROP COLUMN "created_at"`);
    await queryRunner.query(
      `ALTER TABLE "erp_uoms" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_uoms" ADD CONSTRAINT "erp_uoms_code_key" UNIQUE ("code")`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_lots" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_lots" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_lots" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_lots" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_item_types" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_item_types" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_item_types" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_item_types" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_item_types" ADD CONSTRAINT "erp_item_types_code_key" UNIQUE ("code")`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_audit_logs" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_audit_logs" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_branches" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_branches" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_branches" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_branches" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_branches" ADD CONSTRAINT "uq_erp_branches_code" UNIQUE ("code")`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_vehicles" DROP COLUMN "production_order_id"`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_erp_inventory_lots_item_id" ON "erp_inventory_lots" ("item_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_logs_module" ON "erp_audit_logs" ("module") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_logs_entity" ON "erp_audit_logs" ("entity_id", "entity_type") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_logs_created" ON "erp_audit_logs" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_logs_actor" ON "erp_audit_logs" ("actor_user_id") `,
    );
  }
}
