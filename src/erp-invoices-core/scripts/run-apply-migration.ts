import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const targetEnvFile =
    process.argv[2] ||
    (fs.existsSync(path.resolve(process.cwd(), '.env.greenway-production'))
      ? '.env.greenway-production'
      : '.env');

  const envPath = path.isAbsolute(targetEnvFile)
    ? targetEnvFile
    : path.resolve(process.cwd(), targetEnvFile);

  console.log(`Loading env from: ${envPath}`);
  const envVars: Record<string, string> = {};
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        envVars[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
      }
    }
  }

  const connectionString = envVars.DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL not found in env file');
  }

  console.log('Connecting to:', connectionString.replace(/:[^:@]+@/, ':***@'));
  const client = new Client({ connectionString });
  await client.connect();

  console.log('Applying migration 1789600000000...');

  // 1. Tạo bảng cấn trừ công nợ giữa HĐ Điều Chỉnh và HĐ Gốc
  await client.query(`
    CREATE TABLE IF NOT EXISTS "erp_invoice_adjustment_netoff" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "original_invoice_id" uuid NOT NULL,
      "adjusting_invoice_id" uuid NOT NULL,
      "offset_amount" numeric(18, 2) NOT NULL DEFAULT 0,
      "offset_type" character varying(32) NOT NULL DEFAULT 'REDUCTION',
      "notes" text,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_erp_invoice_adjustment_netoff_id" PRIMARY KEY ("id"),
      CONSTRAINT "FK_adj_netoff_original_invoice" FOREIGN KEY ("original_invoice_id") REFERENCES "erp_invoices"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_adj_netoff_adjusting_invoice" FOREIGN KEY ("adjusting_invoice_id") REFERENCES "erp_invoices"("id") ON DELETE CASCADE,
      CONSTRAINT "UQ_adj_netoff_pair" UNIQUE ("original_invoice_id", "adjusting_invoice_id")
    );
  `);
  console.log('Created table erp_invoice_adjustment_netoff');

  await client.query(`
    CREATE INDEX IF NOT EXISTS "idx_adj_netoff_original_id" 
    ON "erp_invoice_adjustment_netoff" ("original_invoice_id");
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS "idx_adj_netoff_adjusting_id" 
    ON "erp_invoice_adjustment_netoff" ("adjusting_invoice_id");
  `);
  console.log('Created indices on erp_invoice_adjustment_netoff');

  // 2. Bổ sung cột JSONB lưu thông tin hiệu lực và diff điều chỉnh
  await client.query(`
    ALTER TABLE "erp_invoices" 
    ADD COLUMN IF NOT EXISTS "effective_data" jsonb DEFAULT NULL;
  `);
  console.log('Added column effective_data to erp_invoices');

  // 3. Đánh GIN Index cho effective_data
  await client.query(`
    CREATE INDEX IF NOT EXISTS "idx_erp_invoices_effective_data_gin" 
    ON "erp_invoices" USING GIN ("effective_data");
  `);
  console.log('Created GIN index on effective_data');

  // 4. Composite Index phục vụ tra cứu liên kết 2 chiều
  await client.query(`
    CREATE INDEX IF NOT EXISTS "idx_erp_invoices_related_lookup" 
    ON "erp_invoices" ("related_invoice_no", "related_serial_no", "direction")
    WHERE "is_deleted" = false;
  `);
  console.log('Created composite index idx_erp_invoices_related_lookup');

  await client.end();
  console.log('Migration applied successfully!');
}

main().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
