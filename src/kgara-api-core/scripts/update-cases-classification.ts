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

interface BangKeItem {
  soChungTu?: string | null;
  bienSoXe?: string | null;
  SĐT?: string | null;
  'SỐ KHUNG XE'?: string | null;
  doanhThu?: number | null;
  classification?: string | null;
  Detail?: string | null;
}

const CLASSIFICATION_MAP: Record<string, string> = {
  'Ký gửi/ Nội bộ': 'KY_GUI_NOI_BO',
  'Ký gửi / Nội bộ': 'KY_GUI_NOI_BO',
  KY_GUI_NOI_BO: 'KY_GUI_NOI_BO',
  'Sửa chữa chung': 'SUA_CHUA_CHUNG',
  SUA_CHUA_CHUNG: 'SUA_CHUA_CHUNG',
  OJ: 'OJ',
  OJ_NGOAI: 'OJ_NGOAI',
  Khác: 'KHAC',
  KHAC: 'KHAC',
};

async function run() {
  console.log(
    '===============================================================',
  );
  console.log('🚗 UPDATE GARAGE CASES CLASSIFICATION SCRIPT');
  console.log(
    `Mode: ${isApply ? '🚀 APPLY (Writing to DB)' : '🔍 DRY-RUN (Preview only)'}`,
  );
  console.log(
    '===============================================================',
  );

  // 1. Read JSON file
  const jsonPath = path.resolve(
    __dirname,
    '../../../../data/gw/bang_ke_tong_hop.json',
  );
  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ Source JSON file not found at: ${jsonPath}`);
    process.exit(1);
  }

  const rawJson = fs.readFileSync(jsonPath, 'utf8');
  const items: BangKeItem[] = JSON.parse(rawJson);
  console.log(
    `[Source] Loaded ${items.length} items from bang_ke_tong_hop.json`,
  );

  // 2. Connect DB
  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await ds.initialize();
  console.log('✅ Connected to PostgreSQL database.');

  try {
    // 3. Query existing cases in DB
    const existingCases = await ds.query(
      `SELECT id, so_chung_tu, bien_so_xe, classification, erp_notes FROM kgara_cases WHERE so_chung_tu IS NOT NULL`,
    );
    console.log(
      `[DB] Found ${existingCases.length} existing cases with so_chung_tu in kgara_cases`,
    );

    const dbCaseMap = new Map<string, any>();
    existingCases.forEach((c: any) => {
      const normalized = (c.so_chung_tu || '').trim().toUpperCase();
      if (normalized) {
        dbCaseMap.set(normalized, c);
      }
    });

    let matchedCount = 0;
    let skippedNotFoundCount = 0;
    let skippedInvalidCount = 0;
    let unchangedCount = 0;
    const updates: Array<{
      id: string;
      soChungTu: string;
      plate: string;
      oldClass: string | null;
      newClass: string;
      oldNotes: string | null;
      newNotes: string | null;
    }> = [];

    const notFoundItems: BangKeItem[] = [];

    for (const item of items) {
      const rawSoChungTu = (item.soChungTu || '').trim();
      if (
        !rawSoChungTu ||
        rawSoChungTu === '#N/A' ||
        rawSoChungTu.includes('#N/A')
      ) {
        skippedInvalidCount++;
        continue;
      }

      const normalizedCode = rawSoChungTu.toUpperCase();
      const dbCase = dbCaseMap.get(normalizedCode);

      if (!dbCase) {
        skippedNotFoundCount++;
        notFoundItems.push(item);
        continue;
      }

      const rawClass = (item.classification || '').trim();
      const targetClass = CLASSIFICATION_MAP[rawClass] || null;

      if (!targetClass) {
        console.warn(
          `⚠️ Unknown classification "${rawClass}" for case ${rawSoChungTu}`,
        );
        continue;
      }

      const rawDetail = (item.Detail || '').trim();
      let targetNotes = dbCase.erp_notes;
      if (!targetNotes && rawDetail) {
        targetNotes = rawDetail;
      }

      const classChanged = dbCase.classification !== targetClass;
      const notesChanged = dbCase.erp_notes !== targetNotes && targetNotes;

      if (classChanged || notesChanged) {
        matchedCount++;
        updates.push({
          id: dbCase.id,
          soChungTu: dbCase.so_chung_tu,
          plate: dbCase.bien_so_xe || item.bienSoXe || '',
          oldClass: dbCase.classification,
          newClass: targetClass,
          oldNotes: dbCase.erp_notes,
          newNotes: targetNotes,
        });
      } else {
        unchangedCount++;
      }
    }

    console.log(
      '\n───────────────── MATCHING & AUDIT SUMMARY ─────────────────',
    );
    console.log(`Total JSON records:            ${items.length}`);
    console.log(`Invalid / #N/A records:        ${skippedInvalidCount}`);
    console.log(`Not in DB (Safely Skipped):    ${skippedNotFoundCount}`);
    console.log(`Already up-to-date in DB:      ${unchangedCount}`);
    console.log(`Cases ready to update:         ${updates.length}`);
    console.log(
      '────────────────────────────────────────────────────────────\n',
    );

    // Show breakdown of updates
    const classBreakdown: Record<string, number> = {};
    updates.forEach((u) => {
      classBreakdown[u.newClass] = (classBreakdown[u.newClass] || 0) + 1;
    });
    console.log('📊 Update Distribution:');
    Object.entries(classBreakdown).forEach(([k, v]) => {
      console.log(`  - ${k}: ${v} cases`);
    });

    if (updates.length > 0) {
      console.log('\n🔍 Sample updates (first 5):');
      updates.slice(0, 5).forEach((u, i) => {
        console.log(
          `  ${i + 1}. [${u.soChungTu}] Plate: ${u.plate} | Class: ${u.oldClass || 'NULL'} -> ${u.newClass} | Notes: "${u.newNotes || ''}"`,
        );
      });
    }

    if (isApply && updates.length > 0) {
      console.log('\n🚀 Applying updates inside database transaction...');
      const queryRunner = ds.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        let appliedCount = 0;
        for (const u of updates) {
          await queryRunner.query(
            `UPDATE kgara_cases 
             SET classification = $1, 
                 erp_notes = $2, 
                 updated_at = NOW() 
             WHERE id = $3`,
            [u.newClass, u.newNotes, u.id],
          );
          appliedCount++;
        }

        await queryRunner.commitTransaction();
        console.log(
          `✅ SUCCESS: Applied ${appliedCount} updates to kgara_cases!`,
        );
      } catch (err) {
        await queryRunner.rollbackTransaction();
        console.error('❌ Transaction rolled back due to error:', err);
        throw err;
      } finally {
        await queryRunner.release();
      }
    } else if (!isApply) {
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
