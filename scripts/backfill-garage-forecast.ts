import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Support optional env file flag or default to current .env
const envFile =
  process.argv.find((a) => a.startsWith('--env='))?.split('=')[1] || '.env';
dotenv.config({ path: path.resolve(process.cwd(), envFile), override: true });

const isDryRun = process.argv.includes('--dry-run');

/**
 * Script Backfill dự thu tự động (DT-GARA, status EXPECTED) của Garage Domain Hub
 * cho các phiếu dịch vụ đã hoàn tất (status = 3) trong tháng 9 & 10/2026.
 *
 * Quy tắc an toàn:
 * 1. Phiếu đã thu đủ (tien_con_phai_thanh_toan <= 0) => BỎ QUA KHÔNG TẠO DỰ THU.
 * 2. Phiếu còn nợ (tien_con_phai_thanh_toan > 0) => TẠO / CẬP NHẬT phiếu DT-GARA với số tiền còn nợ.
 * 3. Hạn dự thu: ngay_hoan_thanh_cong_viec + 7 ngày (hoặc ngay_phat_sinh + 7 ngày).
 * 4. Bảo vệ tuyệt đối các phiếu đã PAID / APPROVED không bị can thiệp.
 *
 * Chạy thử nghiệm an toàn:
 *   bun --env-file=.env scripts/backfill-garage-forecast.ts --dry-run
 *
 * Chạy thực thi ghi DB:
 *   bun --env-file=.env scripts/backfill-garage-forecast.ts
 */

function generateVoucherCode(completionDate?: Date | null): string {
  const base = completionDate ? new Date(completionDate) : new Date();
  const y = String(base.getFullYear()).slice(-2);
  const m = String(base.getMonth() + 1).padStart(2, '0');
  const d = String(base.getDate()).padStart(2, '0');
  const dateStr = `${y}${m}${d}`;
  const suffix =
    Date.now().toString().slice(-4) +
    Math.floor(Math.random() * 100)
      .toString()
      .padStart(2, '0');
  return `DT-GARA-${dateStr}-${suffix}`;
}

function computeTransDate(completionDate?: Date | null, issueDate?: Date | null): string {
  const base = completionDate ? new Date(completionDate) : issueDate ? new Date(issueDate) : new Date();
  const target = new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000);
  const y = target.getFullYear();
  const m = String(target.getMonth() + 1).padStart(2, '0');
  const d = String(target.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function main() {
  console.log(`\n================================================================`);
  console.log(`🚗 BẮT ĐẦU BACKFILL DỰ THU GARAGE HUB (THÁNG 9 & 10/2026)`);
  console.log(
    `Mode: ${isDryRun ? '🔍 DRY-RUN (CHỈ KIỂM TRA, KHÔNG GHI DB)' : '⚡ THỰC THI (APPLY TO DB)'}`,
  );
  console.log(`Target Env: ${envFile}`);
  console.log(`================================================================\n`);

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  await client.connect();

  try {
    const currentDbRes = await client.query('SELECT current_database();');
    const currentDb = currentDbRes.rows[0].current_database;
    console.log(`📌 Database kết nối thực tế: [ ${currentDb} ]\n`);

    // 1. Quét toàn bộ phiếu dịch vụ đã kết thúc (status = 3) trong tháng 9 & 10/2026
    const casesRes = await client.query(`
      SELECT id, so_chung_tu, bien_so_xe, khach_hang_name, tinh_trang_dich_vu,
             ngay_hoan_thanh_cong_viec, ngay_phat_sinh, tien_co_thue, tien_da_thanh_toan,
             tien_con_phai_thanh_toan
      FROM kgara_cases
      WHERE tinh_trang_dich_vu = 3
        AND (
          (ngay_hoan_thanh_cong_viec >= '2026-09-01' AND ngay_hoan_thanh_cong_viec < '2026-11-01')
          OR (ngay_hoan_thanh_cong_viec IS NULL AND ngay_phat_sinh >= '2026-09-01' AND ngay_phat_sinh < '2026-11-01')
        )
      ORDER BY COALESCE(ngay_hoan_thanh_cong_viec, ngay_phat_sinh) ASC, so_chung_tu ASC;
    `);

    const cases = casesRes.rows;
    console.log(
      `📊 Tổng số phiếu dịch vụ kết thúc trong tháng 9 & 10/2026: ${cases.length} phiếu.`,
    );

    let skippedPaidCount = 0;
    let createdCount = 0;
    let updatedCount = 0;
    let protectedCount = 0;
    let totalExpectedAmount = 0;

    for (const c of cases) {
      const caseId = c.id;
      const soChungTu = c.so_chung_tu;
      const bienSoXe = c.bien_so_xe || 'Không BSX';
      const khachHang = c.khach_hang_name || 'Khách vãng lai';
      const tienConLai = Math.max(0, Number(c.tien_con_phai_thanh_toan ?? 0));
      const transDate = computeTransDate(c.ngay_hoan_thanh_cong_viec, c.ngay_phat_sinh);

      // Rule: Nếu đã thu đủ (tien_con_phai_thanh_toan <= 0) => Bỏ qua không tạo dự thu
      if (tienConLai <= 0) {
        skippedPaidCount++;
        // Kiểm tra nếu trước đó từng có phiếu EXPECTED auto thì cancel
        const existingAuto = await client.query(
          `SELECT id, voucher_code, payment_status FROM kgara_cashflow_vouchers
           WHERE case_id = $1 AND voucher_type = 'RECEIPT' AND is_auto_expected = true`,
          [caseId],
        );
        if (existingAuto.rows.length > 0) {
          const ex = existingAuto.rows[0];
          if (ex.payment_status === 'EXPECTED') {
            if (!isDryRun) {
              await client.query(
                `UPDATE kgara_cashflow_vouchers
                 SET payment_status = 'CANCELLED', amount = 0, updated_at = now()
                 WHERE id = $1`,
                [ex.id],
              );
            }
            console.log(
              `  ⚪ [CANCELLED_PAID] Case ${soChungTu} (${bienSoXe}) đã thu đủ -> Hủy phiếu dự thu cũ ${ex.voucher_code}.`,
            );
          }
        }
        continue;
      }

      // Phiếu còn nợ (> 0) => Cần có phiếu dự thu
      totalExpectedAmount += tienConLai;

      // Tìm phiếu auto hiện có
      const existingRes = await client.query(
        `SELECT id, voucher_code, payment_status, amount, trans_date
         FROM kgara_cashflow_vouchers
         WHERE case_id = $1 AND voucher_type = 'RECEIPT' AND is_auto_expected = true`,
        [caseId],
      );

      if (existingRes.rows.length > 0) {
        const existing = existingRes.rows[0];
        // Bảo vệ nếu đã PAID hoặc APPROVED
        if (
          existing.payment_status === 'PAID' ||
          existing.payment_status === 'APPROVED'
        ) {
          protectedCount++;
          console.log(
            `  🔒 [PROTECTED] Case ${soChungTu} (${bienSoXe}) đã có phiếu ${existing.voucher_code} [${existing.payment_status}]. Bỏ qua.`,
          );
          continue;
        }

        // Cập nhật lại số tiền còn nợ & transDate
        if (!isDryRun) {
          await client.query(
            `UPDATE kgara_cashflow_vouchers
             SET amount = $1, trans_date = $2, payment_status = 'EXPECTED',
                 partner_name = $3, license_plate = $4, updated_at = now()
             WHERE id = $5`,
            [tienConLai, transDate, khachHang, bienSoXe, existing.id],
          );
        }
        updatedCount++;
        console.log(
          `  🔄 [UPDATED] Case ${soChungTu} (${bienSoXe}): Cập nhật dự thu ${existing.voucher_code} -> ${tienConLai.toLocaleString('vi-VN')} đ (Hạn thu: ${transDate}).`,
        );
      } else {
        // Tạo mới phiếu dự thu
        const voucherCode = generateVoucherCode(c.ngay_hoan_thanh_cong_viec);
        if (!isDryRun) {
          await client.query(
            `INSERT INTO kgara_cashflow_vouchers (
              voucher_code, voucher_type, payment_status, is_auto_expected,
              amount, trans_date, case_id, license_plate, partner_name,
              payment_content, note, created_by, created_at, updated_at
            ) VALUES (
              $1, 'RECEIPT', 'EXPECTED', true,
              $2, $3, $4, $5, $6,
              'Dự thu hoàn tất phiếu dịch vụ', $7, 'Hệ thống (Auto Forecast)', now(), now()
            )`,
            [
              voucherCode,
              tienConLai,
              transDate,
              caseId,
              bienSoXe,
              khachHang,
              `Tự động sinh từ phiếu ${soChungTu}`,
            ],
          );
        }
        createdCount++;
        console.log(
          `  ✨ [CREATED] Case ${soChungTu} (${bienSoXe}): Tạo dự thu ${voucherCode} -> ${tienConLai.toLocaleString('vi-VN')} đ (Hạn thu: ${transDate}).`,
        );
      }
    }

    console.log(`\n================================================================`);
    console.log(`🏁 KẾT QUẢ BACKFILL DỰ THU GARAGE HUB`);
    console.log(`----------------------------------------------------------------`);
    console.log(`Tổng số phiếu dịch vụ kết thúc:      ${cases.length}`);
    console.log(`Phiếu đã thu đủ (BỎ QUA KHÔNG TẠO):   ${skippedPaidCount}`);
    console.log(`Phiếu dự thu TẠO MỚI (DT-GARA):       ${createdCount}`);
    console.log(`Phiếu dự thu CẬP NHẬT:                ${updatedCount}`);
    console.log(`Phiếu đã thanh toán được BẢO VỆ:      ${protectedCount}`);
    console.log(
      `Tổng số tiền dự thu ghi nhận:        ${totalExpectedAmount.toLocaleString('vi-VN')} đ`,
    );
    console.log(
      `Trạng thái:                           ${isDryRun ? 'DRY-RUN XONG (Chưa ghi DB)' : 'THỰC THI THÀNH CÔNG (Đã ghi DB)'}`,
    );
    console.log(`================================================================\n`);
  } catch (error: any) {
    console.error('❌ Lỗi backfill dự thu:', error.message, error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
