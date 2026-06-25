import { MigrationInterface, QueryRunner } from 'typeorm';

export class TagsSystem1782400886418 implements MigrationInterface {
  name = 'TagsSystem1782400886418';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "sys_tags" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255) NOT NULL, "color" character varying(50), "description" text, "is_deleted" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_cd058959c787eccc0968b1a92b5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_207e3e3107ac9d45fe46aab42c" ON "sys_tags" ("name") `,
    );
    await queryRunner.query(
      `CREATE TABLE "sys_entity_tags" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tag_id" uuid NOT NULL, "entity_type" character varying(255) NOT NULL, "entity_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8779f2b01af38d1748d7e4e7524" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_12831c798ca2e567b2cbb1807b" ON "sys_entity_tags" ("tag_id", "entity_type", "entity_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_85621e42c9f551978810e44525" ON "sys_entity_tags" ("entity_type", "entity_id") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_85621e42c9f551978810e44525"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_12831c798ca2e567b2cbb1807b"`,
    );
    await queryRunner.query(`DROP TABLE "sys_entity_tags"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_207e3e3107ac9d45fe46aab42c"`,
    );
    await queryRunner.query(`DROP TABLE "sys_tags"`);
  }
}
