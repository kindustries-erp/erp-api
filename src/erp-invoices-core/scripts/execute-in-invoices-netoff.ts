import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Load config from .env.greenway-production
const envCandidates = [
  path.resolve(__dirname, '../../../.env.greenway-production'),
  path.resolve(process.cwd(), '.env.greenway-production'),
  '/home/dev/repos/erp/erp-api/.env.greenway-production',
];

let dbUrl = process.env.DATABASE_URL;

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/^DATABASE_URL=(.+)$/m);
    if (match) {
      dbUrl = match[1].trim();
      break;
    }
  }
}

if (!dbUrl) {
  console.error('DATABASE_URL not found in .env.greenway-production');
  process.exit(1);
}

export async function executeInNetOff(previewJsonPath: string) {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  console.log('Connected to Production Database.');
  console.log(`Reading proposed netoffs from ${previewJsonPath}...`);

  const raw = fs.readFileSync(previewJsonPath, 'utf8');
  const netOffs: any[] = JSON.parse(raw);

  console.log(`Loaded ${netOffs.length} netoff entries to insert.`);

  try {
    // 1. Performance optimization for remote pooler/pgbouncer
    await client.query('SET synchronous_commit = off;');
    await client.query('BEGIN;');

    console.log('Transaction started.');

    let insertedCount = 0;
    let totalInsertedAmount = 0;

    for (const item of netOffs) {
      const res = await client.query(
        `
        INSERT INTO erp_invoice_voucher_netoff (
          invoice_id,
          bank_transaction_id,
          net_off_amount,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, NOW(), NOW())
        RETURNING id;
      `,
        [item.invoiceId, item.bankTxnId, item.netOffAmount],
      );

      insertedCount++;
      totalInsertedAmount += item.netOffAmount;
    }

    console.log(
      `Inserted ${insertedCount} net-off records (Total: ${totalInsertedAmount.toLocaleString('vi-VN')} đ).`,
    );

    // 2. Post-execution strict audits inside transaction
    console.log('Running zero over-allocation audits...');

    // Audit Invoices
    const invAudit = await client.query(`
      SELECT inv.id, inv.invoice_no, inv.total_amount, SUM(no.net_off_amount) as total_netoff
      FROM erp_invoices inv
      JOIN erp_invoice_voucher_netoff no ON no.invoice_id = inv.id
      WHERE inv.direction = 'IN'
      GROUP BY inv.id
      HAVING (inv.total_amount - SUM(no.net_off_amount)) < -0.01;
    `);

    if (invAudit.rows.length > 0) {
      throw new Error(
        `Invoice over-allocation detected! ${invAudit.rows.length} invoices exceeded total amount.`,
      );
    }

    // Audit Bank Transactions
    const txnAudit = await client.query(`
      SELECT txn.id, txn.debit_amount, SUM(no.net_off_amount) as total_netoff
      FROM erp_bank_transactions txn
      JOIN erp_invoice_voucher_netoff no ON no.bank_transaction_id = txn.id
      WHERE txn.debit_amount > 0
      GROUP BY txn.id
      HAVING (txn.debit_amount - SUM(no.net_off_amount)) < -0.01;
    `);

    if (txnAudit.rows.length > 0) {
      throw new Error(
        `Bank Transaction over-allocation detected! ${txnAudit.rows.length} transactions exceeded debit amount.`,
      );
    }

    console.log(
      '✅ Audit passed: 0 over-allocated invoices, 0 over-allocated bank transactions.',
    );

    await client.query('COMMIT;');
    console.log('🚀 TRANSACTION COMMITTED SUCCESSFULLY!');

    return {
      success: true,
      count: insertedCount,
      totalAmount: totalInsertedAmount,
    };
  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('❌ TRANSACTION ROLLED BACK DUE TO ERROR:', err);
    throw err;
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  const jsonPath =
    process.argv[2] ||
    '/home/lio/.gemini/antigravity-ide/brain/cc8a46ac-52d5-4771-afda-bb13df38dcf8/scratch/clean_in_netoffs.json';
  executeInNetOff(jsonPath)
    .then((res) => {
      console.log('Done:', res);
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
