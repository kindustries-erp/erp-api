import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Support optional env file flag or default to current .env
const envFile = process.argv.find((a) => a.startsWith('--env='))?.split('=')[1] || '.env';
dotenv.config({ path: path.resolve(process.cwd(), envFile), override: true });

const isDryRun = process.argv.includes('--dry-run');

/**
 * Script backfill & đồng bộ toàn bộ cấn trừ Hóa đơn - Sao kê sang Vụ việc Garage (kgara_case_settlements)
 *
 * Chạy thử nghiệm an toàn:
 *   bun scripts/sync-invoice-netoffs-to-case-settlements.ts --env=.env.greenway-production --dry-run
 *
 * Chạy thực thi cập nhật:
 *   bun scripts/sync-invoice-netoffs-to-case-settlements.ts --env=.env.greenway-production
 */

async function main() {
  console.log(`\n================================================================`);
  console.log(`🔄 BẮT ĐẦU ĐỒNG BỘ CẤN TRỪ HÓA ĐƠN SANG VỤ VIỆC GARAGE`);
  console.log(`Mode: ${isDryRun ? 'DRY-RUN (CHỈ KIỂM TRA, KHÔNG GHI DB)' : 'THỰC THI (APPLY TO DB)'}`);
  console.log(`Target Env: ${envFile}`);
  console.log(`DB Host: ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[0]}`);
  console.log(`DB Name: ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[1]?.split('?')[0]}`);
  console.log(`================================================================\n`);

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    // 1. Quét tất cả Vụ việc có Hóa đơn liên kết đã được cấn trừ sao kê
    const candidateCases = await client.query(`
      SELECT DISTINCT c.id as case_id, c.so_chung_tu, c.bien_so_xe, c.khach_hang_name,
             c.tien_co_thue, c.tien_da_thanh_toan, c.tien_con_phai_thanh_toan,
             c.raw_data, c.doanh_thu
      FROM kgara_cases c
      LEFT JOIN kgara_case_linked_invoice l ON l."caseDbId" = c.id
      JOIN erp_invoices i ON (l."invoiceId" = i.id OR c.so_chung_tu = i.settlement_order)
      JOIN erp_invoice_voucher_netoff n ON n.invoice_id = i.id
      WHERE c.kgara_deleted_at IS NULL
      ORDER BY c.so_chung_tu
    `);

    console.log(`📌 Tìm thấy ${candidateCases.rows.length} vụ việc có hóa đơn liên kết đã cấn trừ sao kê.`);

    let updatedCount = 0;

    for (const c of candidateCases.rows) {
      const caseId = c.case_id;
      const caseCode = c.so_chung_tu;

      // Lấy danh sách net-off từ các hóa đơn liên kết với vụ việc này
      const netOffs = await client.query(`
        SELECT 
          n.bank_transaction_id,
          SUM(n.net_off_amount) as total_net_off,
          t.trans_date,
          COALESCE(t.correspondent_name, i.buyer_name, i.seller_name) as partner_name,
          t.description,
          i.direction,
          string_agg(DISTINCT i.invoice_no, ', ') as invoice_nos
        FROM erp_invoice_voucher_netoff n
        JOIN erp_invoices i ON i.id = n.invoice_id
        LEFT JOIN erp_bank_transactions t ON t.id = n.bank_transaction_id
        WHERE n.invoice_id IN (
          SELECT DISTINCT l."invoiceId" 
          FROM kgara_case_linked_invoice l 
          WHERE l."caseDbId" = $1
          UNION
          SELECT id 
          FROM erp_invoices 
          WHERE settlement_order = $2 AND is_deleted = false AND $2 <> ''
        )
        GROUP BY n.bank_transaction_id, t.trans_date, t.correspondent_name, i.buyer_name, i.seller_name, t.description, i.direction
      `, [caseId, caseCode]);

      if (netOffs.rows.length === 0) continue;

      // Kiểm tra xem case này có cần cập nhật settlement không
      const activeTxnIds: string[] = [];
      let hasChanges = false;

      for (const row of netOffs.rows) {
        if (!row.bank_transaction_id) continue;
        activeTxnIds.push(row.bank_transaction_id);

        const netOffAmount = Number(row.total_net_off || 0);
        const isOut = (row.direction || 'OUT') === 'OUT';
        const targetSettlementType = isOut ? 'RECEIPT' : 'PAYMENT';

        const existing = await client.query(`
          SELECT id, amount, settlement_type FROM kgara_case_settlements
          WHERE case_id = $1 AND bank_transaction_id = $2 LIMIT 1
        `, [caseId, row.bank_transaction_id]);

        if (existing.rows.length === 0) {
          hasChanges = true;
          console.log(`  [+] Vụ việc ${caseCode}: Cần THÊM settlement sao kê (GD ${row.bank_transaction_id}, Tiền: ${netOffAmount.toLocaleString('vi-VN')} đ, HĐ: ${row.invoice_nos})`);
          if (!isDryRun) {
            await client.query(`
              INSERT INTO kgara_case_settlements 
              (id, case_id, bank_transaction_id, settlement_type, source_channel, amount, trans_date, partner_name, note, created_at, updated_at)
              VALUES (gen_random_uuid(), $1, $2, $3, 'ON_SYSTEM', $4, $5, $6, 'Đồng bộ cấn trừ từ hóa đơn liên kết', now(), now())
            `, [
              caseId,
              row.bank_transaction_id,
              targetSettlementType,
              netOffAmount,
              row.trans_date || null,
              row.partner_name || null,
            ]);
          }
        } else if (Number(existing.rows[0].amount) !== netOffAmount) {
          hasChanges = true;
          console.log(`  [*] Vụ việc ${caseCode}: Cần CẬP NHẬT số tiền settlement ${existing.rows[0].id}: ${Number(existing.rows[0].amount).toLocaleString('vi-VN')} đ -> ${netOffAmount.toLocaleString('vi-VN')} đ`);
          if (!isDryRun) {
            await client.query(`
              UPDATE kgara_case_settlements 
              SET amount = $1, settlement_type = $2, trans_date = $3, partner_name = $4, updated_at = now()
              WHERE id = $5
            `, [
              netOffAmount,
              targetSettlementType,
              row.trans_date || null,
              row.partner_name || null,
              existing.rows[0].id,
            ]);
          }
        }
      }

      // Xóa settlement mồ côi nếu có
      if (!isDryRun) {
        if (activeTxnIds.length > 0) {
          await client.query(`
            DELETE FROM kgara_case_settlements
            WHERE case_id = $1 
              AND source_channel = 'ON_SYSTEM'
              AND note LIKE '%hóa đơn liên kết%'
              AND (bank_transaction_id IS NULL OR NOT (bank_transaction_id = ANY($2::uuid[])))
          `, [caseId, activeTxnIds]);
        }
      }

      // Tính lại tổng đã thu và công nợ còn lại
      const sumResult = await client.query(`
        SELECT COALESCE(SUM(amount), 0) as total_receipts
        FROM kgara_case_settlements
        WHERE case_id = $1 AND settlement_type = 'RECEIPT'
      `, [caseId]);

      // Nếu dry run, cộng thêm số tiền mới dự kiến
      let totalReceipts = Number(sumResult.rows[0]?.total_receipts || 0);
      if (isDryRun && hasChanges) {
        // Tạm tính cho log dry-run
        const newReceipts = netOffs.rows
          .filter((r: any) => (r.direction || 'OUT') === 'OUT')
          .reduce((sum: number, r: any) => sum + Number(r.total_net_off || 0), 0);
        const existingManual = await client.query(`
          SELECT COALESCE(SUM(amount), 0) as manual_total
          FROM kgara_case_settlements
          WHERE case_id = $1 AND settlement_type = 'RECEIPT' AND source_channel = 'OFF_SYSTEM_MANUAL'
        `, [caseId]);
        totalReceipts = Number(existingManual.rows[0]?.manual_total || 0) + newReceipts;
      }

      const targetRevenue = Number(c.tien_co_thue || c.doanh_thu || 0);
      const remainingReceivable = Math.max(0, targetRevenue - totalReceipts);

      const beforePaid = Number(c.tien_da_thanh_toan || 0);
      const beforeRemaining = Number(c.tien_con_phai_thanh_toan || 0);

      if (hasChanges || beforePaid !== totalReceipts || beforeRemaining !== remainingReceivable) {
        updatedCount++;
        console.log(`  👉 KẾT QUẢ VỤ VIỆC ${caseCode} (${c.bien_so_xe} - ${c.khach_hang_name}):`);
        console.log(`     - Mục tiêu doanh thu: ${targetRevenue.toLocaleString('vi-VN')} đ`);
        console.log(`     - Đã thu: ${beforePaid.toLocaleString('vi-VN')} đ ➔ ${totalReceipts.toLocaleString('vi-VN')} đ`);
        console.log(`     - Còn nợ: ${beforeRemaining.toLocaleString('vi-VN')} đ ➔ ${remainingReceivable.toLocaleString('vi-VN')} đ`);

        if (!isDryRun) {
          await client.query(`
            UPDATE kgara_cases
            SET tien_da_thanh_toan = $1,
                tien_con_phai_thanh_toan = $2,
                updated_at = now()
            WHERE id = $3
          `, [totalReceipts, remainingReceivable, caseId]);
        }
      }
    }

    console.log(`\n================================================================`);
    console.log(`✅ HOÀN TẤT ĐỒNG BỘ: ${updatedCount} vụ việc được xử lý.`);
    console.log(`================================================================\n`);
  } catch (err: any) {
    console.error('❌ Lỗi khi thực thi script:', err);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
