import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

// Parse .env.greenway-production manually
const envPath = path.resolve(__dirname, '../../../.env.greenway-production');
const envContent = fs.readFileSync(envPath, 'utf8');
let dbUrl = '';
for (const line of envContent.split('\n')) {
  if (line.startsWith('DATABASE_URL=')) {
    dbUrl = line.replace('DATABASE_URL=', '').trim();
    break;
  }
}

if (!dbUrl) {
  console.error('❌ Could not find DATABASE_URL in .env.greenway-production');
  process.exit(1);
}

interface OpexItem {
  categoryKey: string;
  categoryName: string;
  amount: number;
}

// 5 categories from month 7 (July 2026)
const JULY_OPEX_ITEMS: OpexItem[] = [
  { categoryKey: 'NHAN_SU', categoryName: 'Nhân sự', amount: 76_500_000 },
  {
    categoryKey: 'THUE_MAT_BANG',
    categoryName: 'Thuê mặt bằng & điện nước',
    amount: 30_000_000,
  },
  {
    categoryKey: 'VAT_TU_TIEU_HAO',
    categoryName: 'Vật tư tiêu hao',
    amount: 15_000_000,
  },
  { categoryKey: 'BAO_TRI', categoryName: 'Bảo trì', amount: 10_000_000 },
  {
    categoryKey: 'KHAU_HAO',
    categoryName: 'Khấu hao máy móc & thiết bị',
    amount: 6_000_000,
  },
];

async function main() {
  console.log('Connecting to Greenway DB:', dbUrl.replace(/:[^:@]+@/, ':***@'));
  const ds = new DataSource({
    type: 'postgres',
    url: dbUrl,
    ssl: { rejectUnauthorized: false },
  });
  await ds.initialize();
  console.log('✅ Connected.');

  const months = [8, 9, 10, 11, 12];
  const year = 2026;

  for (const m of months) {
    console.log(`\nProcessing Month ${m}/${year}...`);
    for (const item of JULY_OPEX_ITEMS) {
      const existing = await ds.query(
        `SELECT id, amount FROM kgara_operating_expenses 
         WHERE period_year = $1 AND period_month = $2 AND category_key = $3`,
        [year, m, item.categoryKey],
      );

      if (existing.length > 0) {
        await ds.query(
          `UPDATE kgara_operating_expenses 
           SET category_name = $1, 
               amount = $2, 
               updated_at = NOW() 
           WHERE id = $3`,
          [item.categoryName, item.amount, existing[0].id],
        );
        console.log(
          `  ✓ Updated ${item.categoryKey}: ${item.amount.toLocaleString('vi-VN')} đ (was ${existing[0].amount})`,
        );
      } else {
        await ds.query(
          `INSERT INTO kgara_operating_expenses (
             period_year, period_month, category_key, category_name, 
             amount, oj_amount, created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5, 0, NOW(), NOW())`,
          [year, m, item.categoryKey, item.categoryName, item.amount],
        );
        console.log(
          `  + Inserted ${item.categoryKey}: ${item.amount.toLocaleString('vi-VN')} đ`,
        );
      }
    }
  }

  // Also make sure Month 7 has all 5 records
  console.log(`\nVerifying Month 7/${year}...`);
  for (const item of JULY_OPEX_ITEMS) {
    const existing = await ds.query(
      `SELECT id FROM kgara_operating_expenses 
       WHERE period_year = $1 AND period_month = $2 AND category_key = $3`,
      [year, 7, item.categoryKey],
    );

    if (existing.length > 0) {
      await ds.query(
        `UPDATE kgara_operating_expenses 
         SET category_name = $1, 
             amount = $2, 
             updated_at = NOW() 
         WHERE id = $3`,
        [item.categoryName, item.amount, existing[0].id],
      );
    } else {
      await ds.query(
        `INSERT INTO kgara_operating_expenses (
           period_year, period_month, category_key, category_name, 
           amount, oj_amount, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, 0, NOW(), NOW())`,
        [year, 7, item.categoryKey, item.categoryName, item.amount],
      );
    }
  }

  console.log('\n📊 Summary of 2026 OPEX in DB:');
  const summary = await ds.query(
    `SELECT period_year, period_month, count(*) as cnt, sum(amount) as total 
     FROM kgara_operating_expenses 
     WHERE period_year = 2026 
     GROUP BY period_year, period_month 
     ORDER BY period_month`,
  );
  console.table(summary);

  await ds.destroy();
}

main().catch(console.error);
