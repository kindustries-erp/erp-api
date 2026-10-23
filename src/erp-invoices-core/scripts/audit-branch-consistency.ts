/**
 * audit-branch-consistency.ts
 *
 * Kiểm tra CHỈ ĐỌC tính nhất quán đa chi nhánh của hóa đơn, sao kê và bút toán.
 * Quy ước: `branch_ids` là nguồn chuẩn, `branch_id` là phần tử đầu, mảng rỗng = chưa gán.
 *
 * Báo cáo:
 *   1. Hóa đơn: `branch_id` không thuộc `branch_ids` (hoặc mảng rỗng khi có `branch_id`)
 *   2. Sao kê: cùng kiểu kiểm tra
 *   3. Bút toán hóa đơn đã ghi sổ không nằm ở chi nhánh của hóa đơn, nhóm theo cặp chi nhánh
 *   4. Hóa đơn đã ghi sổ nhưng không có bút toán đang hoạt động
 *
 * Env: theo loader chuẩn (src/common/scripts/load-script-env.ts). Script không ghi DB.
 *   bun src/erp-invoices-core/scripts/audit-branch-consistency.ts .env.greenway-staging
 */

import { Client } from 'pg';
import {
  describeScriptEnv,
  resolveScriptEnv,
  ScriptEnvError,
} from '../../common/scripts/load-script-env';

async function run(): Promise<void> {
  const scriptEnv = resolveScriptEnv({ argv: process.argv.slice(2) });
  const client = new Client({
    connectionString: scriptEnv.databaseUrl,
    ssl: scriptEnv.ssl,
  });
  await client.connect();
  try {
    console.log(
      describeScriptEnv(scriptEnv, {
        apply: false,
        allowed: false,
        message: 'AUDIT: chỉ đọc',
      }),
    );
    const current = await client.query<{ current_database: string }>(
      'SELECT current_database()',
    );
    console.log(`DB thực tế: ${current.rows[0].current_database}\n`);

    const invoiceSummary = await client.query(`
      SELECT
        count(*) FILTER (WHERE cardinality(branch_ids) = 0 AND branch_id IS NULL) AS unassigned,
        count(*) FILTER (WHERE cardinality(branch_ids) = 0 AND branch_id IS NOT NULL) AS branch_id_only,
        count(*) FILTER (WHERE cardinality(branch_ids) > 0 AND branch_id IS NOT NULL AND branch_id <> branch_ids[1]) AS first_mismatch,
        count(*) FILTER (WHERE cardinality(branch_ids) > 1) AS multi_branch
      FROM erp_invoices WHERE is_deleted = false`);
    console.log('[1] Hóa đơn:', invoiceSummary.rows[0]);

    const txnSummary = await client.query(`
      SELECT
        count(*) FILTER (WHERE cardinality(branch_ids) = 0 AND branch_id IS NOT NULL) AS branch_id_only,
        count(*) FILTER (WHERE cardinality(branch_ids) > 0 AND branch_id IS NOT NULL AND branch_id <> branch_ids[1]) AS first_mismatch,
        count(*) FILTER (WHERE cardinality(branch_ids) > 1) AS multi_branch
      FROM erp_bank_transactions WHERE is_deleted = false`);
    console.log('[2] Sao kê:', txnSummary.rows[0]);

    const jeByPair = await client.query(`
      SELECT
        COALESCE((SELECT string_agg(b.code, ',' ORDER BY b.code) FROM erp_branches b WHERE b.id = ANY(i.branch_ids)), '(chưa gán)') AS invoice_branches,
        COALESCE((SELECT code FROM erp_branches WHERE id = je.branch_id), '(trống)') AS journal_branch,
        i.direction,
        count(*) AS invoices
      FROM erp_invoices i
      JOIN erp_journal_entries je
        ON je.source_id::text = i.id::text AND je.source_type = 'INVOICE' AND je.is_deleted = false
      WHERE i.is_deleted = false AND i.posting_status = 'POSTED'
        AND je.branch_id IS NOT NULL
        AND NOT (je.branch_id = ANY(i.branch_ids))
      GROUP BY 1, 2, 3
      ORDER BY invoices DESC`);
    console.log('[3] Bút toán lệch chi nhánh (nhóm theo cặp):');
    console.table(jeByPair.rows);

    const postedNoJe = await client.query(`
      SELECT count(*) AS posted_without_active_journal
      FROM erp_invoices i
      WHERE i.is_deleted = false AND i.posting_status = 'POSTED'
        AND NOT EXISTS (
          SELECT 1 FROM erp_journal_entries je
          WHERE je.source_id::text = i.id::text AND je.source_type = 'INVOICE' AND je.is_deleted = false
        )`);
    console.log('[4] Đã ghi sổ nhưng thiếu bút toán:', postedNoJe.rows[0]);
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  if (err instanceof ScriptEnvError) {
    console.error(`Lỗi env: ${err.message}`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
