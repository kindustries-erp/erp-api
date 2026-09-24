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

function getCombos(arr: any[], k: number): any[][] {
  if (k === 1) return arr.map((x) => [x]);
  const combos: any[][] = [];
  for (let i = 0; i <= arr.length - k; i++) {
    const head = arr[i];
    const tailCombos = getCombos(arr.slice(i + 1), k - 1);
    for (const t of tailCombos) {
      combos.push([head, ...t]);
    }
  }
  return combos;
}

function findSubsetSum(candidates: any[], target: number): any[] | null {
  const n = candidates.length;
  if (n === 0) return null;
  for (let r = 1; r <= Math.min(n, 10); r++) {
    const combo = getCombos(candidates, r);
    for (const c of combo) {
      const sum = c.reduce(
        (s: number, x: any) => s + parseFloat(x.remaining_amount),
        0,
      );
      if (Math.abs(sum - target) < 1.0) {
        return c;
      }
    }
  }
  return null;
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
  const batchId = `BATCH_INSURANCE_BUNDLES_${dateStr}`;

  try {
    await client.query('SET synchronous_commit = off');
    await client.query('BEGIN');

    console.log(
      `\n===================================================================`,
    );
    console.log(`BƯỚC 1: DỌN DẸP 3 HÓA ĐƠN BỊ THAY THẾ (STATUS = 4)`);
    console.log(
      `===================================================================`,
    );

    // 1.1 HĐ 315 -> HĐ 320
    const update315 = await client.query(`
      UPDATE erp_invoice_voucher_netoff
      SET invoice_id = '48abf141-9ebc-4379-a802-4c92aafc1788', updated_at = NOW()
      WHERE id = '0998452c-f745-4143-81e2-2bcdf0daf0e8' AND invoice_id = 'b0002a35-fb65-43c1-ad62-8c00b90741f4'
      RETURNING id, net_off_amount;
    `);
    console.log(
      `  - Đã chuyển cấn trừ từ HĐ 315 (C25TGA) sang HĐ 320 (C26TGA):`,
      update315.rows,
    );

    // 1.2 HĐ 354 -> HĐ 443
    const update354 = await client.query(`
      UPDATE erp_invoice_voucher_netoff
      SET invoice_id = '819600ba-bf43-4dca-85be-527371c387dc', updated_at = NOW()
      WHERE id = 'a960290e-5e2c-477b-9dfb-639eabe78e99' AND invoice_id = '56b0067f-067b-4529-bc6e-c1718efdad39'
      RETURNING id, net_off_amount;
    `);
    console.log(
      `  - Đã chuyển cấn trừ từ HĐ 354 (C26TGA) sang HĐ 443 (C26TGA):`,
      update354.rows,
    );

    // 1.3 HĐ 504 -> HĐ 503
    const update504 = await client.query(`
      UPDATE erp_invoice_voucher_netoff
      SET invoice_id = '59b7904e-e4b0-4897-9122-768dd20c7d15', updated_at = NOW()
      WHERE id = 'e9c101ce-db14-4586-83da-cf1e058e95f3' AND invoice_id = '108c44dc-05b9-4499-b6e8-2ee69b79ae56'
      RETURNING id, net_off_amount;
    `);
    console.log(
      `  - Đã chuyển cấn trừ từ HĐ 504 (C26TGA) sang HĐ 503 (C26TGA):`,
      update504.rows,
    );

    console.log(
      `\n===================================================================`,
    );
    console.log(
      `BƯỚC 2: CẤN TRỪ 24 LÔ GIAO DỊCH BẢO HIỂM KHỚP 100% (60 HÓA ĐƠN)`,
    );
    console.log(
      `===================================================================`,
    );

    // Lấy lại danh sách Invoices và Txns sau khi đã dọn dẹp bước 1
    const invRes = await client.query(`
      SELECT 
        inv.id, inv.invoice_no, inv.serial_no, inv.invoice_date, inv.buyer_name,
        inv.license_plate, inv.settlement_order, inv.total_amount, inv.tax_invoice_status, inv.description,
        COALESCE(SUM(no.net_off_amount), 0) as already_netoff,
        (inv.total_amount - COALESCE(SUM(no.net_off_amount), 0)) as remaining_amount
      FROM erp_invoices inv
      LEFT JOIN erp_invoice_voucher_netoff no ON no.invoice_id = inv.id
      WHERE inv.direction = 'OUT' AND inv.is_deleted = false
        AND inv.status != 'CANCELLED' AND inv.tax_invoice_status IN (1, 2)
      GROUP BY inv.id
      HAVING (inv.total_amount - COALESCE(SUM(no.net_off_amount), 0)) > 0.01
      ORDER BY inv.invoice_date ASC;
    `);

    const txnRes = await client.query(`
      SELECT 
        t.id, (t.trans_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh') as trans_date,
        t.credit_amount, t.description, t.correspondent_name, ba.bank_name,
        COALESCE(SUM(no.net_off_amount), 0) as already_used,
        (t.credit_amount - COALESCE(SUM(no.net_off_amount), 0)) as remaining_amount
      FROM erp_bank_transactions t
      LEFT JOIN erp_bank_accounts ba ON t.bank_account_id = ba.id
      LEFT JOIN erp_invoice_voucher_netoff no ON no.bank_transaction_id = t.id
      WHERE t.is_deleted = false AND t.credit_amount > 0
      GROUP BY t.id, ba.bank_name
      HAVING (t.credit_amount - COALESCE(SUM(no.net_off_amount), 0)) > 0.01
      ORDER BY t.trans_date ASC;
    `);

    const invoices = invRes.rows;
    const txns = txnRes.rows;

    const partnerConfigs = [
      {
        name: 'PJICO',
        filter: (t: any) =>
          (t.description + ' ' + (t.correspondent_name || ''))
            .toUpperCase()
            .includes('PJICO'),
        invFilter: (i: any) =>
          (i.buyer_name || '').toUpperCase().includes('PJICO'),
      },
      {
        name: 'BẢO VIỆT',
        filter: (t: any) => {
          const text = (
            t.description +
            ' ' +
            (t.correspondent_name || '')
          ).toUpperCase();
          return (
            text.includes('BAO VIET') ||
            text.includes('BẢO VIỆT') ||
            text.includes('BHBV') ||
            text.includes('TCT BHBV')
          );
        },
        invFilter: (i: any) => {
          const b = (i.buyer_name || '').toUpperCase();
          return b.includes('BAO VIET') || b.includes('BẢO VIỆT');
        },
      },
      {
        name: 'BSH',
        filter: (t: any) =>
          (t.description + ' ' + (t.correspondent_name || ''))
            .toUpperCase()
            .includes('BSH'),
        invFilter: (i: any) =>
          (i.buyer_name || '').toUpperCase().includes('BSH'),
      },
    ];

    let insertedCount = 0;
    let insertedTotal = 0;
    const usedInvIds = new Set<string>();

    for (const cfg of partnerConfigs) {
      const targetTxns = txns.filter(cfg.filter);
      const targetInvs = invoices.filter(cfg.invFilter);

      for (const t of targetTxns) {
        const tRem = parseFloat(t.remaining_amount);
        const tDate = new Date(t.trans_date);
        const candidates = targetInvs.filter((i: any) => {
          if (usedInvIds.has(i.id)) return false;
          const iDate = new Date(i.invoice_date);
          return iDate.getTime() <= tDate.getTime() + 15 * 86400000;
        });

        const matched = findSubsetSum(candidates.slice(0, 18), tRem);
        if (matched) {
          console.log(
            `\n📌 Cấn trừ Lô ${cfg.name} (GD ngày ${new Date(t.trans_date).toISOString().slice(0, 10)} - Tiền: ${tRem.toLocaleString()} đ):`,
          );
          for (const m of matched) {
            const amt = parseFloat(m.remaining_amount);
            await client.query(
              `
              INSERT INTO erp_invoice_voucher_netoff (
                id, invoice_id, bank_transaction_id, net_off_amount, created_at, updated_at
              ) VALUES (
                gen_random_uuid(), $1, $2, $3, NOW(), NOW()
              )
            `,
              [m.id, t.id, amt],
            );

            console.log(
              `   -> HĐ ${m.invoice_no} (${m.serial_no}) [Xe: ${m.license_plate || 'N/A'}] : ${amt.toLocaleString()} VNĐ`,
            );
            usedInvIds.add(m.id);
            insertedCount++;
            insertedTotal += amt;
          }
        }
      }
    }

    await client.query('COMMIT');

    console.log(
      `\n===================================================================`,
    );
    console.log(
      `🎉 HOÀN TẤT THÀNH CÔNG COMMIT VÀO DATABASE (BATCH: ${batchId})`,
    );
    console.log(
      `- Đã dọn dẹp & chuyển đổi: 3 HĐ bị thay thế (HĐ 315->320, 354->443, 504->503)`,
    );
    console.log(`- Đã cấn trừ thành công: ${insertedCount} Hóa đơn Bảo hiểm`);
    console.log(
      `- Tổng giá trị cấn trừ mới: ${insertedTotal.toLocaleString()} VNĐ`,
    );
    console.log(
      `===================================================================\n`,
    );
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Lỗi khi thực hiện commit, đã ROLLBACK toàn bộ:', err);
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
