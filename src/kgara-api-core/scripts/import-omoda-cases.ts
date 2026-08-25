import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

const envFile = process.argv[2] || '.env.greenway-production';
const envPath = path.resolve(process.cwd(), envFile);
if (fs.existsSync(envPath)) {
  const result = dotenv.config({ path: envPath, override: true });
  console.log(`Loaded environment from: ${envFile} (override=true)`);
} else {
  dotenv.config({ override: true });
  console.log(`Loaded default .env`);
}

interface OmodaItem {
  STT: number;
  bienSoXe: string;
  'TÊN KHÁCH HÀNG': string;
  'SỐ KHUNG': string;
  'NGÀY VÀO': string;
  doanhThu: number;
  ODO: number;
  'GHI CHÚ': string;
}

const DEFAULT_BRANCH_ID = '0b4d6d3a-55df-492b-abaf-377d84b61d05'; // GREENWAY AUTO

async function importOmodaCases() {
  console.log('🚀 Starting import of OMODA maintenance cases...');

  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await ds.initialize();
  console.log('✅ Database connected');

  try {
    const jsonPath = path.resolve(
      __dirname,
      '../../../../data/gw/bao_cao_doanh_thu_bd_omoda.json',
    );
    console.log(`Reading JSON from: ${jsonPath}`);
    const rawData = fs.readFileSync(jsonPath, 'utf-8');
    const items: OmodaItem[] = JSON.parse(rawData);

    console.log(`Found ${items.length} items to import.`);

    let juneCount = 0;
    let julyCount = 0;

    for (const item of items) {
      const entryDateStr = item['NGÀY VÀO'];
      const entryDate = new Date(`${entryDateStr}T08:00:00.000Z`);
      const isJune = entryDateStr.startsWith('2026-06');

      let endDate: Date;
      let soChungTu: string;

      if (isJune) {
        juneCount++;
        endDate = new Date('2026-07-01T17:00:00.000Z');
        soChungTu = `OJ-BD2606-${String(juneCount).padStart(4, '0')}`;
      } else {
        julyCount++;
        // Add 5 days
        const d = new Date(`${entryDateStr}T17:00:00.000Z`);
        d.setUTCDate(d.getUTCDate() + 5);
        endDate = d;
        soChungTu = `OJ-BD2607-${String(julyCount).padStart(4, '0')}`;
      }

      const hdPhieuDichVuId = `OJ-OMODA-2026-STT-${String(item.STT).padStart(2, '0')}`;
      const cleanPlate = item.bienSoXe.trim().replace(/\s+/g, '');
      const customerName = item['TÊN KHÁCH HÀNG'].trim();
      const customerCode = `KH-OJ-${String(item.STT).padStart(2, '0')}`;
      const revenue = Number(item.doanhThu) || 0;
      const note = `Bảo dưỡng OMODA ghi nhận ngoài (ODO: ${item.ODO} km)`;

      // 1. Upsert into kgara_cases
      await ds.query(
        `
        INSERT INTO kgara_cases (
          hd_phieu_dich_vu_id,
          so_chung_tu,
          bien_so_xe,
          khach_hang_code,
          khach_hang_name,
          tinh_trang_dich_vu,
          ten_tinh_trang_dich_vu,
          tien_co_thue,
          tien_da_thanh_toan,
          tien_con_phai_thanh_toan,
          doanh_thu,
          chi_phi,
          loi_nhuan,
          ngay_phat_sinh,
          ngay_tiep_nhan,
          ngay_hoan_thanh_cong_viec,
          ngay_giao_xe_full,
          so_khung,
          branch_external_id,
          classification,
          erp_notes,
          kgara_delete_count,
          kgara_deleted_at,
          raw_data,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, NOW(), NOW()
        )
        ON CONFLICT (hd_phieu_dich_vu_id) DO UPDATE SET
          so_chung_tu = EXCLUDED.so_chung_tu,
          bien_so_xe = EXCLUDED.bien_so_xe,
          khach_hang_code = EXCLUDED.khach_hang_code,
          khach_hang_name = EXCLUDED.khach_hang_name,
          tinh_trang_dich_vu = EXCLUDED.tinh_trang_dich_vu,
          ten_tinh_trang_dich_vu = EXCLUDED.ten_tinh_trang_dich_vu,
          tien_co_thue = EXCLUDED.tien_co_thue,
          tien_con_phai_thanh_toan = EXCLUDED.tien_con_phai_thanh_toan,
          doanh_thu = EXCLUDED.doanh_thu,
          chi_phi = EXCLUDED.chi_phi,
          loi_nhuan = EXCLUDED.loi_nhuan,
          ngay_phat_sinh = EXCLUDED.ngay_phat_sinh,
          ngay_tiep_nhan = EXCLUDED.ngay_tiep_nhan,
          ngay_hoan_thanh_cong_viec = EXCLUDED.ngay_hoan_thanh_cong_viec,
          ngay_giao_xe_full = EXCLUDED.ngay_giao_xe_full,
          so_khung = EXCLUDED.so_khung,
          branch_external_id = EXCLUDED.branch_external_id,
          classification = EXCLUDED.classification,
          erp_notes = EXCLUDED.erp_notes,
          kgara_delete_count = 0,
          kgara_deleted_at = NULL,
          raw_data = EXCLUDED.raw_data,
          updated_at = NOW()
      `,
        [
          hdPhieuDichVuId,
          soChungTu,
          cleanPlate,
          customerCode,
          customerName,
          3, // Completed
          'Kết thúc',
          revenue,
          0,
          revenue,
          revenue,
          0,
          revenue,
          entryDate,
          entryDate,
          endDate,
          endDate,
          item['SỐ KHUNG'] || null,
          DEFAULT_BRANCH_ID,
          'OJ_NGOAI',
          note,
          0,
          null,
          JSON.stringify(item),
        ],
      );

      // 2. Upsert into kgara_gross_profit for report compatibility
      await ds.query(
        `
        INSERT INTO kgara_gross_profit (
          hd_phieu_dich_vu_id,
          branch_external_id,
          vu_viec_code,
          vu_viec_name,
          ten_khach_hang,
          doanh_thu,
          chi_phi,
          loi_nhuan,
          report_from,
          report_to,
          raw_data,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
        )
        ON CONFLICT (hd_phieu_dich_vu_id) DO UPDATE SET
          branch_external_id = EXCLUDED.branch_external_id,
          vu_viec_code = EXCLUDED.vu_viec_code,
          vu_viec_name = EXCLUDED.vu_viec_name,
          ten_khach_hang = EXCLUDED.ten_khach_hang,
          doanh_thu = EXCLUDED.doanh_thu,
          chi_phi = EXCLUDED.chi_phi,
          loi_nhuan = EXCLUDED.loi_nhuan,
          report_from = EXCLUDED.report_from,
          report_to = EXCLUDED.report_to,
          raw_data = EXCLUDED.raw_data,
          updated_at = NOW()
      `,
        [
          hdPhieuDichVuId,
          DEFAULT_BRANCH_ID,
          soChungTu,
          `Bảo dưỡng OMODA ${cleanPlate}`,
          customerName,
          revenue,
          0,
          revenue,
          '2026-07-01',
          '2026-07-31',
          JSON.stringify(item),
        ],
      );

      console.log(
        `  ✓ STT ${item.STT}: ${soChungTu} | Xe: ${cleanPlate} | Vào: ${entryDateStr} -> Xong: ${endDate.toISOString().split('T')[0]} | DT: ${revenue.toLocaleString()} đ`,
      );
    }

    console.log('🎉 Successfully imported all 12 OMODA cases.');
  } finally {
    await ds.destroy();
  }
}

importOmodaCases().catch((err) => {
  console.error('❌ Error importing Omoda cases:', err);
  process.exit(1);
});
