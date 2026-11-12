import { MigrationInterface, QueryRunner } from 'typeorm';

/** Bảng usage log của AI Hub v2: một dòng cho mỗi lần gọi model qua gateway. down() xóa bảng. */
export class CreateAiHubUsageLogs20261112150100 implements MigrationInterface {
  name = 'CreateAiHubUsageLogs20261112150100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai_hub_usage_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "extra_data" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "is_deleted" boolean NOT NULL DEFAULT false,
        "request_id" character varying(128),
        "actor_user_id" character varying(64),
        "feature_code" character varying(64) NOT NULL,
        "tier" character varying(16) NOT NULL,
        "model_name" character varying(128) NOT NULL,
        "prompt_tokens" integer NOT NULL DEFAULT 0,
        "completion_tokens" integer NOT NULL DEFAULT 0,
        "total_tokens" integer NOT NULL DEFAULT 0,
        "latency_ms" integer NOT NULL DEFAULT 0,
        "outcome" character varying(16) NOT NULL,
        "error_message" text,
        CONSTRAINT "PK_ai_hub_usage_logs_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_hub_usage_logs_feature_created" ON "ai_hub_usage_logs" ("feature_code", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_hub_usage_logs_is_deleted" ON "ai_hub_usage_logs" ("is_deleted")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_hub_usage_logs"`);
  }
}
