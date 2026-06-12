import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitRbac1781262314656 implements MigrationInterface {
  name = 'InitRbac1781262314656';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "core_permissions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "role_id" uuid NOT NULL, "resource" character varying(128) NOT NULL, "action" character varying(64) NOT NULL, "conditions" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e0e245908c7db1dcdd9eb3cf74f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_ad13c868bb37da55701dfe7c1c" ON "core_permissions" ("role_id", "resource", "action") `,
    );
    await queryRunner.query(
      `CREATE TABLE "core_user_roles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "role_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a72e31234a755d00ee7f5646864" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_74f996ff707c3614369abcecf2" ON "core_user_roles" ("user_id", "role_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "core_roles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255) NOT NULL, "description" text, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_61274cc6ac662edaf9151f7081c" UNIQUE ("name"), CONSTRAINT "PK_98be4141aad39680e7e96029732" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "core_permissions" ADD CONSTRAINT "FK_97d89af85663e6adab50e248fe1" FOREIGN KEY ("role_id") REFERENCES "core_roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "core_user_roles" ADD CONSTRAINT "FK_5def06b0309c7b6775a0cf55920" FOREIGN KEY ("user_id") REFERENCES "core_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "core_user_roles" ADD CONSTRAINT "FK_536b65840609beb90d1291a2f61" FOREIGN KEY ("role_id") REFERENCES "core_roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "core_user_roles" DROP CONSTRAINT "FK_536b65840609beb90d1291a2f61"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core_user_roles" DROP CONSTRAINT "FK_5def06b0309c7b6775a0cf55920"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core_permissions" DROP CONSTRAINT "FK_97d89af85663e6adab50e248fe1"`,
    );
    await queryRunner.query(`DROP TABLE "core_roles"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_74f996ff707c3614369abcecf2"`,
    );
    await queryRunner.query(`DROP TABLE "core_user_roles"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ad13c868bb37da55701dfe7c1c"`,
    );
    await queryRunner.query(`DROP TABLE "core_permissions"`);
  }
}
