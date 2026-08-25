import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// ── Environment resolution ──────────────────────────────────────────────────
const args = process.argv.slice(2);
let envFile = '.env.greenway-production';
const isDryRun =
  args.includes('--dry-run') ||
  (!args.includes('--apply') && !args.includes('-a'));
const isApply = args.includes('--apply') || args.includes('-a');

for (const arg of args) {
  if (
    !arg.startsWith('--') &&
    !arg.startsWith('-') &&
    fs.existsSync(path.resolve(process.cwd(), arg))
  ) {
    envFile = arg;
  }
}

const envPath = path.resolve(process.cwd(), envFile);
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: true });
  console.log(`[Config] Loaded environment from: ${envFile}`);
} else {
  dotenv.config({ override: true });
  console.log(`[Config] Loaded default .env`);
}

interface MonthlyOpexEntry {
  periodYear: number;
  periodMonth: number;
  categoryKey: string;
  categoryName: string;
  amount: number;
  ojAmount?: number;
  note?: string;
}

// ── Master data extracted from Greenway Garage P&L report sheet ──────────────
const OPEX_DATA: MonthlyOpexEntry[] = [
  // ── 01/2026 (Total: 112,000,000 đ) ─────────────────────────────────────────
  {
    periodYear: 2026,
    periodMonth: 1,
    categoryKey: 'NHAN_SU',
    categoryName: 'Nhân sự',
    amount: 51_000_000,
  },
  {
    periodYear: 2026,
    periodMonth: 1,
    categoryKey: 'THUE_MAT_BANG',
    categoryName: 'Thuê mặt bằng & điện nước',
    amount: 30_000_000,
  },
  {
    periodYear: 2026,
    periodMonth: 1,
    categoryKey: 'VAT_TU_TIEU_HAO',
    categoryName: 'Vật tư tiêu hao',
    amount: 15_000_000,
  },
  {
    periodYear: 2026,
    periodMonth: 1,
    categoryKey: 'BAO_TRI',
    categoryName: 'Bảo trì',
    amount: 10_000_000,
  },
  {
    periodYear: 2026,
    periodMonth: 1,
    categoryKey: 'KHAU_HAO',
    categoryName: 'Khấu hao máy móc & thiết bị',
    amount: 6_000_000,
  },

  // ── 02/2026 (Total: 106,000,000 đ) ─────────────────────────────────────────
  {
    periodYear: 2026,
    periodMonth: 2,
    categoryKey: 'NHAN_SU',
    categoryName: 'Nhân sự',
    amount: 51_000_000,
  },
  {
    periodYear: 2026,
    periodMonth: 2,
    categoryKey: 'THUE_MAT_BANG',
    categoryName: 'Thuê mặt bằng & điện nước',
    amount: 30_000_000,
  },
  {
    periodYear: 2026,
    periodMonth: 2,
    categoryKey: 'VAT_TU_TIEU_HAO',
    categoryName: 'Vật tư tiêu hao',
    amount: 15_000_000,
  },
  {
    periodYear: 2026,
    periodMonth: 2,
    categoryKey: 'BAO_TRI',
    categoryName: 'Bảo trì',
    amount: 10_000_000,
  },

  // ── 03/2026 (Total: 106,000,000 đ) ─────────────────────────────────────────
  {
    periodYear: 2026,
    periodMonth: 3,
    categoryKey: 'NHAN_SU',
    categoryName: 'Nhân sự',
    amount: 45_000_000,
  },
  {
    periodYear: 2026,
    periodMonth: 3,
    categoryKey: 'THUE_MAT_BANG',
    categoryName: 'Thuê mặt bằng & điện nước',
    amount: 30_000_000,
  },
  {
    periodYear: 2026,
    periodMonth: 3,
    categoryKey: 'VAT_TU_TIEU_HAO',
    categoryName: 'Vật tư tiêu hao',
    amount: 15_000_000,
  },
  {
    periodYear: 2026,
    periodMonth: 3,
    categoryKey: 'BAO_TRI',
    categoryName: 'Bảo trì',
    amount: 10_000_000,
  },
  {
    periodYear: 2026,
    periodMonth: 3,
    categoryKey: 'KHAU_HAO',
    categoryName: 'Khấu hao máy móc & thiết bị',
    amount: 6_000_000,
  },

  // ── 04/2026 (Total: 125,500,000 đ) ─────────────────────────────────────────
  {
    periodYear: 2026,
    periodMonth: 4,
    categoryKey: 'NHAN_SU',
    categoryName: 'Nhân sự',
    amount: 64_500_000,
  },
  {
    periodYear: 2026,
    periodMonth: 4,
    categoryKey: 'THUE_MAT_BANG',
    categoryName: 'Thuê mặt bằng & điện nước',
    amount: 30_000_000,
  },
  {
    periodYear: 2026,
    periodMonth: 4,
    categoryKey: 'VAT_TU_TIEU_HAO',
    categoryName: 'Vật tư tiêu hao',
    amount: 15_000_000,
  },
  {
    periodYear: 2026,
    periodMonth: 4,
    categoryKey: 'BAO_TRI',
    categoryName: 'Bảo trì',
    amount: 10_000_000,
  },
  {
    periodYear: 2026,
    periodMonth: 4,
    categoryKey: 'KHAU_HAO',
    categoryName: 'Khấu hao máy móc & thiết bị',
    amount: 6_000_000,
  },

  // ── 05/2026 (Total: 125,500,000 đ) ─────────────────────────────────────────
  {
    periodYear: 2026,
    periodMonth: 5,
    categoryKey: 'NHAN_SU',
    categoryName: 'Nhân sự',
    amount: 64_500_000,
  },
  {
    periodYear: 2026,
    periodMonth: 5,
    categoryKey: 'THUE_MAT_BANG',
    categoryName: 'Thuê mặt bằng & điện nước',
    amount: 30_000_000,
  },
  {
    periodYear: 2026,
    periodMonth: 5,
    categoryKey: 'VAT_TU_TIEU_HAO',
    categoryName: 'Vật tư tiêu hao',
    amount: 15_000_000,
  },
  {
    periodYear: 2026,
    periodMonth: 5,
    categoryKey: 'BAO_TRI',
    categoryName: 'Bảo trì',
    amount: 10_000_000,
  },
  {
    periodYear: 2026,
    periodMonth: 5,
    categoryKey: 'KHAU_HAO',
    categoryName: 'Khấu hao máy móc & thiết bị',
    amount: 6_000_000,
  },

  // ── 06/2026 (Total: 125,500,000 đ) ─────────────────────────────────────────
  {
    periodYear: 2026,
    periodMonth: 6,
    categoryKey: 'NHAN_SU',
    categoryName: 'Nhân sự',
    amount: 64_500_000,
  },
  {
    periodYear: 2026,
    periodMonth: 6,
    categoryKey: 'THUE_MAT_BANG',
    categoryName: 'Thuê mặt bằng & điện nước',
    amount: 30_000_000,
  },
  {
    periodYear: 2026,
    periodMonth: 6,
    categoryKey: 'VAT_TU_TIEU_HAO',
    categoryName: 'Vật tư tiêu hao',
    amount: 15_000_000,
  },
  {
    periodYear: 2026,
    periodMonth: 6,
    categoryKey: 'BAO_TRI',
    categoryName: 'Bảo trì',
    amount: 10_000_000,
  },
  {
    periodYear: 2026,
    periodMonth: 6,
    categoryKey: 'KHAU_HAO',
    categoryName: 'Khấu hao máy móc & thiết bị',
    amount: 6_000_000,
  },

  // ── 07/2026 (Total: 137,500,000 đ) ─────────────────────────────────────────
  {
    periodYear: 2026,
    periodMonth: 7,
    categoryKey: 'NHAN_SU',
    categoryName: 'Nhân sự',
    amount: 76_500_000,
  },
  {
    periodYear: 2026,
    periodMonth: 7,
    categoryKey: 'THUE_MAT_BANG',
    categoryName: 'Thuê mặt bằng & điện nước',
    amount: 30_000_000,
  },
  {
    periodYear: 2026,
    periodMonth: 7,
    categoryKey: 'VAT_TU_TIEU_HAO',
    categoryName: 'Vật tư tiêu hao',
    amount: 15_000_000,
  },
  {
    periodYear: 2026,
    periodMonth: 7,
    categoryKey: 'BAO_TRI',
    categoryName: 'Bảo trì',
    amount: 10_000_000,
  },
  {
    periodYear: 2026,
    periodMonth: 7,
    categoryKey: 'KHAU_HAO',
    categoryName: 'Khấu hao máy móc & thiết bị',
    amount: 6_000_000,
  },

  // ── 08/2026 (Replicated from 07/2026 - Total: 137,500,000 đ) ────────────────
  {
    periodYear: 2026,
    periodMonth: 8,
    categoryKey: 'NHAN_SU',
    categoryName: 'Nhân sự',
    amount: 76_500_000,
  },
  {
    periodYear: 2026,
    periodMonth: 8,
    categoryKey: 'THUE_MAT_BANG',
    categoryName: 'Thuê mặt bằng & điện nước',
    amount: 30_000_000,
  },
  {
    periodYear: 2026,
    periodMonth: 8,
    categoryKey: 'VAT_TU_TIEU_HAO',
    categoryName: 'Vật tư tiêu hao',
    amount: 15_000_000,
  },
  {
    periodYear: 2026,
    periodMonth: 8,
    categoryKey: 'BAO_TRI',
    categoryName: 'Bảo trì',
    amount: 10_000_000,
  },
  {
    periodYear: 2026,
    periodMonth: 8,
    categoryKey: 'KHAU_HAO',
    categoryName: 'Khấu hao máy móc & thiết bị',
    amount: 6_000_000,
  },

  // ── 09/2026 (Replicated from 07/2026 - Total: 137,500,000 đ) ────────────────
  {
    periodYear: 2026,
    periodMonth: 9,
    categoryKey: 'NHAN_SU',
    categoryName: 'Nhân sự',
    amount: 76_500_000,
  },
  {
    periodYear: 2026,
    periodMonth: 9,
    categoryKey: 'THUE_MAT_BANG',
    categoryName: 'Thuê mặt bằng & điện nước',
    amount: 30_000_000,
  },
  {
    periodYear: 2026,
    periodMonth: 9,
    categoryKey: 'VAT_TU_TIEU_HAO',
    categoryName: 'Vật tư tiêu hao',
    amount: 15_000_000,
  },
  {
    periodYear: 2026,
    periodMonth: 9,
    categoryKey: 'BAO_TRI',
    categoryName: 'Bảo trì',
    amount: 10_000_000,
  },
  {
    periodYear: 2026,
    periodMonth: 9,
    categoryKey: 'KHAU_HAO',
    categoryName: 'Khấu hao máy móc & thiết bị',
    amount: 6_000_000,
  },

  // ── 10/2026 (Replicated from 07/2026 - Total: 137,500,000 đ) ────────────────
  {
    periodYear: 2026,
    periodMonth: 10,
    categoryKey: 'NHAN_SU',
    categoryName: 'Nhân sự',
    amount: 76_500_000,
  },
  {
    periodYear: 2026,
    periodMonth: 10,
    categoryKey: 'THUE_MAT_BANG',
    categoryName: 'Thuê mặt bằng & điện nước',
    amount: 30_000_000,
  },
  {
    periodYear: 2026,
    periodMonth: 10,
    categoryKey: 'VAT_TU_TIEU_HAO',
    categoryName: 'Vật tư tiêu hao',
    amount: 15_000_000,
  },
  {
    periodYear: 2026,
    periodMonth: 10,
    categoryKey: 'BAO_TRI',
    categoryName: 'Bảo trì',
    amount: 10_000_000,
  },
  {
    periodYear: 2026,
    periodMonth: 10,
    categoryKey: 'KHAU_HAO',
    categoryName: 'Khấu hao máy móc & thiết bị',
    amount: 6_000_000,
  },

  // ── 11/2026 (Replicated from 07/2026 - Total: 137,500,000 đ) ────────────────
  {
    periodYear: 2026,
    periodMonth: 11,
    categoryKey: 'NHAN_SU',
    categoryName: 'Nhân sự',
    amount: 76_500_000,
  },
  {
    periodYear: 2026,
    periodMonth: 11,
    categoryKey: 'THUE_MAT_BANG',
    categoryName: 'Thuê mặt bằng & điện nước',
    amount: 30_000_000,
  },
  {
    periodYear: 2026,
    periodMonth: 11,
    categoryKey: 'VAT_TU_TIEU_HAO',
    categoryName: 'Vật tư tiêu hao',
    amount: 15_000_000,
  },
  {
    periodYear: 2026,
    periodMonth: 11,
    categoryKey: 'BAO_TRI',
    categoryName: 'Bảo trì',
    amount: 10_000_000,
  },
  {
    periodYear: 2026,
    periodMonth: 11,
    categoryKey: 'KHAU_HAO',
    categoryName: 'Khấu hao máy móc & thiết bị',
    amount: 6_000_000,
  },

  // ── 12/2026 (Replicated from 07/2026 - Total: 137,500,000 đ) ────────────────
  {
    periodYear: 2026,
    periodMonth: 12,
    categoryKey: 'NHAN_SU',
    categoryName: 'Nhân sự',
    amount: 76_500_000,
  },
  {
    periodYear: 2026,
    periodMonth: 12,
    categoryKey: 'THUE_MAT_BANG',
    categoryName: 'Thuê mặt bằng & điện nước',
    amount: 30_000_000,
  },
  {
    periodYear: 2026,
    periodMonth: 12,
    categoryKey: 'VAT_TU_TIEU_HAO',
    categoryName: 'Vật tư tiêu hao',
    amount: 15_000_000,
  },
  {
    periodYear: 2026,
    periodMonth: 12,
    categoryKey: 'BAO_TRI',
    categoryName: 'Bảo trì',
    amount: 10_000_000,
  },
  {
    periodYear: 2026,
    periodMonth: 12,
    categoryKey: 'KHAU_HAO',
    categoryName: 'Khấu hao máy móc & thiết bị',
    amount: 6_000_000,
  },
];

async function run() {
  console.log(
    '===============================================================',
  );
  console.log('💰 SEED GARAGE OPERATING EXPENSES (OPEX) SCRIPT');
  console.log(
    `Mode: ${isApply ? '🚀 APPLY (Writing to DB)' : '🔍 DRY-RUN (Preview only)'}`,
  );
  console.log(
    '===============================================================',
  );

  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await ds.initialize();
  console.log('✅ Connected to PostgreSQL database.');

  try {
    // 1. Group items by period for display
    const byPeriod: Record<
      string,
      { items: MonthlyOpexEntry[]; total: number }
    > = {};
    OPEX_DATA.forEach((entry) => {
      const p = `${String(entry.periodMonth).padStart(2, '0')}/${entry.periodYear}`;
      if (!byPeriod[p]) byPeriod[p] = { items: [], total: 0 };
      byPeriod[p].items.push(entry);
      byPeriod[p].total += entry.amount;
    });

    console.log('\n📅 OPEX DATA SUMMARY BY MONTH:');
    Object.entries(byPeriod).forEach(([p, { items, total }]) => {
      console.log(
        `  • Tháng ${p}: ${items.length} khoản chi | Tổng: ${total.toLocaleString('vi-VN')} đ`,
      );
      items.forEach((it) => {
        console.log(
          `      - [${it.categoryKey}] ${it.categoryName}: ${it.amount.toLocaleString('vi-VN')} đ`,
        );
      });
    });

    console.log(`\nTotal entries to insert/upsert: ${OPEX_DATA.length}`);

    if (isApply) {
      console.log('\n🚀 Executing upsert into kgara_operating_expenses...');
      const queryRunner = ds.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        let insertedCount = 0;
        let updatedCount = 0;

        for (const entry of OPEX_DATA) {
          const existing = await queryRunner.query(
            `SELECT id FROM kgara_operating_expenses 
             WHERE period_year = $1 AND period_month = $2 AND category_key = $3`,
            [entry.periodYear, entry.periodMonth, entry.categoryKey],
          );

          if (existing.length > 0) {
            await queryRunner.query(
              `UPDATE kgara_operating_expenses 
               SET category_name = $1, 
                   amount = $2, 
                   oj_amount = $3, 
                   note = $4, 
                   updated_at = NOW() 
               WHERE id = $5`,
              [
                entry.categoryName,
                entry.amount,
                entry.ojAmount || 0,
                entry.note || null,
                existing[0].id,
              ],
            );
            updatedCount++;
          } else {
            await queryRunner.query(
              `INSERT INTO kgara_operating_expenses (
                period_year, period_month, category_key, category_name, 
                amount, oj_amount, note, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
              [
                entry.periodYear,
                entry.periodMonth,
                entry.categoryKey,
                entry.categoryName,
                entry.amount,
                entry.ojAmount || 0,
                entry.note || null,
              ],
            );
            insertedCount++;
          }
        }

        await queryRunner.commitTransaction();
        console.log(
          `✅ SUCCESS: Upserted OPEX records (Inserted: ${insertedCount}, Updated: ${updatedCount})`,
        );
      } catch (err) {
        await queryRunner.rollbackTransaction();
        console.error('❌ Transaction rolled back due to error:', err);
        throw err;
      } finally {
        await queryRunner.release();
      }
    } else {
      console.log(
        '\n💡 DRY-RUN complete. To apply changes to DB, run with --apply',
      );
    }
  } finally {
    await ds.destroy();
  }
}

run().catch((err) => {
  console.error('❌ Script execution error:', err);
  process.exit(1);
});
