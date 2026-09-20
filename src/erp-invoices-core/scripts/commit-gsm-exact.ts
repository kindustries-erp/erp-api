import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { findExactGsmMatches } from './simulate-exact-gsm-and-adjustments';

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

async function main() {
  const client = new Client({
    connectionString: dbUrl,
    connectionTimeoutMillis: 10000,
  });

  await client.connect();
  console.log('✅ Đã kết nối tới Database Greenway Production.');

  try {
    const matches = await findExactGsmMatches(client);
    console.log(`🔍 Tìm thấy ${matches.length} Hóa đơn GSM khớp 100% số tiền:`);
    for (const m of matches) {
      console.log(
        `  - [${m.topology}] HĐ ${m.invoiceNo} (${m.vehiclePlate}) -> ${m.netOffAmount.toLocaleString()} VNĐ | GD: ${m.transDate} (${m.description.slice(0, 40)}...)`,
      );
    }

    if (matches.length === 0) {
      console.log('ℹ️ Không có bản ghi nào cần cấn trừ!');
      return;
    }

    console.log('\n🚀 Đang thực hiện INSERT cấn trừ vào DB...');
    await client.query('SET synchronous_commit = off');
    await client.query('BEGIN');

    for (const m of matches) {
      console.log(
        `   -> Inserting netoff cho HĐ ${m.invoiceNo} (Số tiền: ${m.netOffAmount.toLocaleString()} VNĐ)...`,
      );
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
    }

    await client.query('COMMIT');
    console.log('\n🎉 COMMIT THÀNH CÔNG TOÀN BỘ 5 HÓA ĐƠN GSM VÀO DATABASE!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Lỗi khi thực hiện commit:', err);
    throw err;
  } finally {
    await client.end();
    console.log('🔒 Đã đóng kết nối DB.');
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
