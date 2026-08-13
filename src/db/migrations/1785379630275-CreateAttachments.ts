import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAttachments1785379630275 implements MigrationInterface {
  name = 'CreateAttachments1785379630275';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const enumExists = await queryRunner.query(
      `SELECT 1 FROM pg_type WHERE typname = 'erp_attachments_document_type_enum'`,
    );
    if (enumExists.length === 0) {
      await queryRunner.query(
        `CREATE TYPE "public"."erp_attachments_document_type_enum" AS ENUM('HOP_DONG', 'HOA_DON', 'BANG_KE', 'KHAC')`,
      );
    }

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "erp_attachments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "file_name" character varying(255) NOT NULL, "file_key" character varying(512) NOT NULL, "file_size" integer NOT NULL DEFAULT '0', "mime_type" character varying(128), "document_type" "public"."erp_attachments_document_type_enum" NOT NULL DEFAULT 'KHAC', "created_by" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_178eacea95cab8f9c0f3b7ba6d9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "erp_invoice_attachments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "invoice_id" uuid NOT NULL, "attachment_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_cc566aab096e5f51dd7a9d9eb33" PRIMARY KEY ("id"))`,
    );

    // Add constraints if not exists
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "erp_invoice_attachments" ADD CONSTRAINT "FK_0f7ae1e52b9411de1b351aa38ed" FOREIGN KEY ("invoice_id") REFERENCES "erp_invoices"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "erp_invoice_attachments" ADD CONSTRAINT "FK_3b7546c104d49fd043c8aea775b" FOREIGN KEY ("attachment_id") REFERENCES "erp_attachments"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_attachments" DROP CONSTRAINT IF EXISTS "FK_3b7546c104d49fd043c8aea775b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_attachments" DROP CONSTRAINT IF EXISTS "FK_0f7ae1e52b9411de1b351aa38ed"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "erp_invoice_attachments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "erp_attachments"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."erp_attachments_document_type_enum"`,
    );
  }
}
