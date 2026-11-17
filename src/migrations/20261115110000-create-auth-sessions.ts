import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tạo bảng `auth_sessions` (phiên đăng nhập auth v2). Chỉ tạo bảng, không đụng
 * `core_refresh_tokens` (v1). down() chỉ xóa bảng này.
 */
export class CreateAuthSessions20261115110000 implements MigrationInterface {
  name = 'CreateAuthSessions20261115110000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "auth_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "extra_data" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "is_deleted" boolean NOT NULL DEFAULT false,
        "user_id" uuid NOT NULL,
        "token_hash" character varying(255) NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "revoked_at" TIMESTAMP WITH TIME ZONE,
        "user_agent" character varying(500),
        "ip_address" character varying(100),
        CONSTRAINT "PK_auth_sessions_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_auth_sessions_extra_data_object"
          CHECK (jsonb_typeof("extra_data") = 'object'),
        CONSTRAINT "FK_auth_sessions_user_id"
          FOREIGN KEY ("user_id") REFERENCES "users_management"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_auth_sessions_token_hash" ON "auth_sessions" ("token_hash")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_auth_sessions_user_id" ON "auth_sessions" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_auth_sessions_expires_at" ON "auth_sessions" ("expires_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "auth_sessions"`);
  }
}
