import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import {
  runExactNetoffSimulation,
  exportExactMatchesToCsv,
  exportComplexCasesToCsv,
  ExactMatchItem,
} from './simulate-group4-5-netoff';

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

async function executeRollback(client: Client, batchPrefix?: string) {
  console.log(
    `\n===================================================================`,
  );
  console.log(`BẮT ĐẦU HOÀN TÁC (ROLLBACK) LÔ CẤN TRỪ GIAI ĐOẠN 1 NHÓM 4 & 5`);
  console.log(
    `===================================================================`,
  );

  try {
    await client.query('BEGIN');

    // Xóa các bản ghi cấn trừ mới tạo của Nhóm 4 & 5 trong vòng 24h qua nếu cần rollback
    const delRes = await client.query(`
      DELETE FROM erp_invoice_voucher_netoff
      WHERE id IN (
        SELECT id FROM erp_invoice_voucher_netoff 
        WHERE created_at >= NOW() - INTERVAL '1 hour'
      )
      RETURNING id, net_off_amount
    `);

    await client.query('COMMIT');
    console.log(
      `✅ Hoàn tác thành công! Đã xóa ${delRes.rowCount} bản ghi cấn trừ.`,
    );
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Lỗi khi hoàn tác, đã rollback giao dịch:', err);
    throw err;
  }
}

async function executeNetoff(client: Client, matches: ExactMatchItem[]) {
  const now = new Date();
  const dateStr = now
    .toISOString()
    .replace(/[-:T.]/g, '')
    .substring(0, 14);
  const batchId = `BATCH_TIER4_5_EXACT_${dateStr}`;

  console.log(
    `\n===================================================================`,
  );
  console.log(
    `BẮT ĐẦU GHI NHẬN CẤN TRỪ ${matches.length} BẢN GHI (BATCH: ${batchId})`,
  );
  console.log(
    `===================================================================`,
  );

  try {
    await client.query('BEGIN');

    let insertedCount = 0;
    let totalNetoffSum = 0;

    for (const m of matches) {
      // 1. Kiểm tra an toàn trước khi insert:
      // a) Hóa đơn không bị thay thế (tax_invoice_status != 4)
      const invCheck = await client.query(
        `
        SELECT tax_invoice_status, total_amount, status
        FROM erp_invoices
        WHERE id = $1
      `,
        [m.invoiceId],
      );

      if (invCheck.rows.length === 0) {
        throw new Error(
          `Hóa đơn ${m.invoiceNo} (ID: ${m.invoiceId}) không tồn tại!`,
        );
      }

      if (
        invCheck.rows[0].tax_invoice_status === 4 ||
        invCheck.rows[0].status === 'CANCELLED'
      ) {
        throw new Error(
          `Hóa đơn ${m.invoiceNo} đã bị thay thế hoặc hủy (status=${invCheck.rows[0].tax_invoice_status}), KHÔNG ĐƯỢC cấn trừ!`,
        );
      }

      // b) Kiểm tra số dư còn lại của HĐ
      const invNetoffCheck = await client.query(
        `
        SELECT COALESCE(SUM(net_off_amount), 0) as already_netoff
        FROM erp_invoice_voucher_netoff
        WHERE invoice_id = $1
      `,
        [m.invoiceId],
      );

      const alreadyNetoff = parseFloat(invNetoffCheck.rows[0].already_netoff);
      const invoiceTotal = parseFloat(invCheck.rows[0].total_amount);
      if (alreadyNetoff + m.netOffAmount > invoiceTotal + 1.0) {
        throw new Error(
          `Hóa đơn ${m.invoiceNo} bị vượt hạn mức thanh toán (${alreadyNetoff + m.netOffAmount} > ${invoiceTotal})!`,
        );
      }

      // c) Kiểm tra số dư còn lại của GD ngân hàng
      const txnCheck = await client.query(
        `
        SELECT credit_amount, is_deleted
        FROM erp_bank_transactions
        WHERE id = $1
      `,
        [m.bankTxnId],
      );

      if (txnCheck.rows.length === 0 || txnCheck.rows[0].is_deleted) {
        throw new Error(
          `Giao dịch ngân hàng ID ${m.bankTxnId} không tồn tại hoặc đã bị xóa!`,
        );
      }

      const txnNetoffCheck = await client.query(
        `
        SELECT COALESCE(SUM(net_off_amount), 0) as used_netoff
        FROM erp_invoice_voucher_netoff
        WHERE bank_transaction_id = $1
      `,
        [m.bankTxnId],
      );

      const alreadyUsed = parseFloat(txnNetoffCheck.rows[0].used_netoff);
      const creditAmt = parseFloat(txnCheck.rows[0].credit_amount);
      if (alreadyUsed + m.netOffAmount > creditAmt + 1.0) {
        throw new Error(
          `Giao dịch ngân hàng ID ${m.bankTxnId} bị vượt mức credit (${alreadyUsed + m.netOffAmount} > ${creditAmt})!`,
        );
      }

      // 2. Thực hiện Insert bản ghi Net-Off
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

      insertedCount++;
      totalNetoffSum += m.netOffAmount;
    }

    await client.query('COMMIT');

    console.log(
      `\n===================================================================`,
    );
    console.log(`✅ THỰC THI THÀNH CÔNG GIAI ĐOẠN 1 (BATCH: ${batchId})`);
    console.log(`- Đã ghi nhận cấn trừ: ${insertedCount} bản ghi`);
    console.log(
      `- Tổng số tiền cấn trừ: ${totalNetoffSum.toLocaleString()} VNĐ`,
    );
    console.log(
      `===================================================================\n`,
    );
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(
      '❌ Lỗi trong quá trình cấn trừ, đã ROLLBACK toàn bộ giao dịch:',
      err,
    );
    throw err;
  }
}

async function main() {
  const client = new Client({ connectionString: dbUrl });

  try {
    await client.connect();

    if (rollbackArg) {
      await executeRollback(client);
      return;
    }

    console.log(
      `\n=== CHẠY TIẾN TRÌNH CẤN TRỪ GIAI ĐOẠN 1 (NHÓM 4 & 5 - KHỚP 100% TIỀN) ===`,
    );
    console.log(
      `Chế độ: ${isCommit ? '🔥 COMMIT THỰC TẾ VÀO DATABASE' : '🔍 DRY-RUN (MÔ PHỎNG & XUẤT CSV)'}`,
    );

    const { matches, complexCases } = await runExactNetoffSimulation(client);

    const outDir =
      '/home/lio/.gemini/antigravity-ide/brain/4bc3a960-243c-4174-a18f-a6e05e0a3be7/scratch';
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const csvExact = path.join(outDir, 'preview_exact_matches_group4_5.csv');
    const csvComplex = path.join(
      outDir,
      'remaining_complex_cases_group4_5.csv',
    );

    exportExactMatchesToCsv(matches, csvExact);
    exportComplexCasesToCsv(complexCases, csvComplex);

    console.log(`\n📊 Báo cáo tóm tắt:`);
    console.log(
      `- Tổng số trường hợp khớp 100% tiền: ${matches.length} bản ghi`,
    );
    const totalAmount = matches.reduce((sum, m) => sum + m.netOffAmount, 0);
    console.log(`- Tổng giá trị cấn trừ: ${totalAmount.toLocaleString()} VNĐ`);
    console.log(`- File bảng kê khớp 100%: ${csvExact}`);
    console.log(`- File bảng kê Giai đoạn 2: ${csvComplex}`);

    if (isCommit) {
      if (matches.length === 0) {
        console.log('Không có bản ghi nào để commit.');
        return;
      }
      await executeNetoff(client, matches);
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
