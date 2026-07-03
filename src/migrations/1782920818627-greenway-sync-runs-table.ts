import { MigrationInterface, QueryRunner } from 'typeorm';

export class GreenwaySyncRunsTable1782920818627 implements MigrationInterface {
  name = 'GreenwaySyncRunsTable1782920818627';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."gw_sync_runs_status_enum" AS ENUM('SUCCESS', 'FAILED', 'PARTIAL')`,
    );
    await queryRunner.query(
      `CREATE TABLE "gw_sync_runs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "branch_external_id" character varying(100), "endpoint" character varying(255) NOT NULL, "query_params" jsonb, "page_size" integer, "request_started_at" TIMESTAMP WITH TIME ZONE NOT NULL, "request_ended_at" TIMESTAMP WITH TIME ZONE, "response_status" integer, "response_message" text, "data_as_of" TIMESTAMP WITH TIME ZONE, "row_count" integer NOT NULL DEFAULT '0', "error_message" text, "status" "public"."gw_sync_runs_status_enum" NOT NULL DEFAULT 'SUCCESS', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7d61f1df088832b534befeb622e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e036a28b0a030cce0021f02196" ON "gw_sync_runs" ("branch_external_id") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e036a28b0a030cce0021f02196"`,
    );
    await queryRunner.query(`DROP TABLE "gw_sync_runs"`);
    await queryRunner.query(`DROP TYPE "public"."gw_sync_runs_status_enum"`);
  }
}
