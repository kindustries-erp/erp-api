import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

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

  const now = new Date();
  const dateStr = now
    .toISOString()
    .replace(/[-:T.]/g, '')
    .substring(0, 14);
  const batchId = `BATCH_B2B_SME_EXACT_${dateStr}`;

  const bundles = [
    {
      partner: 'CÔNG TY TNHH NHA KHOA THÁI BÌNH DƯƠNG (Lô HĐ 780 + 787)',
      bankTxnId: 'bbe9b686-ee68-49c0-a216-a9dead672c0e',
      transDate: '2026-04-24',
      creditAmount: 12687120,
      invoices: [
        {
          invoiceId: 'e79722f3-a535-4558-94ae-ca80ea115bea',
          invoiceNo: '780',
          amount: 2043720,
          plate: '51G-652.77',
        },
        {
          invoiceId: 'de414216-fbcb-44ad-a123-8040d64f1205',
          invoiceNo: '787',
          amount: 10643400,
          plate: '51G-652.77',
        },
      ],
    },
    {
      partner: 'CÔNG TY TNHH CÔNG NGHIỆP MINH ĐĂNG (Lô HĐ 768 + 769)',
      bankTxnId: 'ecc8a889-e54b-4182-a814-77c0eec72e7b',
      transDate: '2026-04-20',
      creditAmount: 14813700,
      invoices: [
        {
          invoiceId: '430377f1-7131-4ed5-9648-4423ab0e6eb8',
          invoiceNo: '768',
          amount: 2264100,
          plate: '51K-042.91',
        },
        {
          invoiceId: '0cef0b86-5efe-4636-b7d4-2b7aebb690c3',
          invoiceNo: '769',
          amount: 12549600,
          plate: '51K-042.91',
        },
      ],
    },
    {
      partner: 'CÔNG TY TNHH NHA KHOA THÁI BÌNH DƯƠNG (HĐ 1431)',
      bankTxnId: '15fe9ec5-23a5-4839-a3da-72fe73728a34',
      transDate: '2026-09-04',
      creditAmount: 8920800,
      invoices: [
        {
          invoiceId: '507eeeed-6e40-4785-a6e0-f88061499d7a',
          invoiceNo: '1431',
          amount: 8920800,
          plate: '51G-652.77',
        },
      ],
    },
  ];

  try {
    await client.query('SET synchronous_commit = off');
    await client.query('BEGIN');

    console.log(
      `\n===================================================================`,
    );
    console.log(
      `BẮT ĐẦU CẤN TRỪ CÁC LÔ DOANH NGHIỆP B2B KHỚP 100% (BATCH: ${batchId})`,
    );
    console.log(
      `===================================================================`,
    );

    let totalInserted = 0;
    let totalAmount = 0;

    for (const b of bundles) {
      console.log(
        `\n📌 Lô: ${b.partner} (GD ngày ${b.transDate} - Tiền: ${b.creditAmount.toLocaleString()} VNĐ):`,
      );
      for (const inv of b.invoices) {
        const invCheck = await client.query(
          'SELECT total_amount, tax_invoice_status FROM erp_invoices WHERE id = $1',
          [inv.invoiceId],
        );
        if (
          invCheck.rows.length === 0 ||
          invCheck.rows[0].tax_invoice_status === 4
        ) {
          throw new Error(`Hóa đơn ${inv.invoiceNo} không hợp lệ!`);
        }

        await client.query(
          `
          INSERT INTO erp_invoice_voucher_netoff (
            id, invoice_id, bank_transaction_id, net_off_amount, created_at, updated_at
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, NOW(), NOW()
          )
        `,
          [inv.invoiceId, b.bankTxnId, inv.amount],
        );

        console.log(
          `   -> HĐ ${inv.invoiceNo} [Xe: ${inv.plate}] : ${inv.amount.toLocaleString()} VNĐ`,
        );
        totalInserted++;
        totalAmount += inv.amount;
      }
    }

    await client.query('COMMIT');

    console.log(
      `\n===================================================================`,
    );
    console.log(
      `🎉 HOÀN TẤT THÀNH CÔNG COMMIT VÀO DATABASE (BATCH: ${batchId})`,
    );
    console.log(`- Đã cấn trừ thành công: ${totalInserted} Hóa đơn B2B`);
    console.log(
      `- Tổng giá trị cấn trừ mới: ${totalAmount.toLocaleString()} VNĐ`,
    );
    console.log(
      `===================================================================\n`,
    );
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Lỗi khi thực hiện commit, đã ROLLBACK:', err);
    throw err;
  } finally {
    await client.end();
    console.log('🔒 Đã đóng kết nối DB.');
  }
}

main().catch((err) => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
