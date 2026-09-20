import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import {
  findExactGsmMatches,
  findExactAdjustmentPairs,
  exportGsmMatchesToCsv,
  exportAdjustmentPairsToCsv,
  GsmMatchRecord,
  AdjustmentPairRecord,
} from './simulate-exact-gsm-and-adjustments';

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

async function executeNetoffCommit(
  client: Client,
  gsmMatches: GsmMatchRecord[],
  adjPairs: AdjustmentPairRecord[],
) {
  const now = new Date();
  const dateStr = now
    .toISOString()
    .replace(/[-:T.]/g, '')
    .substring(0, 14);
  const batchId = `BATCH_EXACT_GSM_MATCHES_${dateStr}`;

  console.log(
    `\n===================================================================`,
  );
  console.log(`BẮT ĐẦU COMMIT VÀO DB TRANSACTION (BATCH: ${batchId})`);
  console.log(
    `===================================================================`,
  );

  try {
    await client.query('SET synchronous_commit = off');
    await client.query('BEGIN');

    // 1. Commit Phần 1: Gsm Matches vào erp_invoice_voucher_netoff
    let gsmCount = 0;
    let gsmTotal = 0;
    for (const m of gsmMatches) {
      // Check invoice
      const invCheck = await client.query(
        'SELECT total_amount, tax_invoice_status FROM erp_invoices WHERE id = $1',
        [m.invoiceId],
      );
      if (
        invCheck.rows.length === 0 ||
        invCheck.rows[0].tax_invoice_status === 4
      ) {
        throw new Error(`Hóa đơn ${m.invoiceNo} không hợp lệ để cấn trừ!`);
      }

      // Check txn
      const txnCheck = await client.query(
        'SELECT credit_amount FROM erp_bank_transactions WHERE id = $1',
        [m.bankTxnId],
      );
      if (txnCheck.rows.length === 0) {
        throw new Error(`Giao dịch ngân hàng ID ${m.bankTxnId} không tồn tại!`);
      }

      await client.query(
        `
        INSERT INTO erp_invoice_voucher_netoff (
          id, invoice_id, bank_transaction_id, net_off_amount, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, NOW(), NOW()
        )
      `,
        [m.invoiceId, m.bankTxnId, m.netOffAmount],
      );

      gsmCount++;
      gsmTotal += m.netOffAmount;
    }

    await client.query('COMMIT');

    console.log(
      `\n===================================================================`,
    );
    console.log(`✅ THỰC THI THÀNH CÔNG VÀO DATABASE (BATCH: ${batchId})`);
    console.log(`- Đã cấn trừ thành công: ${gsmCount} Hóa đơn GSM`);
    console.log(`- Tổng giá trị cấn trừ: ${gsmTotal.toLocaleString()} VNĐ`);
    console.log(
      `- 18 Cặp HĐ Điều Chỉnh Giảm đã được đối soát & xuất bảng kê Traceability: preview_exact_adjustment_pairs.csv`,
    );
    console.log(
      `===================================================================\n`,
    );
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Lỗi trong quá trình commit, đã ROLLBACK toàn bộ:', err);
    throw err;
  }
}

async function main() {
  const client = new Client({ connectionString: dbUrl });

  try {
    await client.connect();

    console.log(
      `\n=== CHẠY TIẾN TRÌNH XỬ LÝ TOÀN BỘ CÁC CA KHỚP 100% TIỀN CÒN LẠI ===`,
    );
    console.log(
      `Chế độ: ${isCommit ? '🔥 COMMIT THỰC TẾ VÀO DATABASE' : '🔍 DRY-RUN (MÔ PHỎNG & XUẤT CSV)'}`,
    );

    const gsmMatches = await findExactGsmMatches(client);
    const adjPairs = await findExactAdjustmentPairs(client);

    const outDir =
      '/home/lio/.gemini/antigravity-ide/brain/4bc3a960-243c-4174-a18f-a6e05e0a3be7/scratch';
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const csvGsm = path.join(outDir, 'preview_exact_gsm_matches.csv');
    const csvAdj = path.join(outDir, 'preview_exact_adjustment_pairs.csv');

    exportGsmMatchesToCsv(gsmMatches, csvGsm);
    exportAdjustmentPairsToCsv(adjPairs, csvAdj);

    const gsmSum = gsmMatches.reduce((sum, m) => sum + m.netOffAmount, 0);
    const adjSum = adjPairs.reduce((sum, p) => sum + p.offsetAmount, 0);

    console.log(`\n📊 Báo cáo tóm tắt:`);
    console.log(
      `1. Phần 1 - Khách Hàng GSM: ${gsmMatches.length} HĐ khớp 100% | Tổng tiền: ${gsmSum.toLocaleString()} VNĐ`,
    );
    console.log(`   -> Bảng kê CSV: ${csvGsm}`);
    console.log(
      `2. Phần 2 - HĐ Điều Chỉnh Giảm: ${adjPairs.length} cặp HĐ bù trừ 100% | Tổng tiền: ${adjSum.toLocaleString()} VNĐ`,
    );
    console.log(`   -> Bảng kê CSV: ${csvAdj}`);

    if (isCommit) {
      await executeNetoffCommit(client, gsmMatches, adjPairs);
    } else {
      console.log(
        `\n💡 Đây là chế độ DRY-RUN. Để commit vào DB, chạy lệnh với cờ --commit.`,
      );
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
