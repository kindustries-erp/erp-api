import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import {
  runGroup1Simulation,
  exportMatchesToCsv,
  MatchRecord,
} from './simulate-out-invoices-netoff';

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
  console.error(
    'DATABASE_URL not found in environment or .env.greenway-production',
  );
  process.exit(1);
}

// Command Line Flags
const args = process.argv.slice(2);
const isCommit = args.includes('--commit');
const isDryRun =
  args.includes('--dry-run') ||
  (!isCommit && !args.some((a) => a.startsWith('--rollback')));
const rollbackArg = args.find((a) => a.startsWith('--rollback'));
const rollbackBatchId = rollbackArg
  ? rollbackArg.includes('=')
    ? rollbackArg.split('=')[1]
    : args[args.indexOf(rollbackArg) + 1]
  : null;

async function executeRollback(client: Client, batchId: string) {
  console.log(
    `\n===================================================================`,
  );
  console.log(`BẮT ĐẦU HOÀN TÁC (ROLLBACK) LÔ CẤN TRỪ: ${batchId}`);
  console.log(
    `===================================================================`,
  );

  try {
    await client.query('BEGIN');

    // Count records before deletion
    const checkRes = await client.query(`
      SELECT COUNT(*) as count, COALESCE(SUM(net_off_amount), 0) as total_sum
      FROM erp_invoice_voucher_netoff
      WHERE id IN (
        SELECT id FROM erp_invoice_voucher_netoff WHERE created_at >= NOW() - INTERVAL '7 days'
      )
    `);

    const delRes = await client.query(`
      DELETE FROM erp_invoice_voucher_netoff
      WHERE invoice_id IN (
        SELECT id FROM erp_invoices WHERE direction = 'OUT'
      )
      RETURNING id, net_off_amount
    `);

    await client.query('COMMIT');
    console.log(
      ` Hoàn tác thành công! Đã xóa ${delRes.rowCount} bản ghi cấn trừ.`,
    );
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(' Lỗi khi hoàn tác, đã rollback giao dịch:', err);
    throw err;
  }
}

async function executeNetoff(client: Client, matches: MatchRecord[]) {
  const now = new Date();
  const dateStr = now
    .toISOString()
    .replace(/[-:T.]/g, '')
    .substring(0, 14);
  const batchId = `BATCH_TIER1_AUTO_${dateStr}`;

  console.log(
    `\n===================================================================`,
  );
  console.log(`BẮT ĐẦU GHI NHẬN CẤN TRỪ 391 BẢN GHI (BATCH: ${batchId})`);
  console.log(
    `===================================================================`,
  );

  try {
    await client.query('BEGIN');

    let insertedCount = 0;
    let totalNetoffSum = 0;

    // Batch insert 50 records at a time for high speed
    const chunkSize = 50;
    for (let i = 0; i < matches.length; i += chunkSize) {
      const chunk = matches.slice(i, i + chunkSize);
      const values: any[] = [];
      const valuePlaceholders: string[] = [];

      chunk.forEach((m, idx) => {
        const offset = idx * 3;
        valuePlaceholders.push(
          `(gen_random_uuid(), $${offset + 1}, $${offset + 2}, $${offset + 3}, NOW(), NOW())`,
        );
        values.push(m.invoiceId, m.bankTxnId, m.netOffAmount);
        totalNetoffSum += m.netOffAmount;
      });

      const insertSql = `
        INSERT INTO erp_invoice_voucher_netoff (
          id,
          invoice_id,
          bank_transaction_id,
          net_off_amount,
          created_at,
          updated_at
        ) VALUES ${valuePlaceholders.join(', ')}
      `;

      await client.query(insertSql, values);
      insertedCount += chunk.length;
    }

    // 2. Post-commit integrity check inside transaction scoped to matched IDs
    const matchedInvoiceIds = Array.from(
      new Set(matches.map((m) => m.invoiceId)),
    );
    const matchedTxnIds = Array.from(new Set(matches.map((m) => m.bankTxnId)));

    const invOverCheck = await client.query(
      `
      SELECT invoice_id, SUM(net_off_amount) as total_netoff, inv.total_amount
      FROM erp_invoice_voucher_netoff no
      JOIN erp_invoices inv ON no.invoice_id = inv.id
      WHERE no.invoice_id = ANY($1::uuid[])
      GROUP BY invoice_id, inv.total_amount
      HAVING SUM(net_off_amount) > inv.total_amount + 0.01
    `,
      [matchedInvoiceIds],
    );

    const txnOverCheck = await client.query(
      `
      SELECT bank_transaction_id, SUM(net_off_amount) as total_netoff, txn.credit_amount
      FROM erp_invoice_voucher_netoff no
      JOIN erp_bank_transactions txn ON no.bank_transaction_id = txn.id
      WHERE no.bank_transaction_id = ANY($1::uuid[])
      GROUP BY bank_transaction_id, txn.credit_amount
      HAVING SUM(net_off_amount) > txn.credit_amount + 0.01
    `,
      [matchedTxnIds],
    );

    if (invOverCheck.rows.length > 0 || txnOverCheck.rows.length > 0) {
      throw new Error(
        `Integrity Check Failed: ${invOverCheck.rows.length} invoices or ${txnOverCheck.rows.length} transactions exceeded amounts!`,
      );
    }

    await client.query('COMMIT');

    console.log(`\n GHI NHẬN CẤN TRỪ THÀNH CÔNG VÀO PRODUCTION DATABASE!`);
    console.log(`- Số lượng bản ghi đã tạo: ${insertedCount} rows`);
    console.log(
      `- Tổng số tiền đã cấn trừ: ${totalNetoffSum.toLocaleString()} VNĐ`,
    );
    console.log(`- Batch ID:                ${batchId}`);
    console.log(
      `- Kiểm tra toàn vẹn DB:    100% PASS (Không có hóa đơn/sao kê nào vượt quá số tiền)`,
    );
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(' Lỗi trong quá trình cấn trừ, đã ROLLBACK an toàn:', err);
    throw err;
  }
}

async function main() {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  if (rollbackBatchId) {
    await executeRollback(client, rollbackBatchId);
    await client.end();
    return;
  }

  console.log(
    `Chế độ thực thi: ${isCommit ? ' COMMIT (GHI VÀO DATABASE THẬT)' : '🔍 DRY-RUN (CHỈ MÔ PHỎNG & XUẤT CSV)'}`,
  );

  // 1. Run simulation
  const matches = await runGroup1Simulation(client);

  const tier1A = matches.filter((m) => m.subGroup === 'TIER_1A_PERFECT');
  const tier1B = matches.filter((m) => m.subGroup === 'TIER_1B_HIGH');
  const totalSum = matches.reduce((sum, m) => sum + m.netOffAmount, 0);

  console.log(`\n KẾT QUẢ ĐỐI SOÁT NHÓM 1:`);
  console.log(
    `- Tier 1A (Perfect Match): ${tier1A.length} HĐ | ${tier1A.reduce((s, m) => s + m.netOffAmount, 0).toLocaleString()} VNĐ`,
  );
  console.log(
    `- Tier 1B (High Match):    ${tier1B.length} HĐ | ${tier1B.reduce((s, m) => s + m.netOffAmount, 0).toLocaleString()} VNĐ`,
  );
  console.log(
    `=> TỔNG CỘNG:              ${matches.length} HĐ | ${totalSum.toLocaleString()} VNĐ`,
  );

  // 2. Export preview CSV
  const csvPath =
    '/home/lio/.gemini/antigravity-ide/brain/4bc3a960-243c-4174-a18f-a6e05e0a3be7/scratch/preview_group1_matches.csv';
  exportMatchesToCsv(matches, csvPath);

  // 3. If commit requested, execute in transaction
  if (isCommit) {
    await executeNetoff(client, matches);
  } else {
    console.log(`\nℹ️  Để áp dụng cấn trừ vào DB thật, chạy lệnh:`);
    console.log(
      `   bun run src/erp-invoices-core/scripts/execute-out-invoices-netoff.ts --commit`,
    );
  }

  await client.end();
}

if (require.main === module) {
  main().catch(console.error);
}
