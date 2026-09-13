import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmailIngestTables20260730090000 implements MigrationInterface {
  name = 'CreateEmailIngestTables20260730090000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "erp_email_messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "mailbox" character varying(255) NOT NULL DEFAULT 'INBOX',
        "uid" bigint,
        "messageId" character varying(512),
        "sourceHost" character varying(255),
        "sourceProvider" character varying(50) NOT NULL DEFAULT 'IMAP',
        "subject" text,
        "fromJson" jsonb,
        "toJson" jsonb,
        "ccJson" jsonb,
        "bccJson" jsonb,
        "bodyText" text,
        "bodyHtml" text,
        "headersJson" jsonb,
        "rawMetaJson" jsonb,
        "sentAt" TIMESTAMP WITH TIME ZONE,
        "receivedAt" TIMESTAMP WITH TIME ZONE,
        "ingestedAt" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_erp_email_messages_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "erp_email_attachments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "messageId" uuid NOT NULL,
        "sysFileId" uuid NOT NULL,
        "filename" character varying(255),
        "contentType" character varying(120),
        "size" integer,
        "contentId" character varying(255),
        "disposition" character varying(50),
        "attachmentIndex" integer NOT NULL DEFAULT 0,
        "metadataJson" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_erp_email_attachments_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_erp_email_messages_mailbox_uid" ON "erp_email_messages" ("mailbox", "uid")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_erp_email_messages_message_id" ON "erp_email_messages" ("messageId")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_erp_email_attachments_message_id" ON "erp_email_attachments" ("messageId")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_erp_email_attachments_sys_file_id" ON "erp_email_attachments" ("sysFileId")',
    );

    await queryRunner.query(`
      ALTER TABLE "erp_email_attachments"
      ADD CONSTRAINT "FK_erp_email_attachments_message"
      FOREIGN KEY ("messageId")
      REFERENCES "erp_email_messages"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "erp_email_attachments"
      ADD CONSTRAINT "FK_erp_email_attachments_sys_file"
      FOREIGN KEY ("sysFileId")
      REFERENCES "sys_files"("id")
      ON DELETE RESTRICT
      ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "erp_email_attachments" DROP CONSTRAINT IF EXISTS "FK_erp_email_attachments_sys_file"',
    );
    await queryRunner.query(
      'ALTER TABLE "erp_email_attachments" DROP CONSTRAINT IF EXISTS "FK_erp_email_attachments_message"',
    );

    await queryRunner.query(
      'DROP INDEX IF EXISTS "idx_erp_email_attachments_sys_file_id"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "idx_erp_email_attachments_message_id"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "idx_erp_email_messages_message_id"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "idx_erp_email_messages_mailbox_uid"',
    );

    await queryRunner.query('DROP TABLE IF EXISTS "erp_email_attachments"');
    await queryRunner.query('DROP TABLE IF EXISTS "erp_email_messages"');
  }
}
