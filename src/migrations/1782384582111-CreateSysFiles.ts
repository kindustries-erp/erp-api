import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSysFiles1782384582111 implements MigrationInterface {
  name = 'CreateSysFiles1782384582111';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "sys_files" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "filename_download" character varying(255) NOT NULL, "filename_disk" character varying(255) NOT NULL, "type" character varying(100) NOT NULL, "filesize" integer NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4578c4bb07ca4bea4a9d95c2781" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "sys_files"`);
  }
}
