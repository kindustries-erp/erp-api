import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env
dotenv.config();

const DATABASE_URL: string = process.env.DATABASE_URL || '';
if (!DATABASE_URL) {
  throw new Error('❌ Thiếu biến DATABASE_URL trong môi trường hoặc file .env');
}

const isExecute = process.argv.includes('--execute');

const ds = new DataSource({
  type: 'postgres',
  url: DATABASE_URL,
  synchronize: false,
});

function formatYyyyMmDd(dateInput: Date | string | null): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

async function main() {
  console.log('='.repeat(80));
  console.log(
    '🚀 STANDARDIZE JOURNAL ENTRY NUMBERS (OPTION 3: 4-DIGIT SEQUENTIAL)',
  );
  console.log(`Target DB: ${DATABASE_URL.split('@')[1] || DATABASE_URL}`);
  console.log(
    `Mode: ${isExecute ? '⚡ EXECUTE (APPLYING CHANGES)' : '🔍 DRY-RUN (SIMULATION ONLY)'}`,
  );
  console.log('='.repeat(80));

  await ds.initialize();
  const queryRunner = ds.createQueryRunner();
  await queryRunner.connect();

  try {
    // 1. Tạo bảng erp_document_sequences nếu chưa có
    console.log(
      '\n📦 Ensuring erp_document_sequences table and indexes exist...',
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS erp_document_sequences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        prefix VARCHAR(32) NOT NULL,
        period VARCHAR(16) NOT NULL,
        branch_id UUID NULL,
        current_value INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_erp_document_sequences_prefix_period_branch 
      ON erp_document_sequences (prefix, period, COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid));
    `);

    // 2. Lấy toàn bộ danh sách bút toán
    const rows: Array<{
      id: string;
      entry_no: string | null;
      source_type: string | null;
      source_id: string | null;
      date: string | null;
      document_date: string | null;
      created_at: string;
      branch_id: string | null;
    }> = await queryRunner.query(`
      SELECT id, entry_no, source_type, source_id, date, document_date, created_at, branch_id
      FROM erp_journal_entries
      ORDER BY date ASC NULLS LAST, created_at ASC
    `);

    console.log(`\n📊 Total journal entries in DB: ${rows.length}`);

    // 3. Gom nhóm theo (prefix, period, branchId) để đánh số tuần tự 0001, 0002...
    const groups = new Map<
      string,
      Array<{ id: string; oldEntryNo: string | null; createdAt: string }>
    >();
    const groupMaxSeq = new Map<
      string,
      {
        prefix: string;
        period: string;
        branchId: string | null;
        maxSeq: number;
      }
    >();

    for (const row of rows) {
      const oldNo = row.entry_no || '';
      let prefix = 'CT';
      let yyyymmdd = '';

      const match = oldNo.match(/^([A-ZĐ_]+)-(\d{8})/);
      if (match) {
        prefix = match[1];
        yyyymmdd = match[2];
      } else {
        if (row.source_type === 'INVOICE') prefix = 'HĐM';
        else if (row.source_type === 'BANK') prefix = 'UNC';
        else if (row.source_type === 'CASH') prefix = 'PC';
        else prefix = 'CT';
        yyyymmdd = formatYyyyMmDd(
          row.date || row.document_date || row.created_at,
        );
      }

      const branchKey = row.branch_id || 'DEFAULT';
      const groupKey = `${prefix}::${yyyymmdd}::${branchKey}`;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
        groupMaxSeq.set(groupKey, {
          prefix,
          period: yyyymmdd,
          branchId: row.branch_id,
          maxSeq: 0,
        });
      }

      groups.get(groupKey)!.push({
        id: row.id,
        oldEntryNo: row.entry_no,
        createdAt: row.created_at,
      });
    }

    const updates: Array<{
      id: string;
      oldEntryNo: string | null;
      newEntryNo: string;
    }> = [];

    for (const [groupKey, items] of groups.entries()) {
      const meta = groupMaxSeq.get(groupKey)!;
      let seq = 1;
      for (const item of items) {
        const seqStr = String(seq).padStart(4, '0');
        const newNo = `${meta.prefix}-${meta.period}-${seqStr}`;
        updates.push({
          id: item.id,
          oldEntryNo: item.oldEntryNo,
          newEntryNo: newNo,
        });
        seq++;
      }
      meta.maxSeq = seq - 1;
    }

    console.log(
      `\n📋 Group summary: Processed ${groups.size} daily sequence groups.`,
    );
    console.log(`\n📋 Preview first 20 migrations:`);
    console.table(
      updates.slice(0, 20).map((u, i) => ({
        STT: i + 1,
        ID: u.id.slice(0, 8),
        Old: u.oldEntryNo,
        New: u.newEntryNo,
      })),
    );

    if (updates.length > 20) {
      console.log(`... and ${updates.length - 20} more entries.`);
    }

    if (!isExecute) {
      console.log(
        '\n⚠️ DRY-RUN COMPLETE. No changes were committed to the database.',
      );
      console.log(
        'To apply these changes, re-run with: bunx ts-node scripts/standardize-journal-entry-numbers.ts --execute',
      );
      return;
    }

    // Thực thi trong Transaction
    console.log('\n⚡ Starting database transaction...');
    await queryRunner.startTransaction();

    let count = 0;
    for (const item of updates) {
      await queryRunner.query(
        `UPDATE erp_journal_entries SET entry_no = $1, updated_at = NOW() WHERE id = $2`,
        [item.newEntryNo, item.id],
      );
      count++;
    }

    // Seed sequences table
    console.log('🌱 Seeding erp_document_sequences with current max values...');
    for (const meta of groupMaxSeq.values()) {
      await queryRunner.query(
        `
        INSERT INTO erp_document_sequences (prefix, period, branch_id, current_value, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (prefix, period, COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid))
        DO UPDATE SET current_value = EXCLUDED.current_value, updated_at = NOW();
        `,
        [meta.prefix, meta.period, meta.branchId, meta.maxSeq],
      );
    }

    await queryRunner.commitTransaction();
    console.log(
      `\n🎉 Successfully updated ${count} journal entries to 4-digit sequential format!`,
    );

    // Kiểm tra lại sau khi cập nhật
    const finalStats = await queryRunner.query(`
      SELECT 
        CASE 
          WHEN entry_no SIMILAR TO '%-[0-9]{8}-[0-9]{4}' THEN 'STANDARDIZED (PREFIX-YYYYMMDD-XXXX)'
          ELSE 'OTHER'
        END as format_group,
        count(*) as count
      FROM erp_journal_entries
      GROUP BY 1
    `);
    console.log('\nFinal DB Distribution:');
    console.table(finalStats);

    const sampleSequences = await queryRunner.query(`
      SELECT prefix, period, branch_id, current_value, updated_at
      FROM erp_document_sequences
      ORDER BY updated_at DESC
      LIMIT 10
    `);
    console.log('\nSample Seated Sequences:');
    console.table(sampleSequences);
  } catch (error: any) {
    if (queryRunner.isTransactionActive) {
      await queryRunner.rollbackTransaction();
      console.error('❌ Transaction rolled back due to error.');
    }
    console.error('Error during migration:', error);
    process.exit(1);
  } finally {
    await queryRunner.release();
    await ds.destroy();
  }
}

main().catch(console.error);
