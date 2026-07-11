import fs from 'node:fs';
import path from 'node:path';
import type { DataSource } from 'typeorm';

type Row = Record<string, unknown>;

type SectionSpec = {
  key: string;
  title: string;
  sql: string;
  params?: unknown[];
};

type RunSectionResult = {
  section: SectionSpec;
  rows: Row[];
};

let appDataSource: DataSource;

function parseCliArgs(argv: string[]) {
  const out = {
    limit: 20,
    tolerance: 0.0005,
    failOnMismatch: false,
    only: null as string | null,
    exportDir: null as string | null,
    exportFormat: 'both' as 'json' | 'csv' | 'both',
  };

  for (const arg of argv) {
    if (arg.startsWith('--limit=')) {
      const next = Number(arg.split('=')[1]);
      if (Number.isFinite(next) && next > 0) out.limit = Math.floor(next);
      continue;
    }
    if (arg.startsWith('--tolerance=')) {
      const next = Number(arg.split('=')[1]);
      if (Number.isFinite(next) && next >= 0) out.tolerance = next;
      continue;
    }
    if (arg === '--fail-on-mismatch') {
      out.failOnMismatch = true;
      continue;
    }
    if (arg.startsWith('--only=')) {
      out.only = arg.split('=')[1] || null;
      continue;
    }
    if (arg.startsWith('--export-dir=')) {
      out.exportDir = arg.split('=')[1] || null;
      continue;
    }
    if (arg.startsWith('--export-format=')) {
      const format = (arg.split('=')[1] || '').toLowerCase();
      if (format === 'json' || format === 'csv' || format === 'both') {
        out.exportFormat = format;
      }
    }
  }

  return out;
}

function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;

    const key = line.slice(0, eq).trim();
    if (!key || process.env[key] != null) continue;

    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function printHeader(title: string) {
  const line = '='.repeat(Math.max(36, title.length + 8));
  console.log(`\n${line}`);
  console.log(`=== ${title} ===`);
  console.log(line);
}

function stringifyValue(value: unknown) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
}

function formatNumber(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return stringifyValue(value);
  return n.toFixed(3);
}

function printRows(rows: Row[], limit: number) {
  if (!rows.length) {
    console.log('No mismatches found.');
    return;
  }

  console.log(`Mismatches: ${rows.length} (showing up to ${limit})`);
  const sliced = rows.slice(0, limit).map((row) => {
    const next: Row = {};
    for (const [k, v] of Object.entries(row)) {
      next[k] = typeof v === 'number' ? Number(formatNumber(v)) : v;
    }
    return next;
  });
  console.table(sliced);
}

async function runSection(section: SectionSpec, limit: number) {
  printHeader(section.title);
  const rows = await appDataSource.query(section.sql, section.params ?? []);
  printRows(rows, limit);
  return { section, rows } as RunSectionResult;
}

function sanitizeFileName(input: string) {
  return input.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function csvEscape(value: unknown) {
  if (value == null) return '';
  const text = stringifyValue(value);
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(rows: Row[]) {
  if (!rows.length) return 'no_data\n';
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) {
    lines.push(headers.map((key) => csvEscape(row[key])).join(','));
  }
  return `${lines.join('\n')}\n`;
}

function writeSectionExports(
  outputDir: string,
  results: RunSectionResult[],
  format: 'json' | 'csv' | 'both',
) {
  fs.mkdirSync(outputDir, { recursive: true });

  const summaryRows = results.map((result) => ({
    key: result.section.key,
    title: result.section.title,
    rowCount: result.rows.length,
  }));
  const totalMismatch = summaryRows
    .filter((row) => row.key !== 'baseline')
    .reduce((sum, row) => sum + row.rowCount, 0);

  const summaryPayload = {
    generatedAt: new Date().toISOString(),
    totalMismatchRows: totalMismatch,
    sections: summaryRows,
  };

  if (format === 'json' || format === 'both') {
    fs.writeFileSync(
      path.join(outputDir, 'summary.json'),
      JSON.stringify(summaryPayload, null, 2),
      'utf8',
    );
  }
  if (format === 'csv' || format === 'both') {
    fs.writeFileSync(
      path.join(outputDir, 'summary.csv'),
      toCsv(summaryRows as unknown as Row[]),
      'utf8',
    );
  }

  for (const result of results) {
    const base = sanitizeFileName(result.section.key);
    if (format === 'json' || format === 'both') {
      fs.writeFileSync(
        path.join(outputDir, `${base}.json`),
        JSON.stringify(result.rows, null, 2),
        'utf8',
      );
    }
    if (format === 'csv' || format === 'both') {
      fs.writeFileSync(
        path.join(outputDir, `${base}.csv`),
        toCsv(result.rows),
        'utf8',
      );
    }
  }

  console.log(`Exported audit artifacts to: ${outputDir}`);
}

function getSections(tolerance: number): SectionSpec[] {
  return [
    {
      key: 'baseline',
      title: 'Baseline counts and date ranges',
      sql: `
        SELECT * FROM (
          SELECT
            'erp_goods_receipts_posted'::text AS metric,
            COUNT(*)::numeric AS value,
            MIN(receipt_date)::text AS min_date,
            MAX(receipt_date)::text AS max_date
          FROM erp_goods_receipts
          WHERE status = 'POSTED' AND COALESCE(is_deleted, false) = false
          UNION ALL
          SELECT
            'erp_goods_issues_posted',
            COUNT(*)::numeric,
            MIN(issue_date)::text,
            MAX(issue_date)::text
          FROM erp_goods_issues
          WHERE status = 'POSTED' AND COALESCE(is_deleted, false) = false
          UNION ALL
          SELECT
            'erp_production_orders_active',
            COUNT(*)::numeric,
            MIN(created_at)::text,
            MAX(created_at)::text
          FROM erp_production_orders
          WHERE COALESCE(is_deleted, false) = false
          UNION ALL
          SELECT
            'erp_sales_orders_active',
            COUNT(*)::numeric,
            MIN(order_date)::text,
            MAX(order_date)::text
          FROM erp_sales_orders
          WHERE COALESCE(is_deleted, false) = false
          UNION ALL
          SELECT
            'erp_inventory_transactions',
            COUNT(*)::numeric,
            MIN(transaction_date)::text,
            MAX(transaction_date)::text
          FROM erp_inventory_transactions
        ) x
        ORDER BY metric;
      `,
    },
    {
      key: 'receipt-line-vs-txn',
      title: 'Phase 2 - Goods receipts vs inventory transactions',
      sql: `
        WITH gr_posted AS (
          SELECT id, receipt_no
          FROM erp_goods_receipts
          WHERE status = 'POSTED' AND COALESCE(is_deleted, false) = false
        ),
        line_qty AS (
          SELECT
            l.goods_receipt_id AS document_id,
            l.item_id,
            SUM(COALESCE(l.qty_received, 0))::numeric AS line_qty
          FROM erp_goods_receipt_lines l
          JOIN gr_posted gr ON gr.id = l.goods_receipt_id
          GROUP BY l.goods_receipt_id, l.item_id
        ),
        txn_qty AS (
          SELECT
            t.document_id,
            t.item_id,
            SUM(COALESCE(t.qty_in, 0))::numeric AS txn_qty
          FROM erp_inventory_transactions t
          JOIN gr_posted gr ON gr.id = t.document_id
          WHERE t.transaction_type = 'RECEIPT'
            AND t.document_type = 'GOODS_RECEIPT'
          GROUP BY t.document_id, t.item_id
        )
        SELECT
          COALESCE(l.document_id, t.document_id) AS goods_receipt_id,
          gr.receipt_no,
          COALESCE(l.item_id, t.item_id) AS item_id,
          COALESCE(l.line_qty, 0) AS line_qty,
          COALESCE(t.txn_qty, 0) AS txn_qty,
          (COALESCE(t.txn_qty, 0) - COALESCE(l.line_qty, 0)) AS qty_diff
        FROM line_qty l
        FULL OUTER JOIN txn_qty t
          ON t.document_id = l.document_id
         AND t.item_id IS NOT DISTINCT FROM l.item_id
        LEFT JOIN gr_posted gr ON gr.id = COALESCE(l.document_id, t.document_id)
        WHERE ABS(COALESCE(t.txn_qty, 0) - COALESCE(l.line_qty, 0)) > $1
        ORDER BY ABS(COALESCE(t.txn_qty, 0) - COALESCE(l.line_qty, 0)) DESC,
                 gr.receipt_no NULLS LAST;
      `,
      params: [tolerance],
    },
    {
      key: 'mo-material-vs-gi-lines',
      title: 'Phase 3A - MO materials qtyIssued vs goods issue lines',
      sql: `
        WITH mo_material AS (
          SELECT
            m.id AS material_id,
            m.production_order_id,
            m.item_id,
            COALESCE(m.qty_required, 0)::numeric AS qty_required,
            COALESCE(m.qty_issued, 0)::numeric AS qty_issued
          FROM erp_production_order_materials m
          JOIN erp_production_orders mo ON mo.id = m.production_order_id
          WHERE COALESCE(mo.is_deleted, false) = false
        ),
        gi_posted AS (
          SELECT id
          FROM erp_goods_issues
          WHERE status = 'POSTED' AND COALESCE(is_deleted, false) = false
        ),
        gi_line_sum AS (
          SELECT
            l.production_order_material_id AS material_id,
            SUM(COALESCE(l.qty_issued, 0))::numeric AS issued_by_gi_lines
          FROM erp_goods_issue_lines l
          JOIN gi_posted gi ON gi.id = l.goods_issue_id
          WHERE l.production_order_material_id IS NOT NULL
          GROUP BY l.production_order_material_id
        )
        SELECT
          mm.production_order_id,
          mo.reference_no,
          mm.material_id,
          mm.item_id,
          mm.qty_required,
          mm.qty_issued,
          COALESCE(gl.issued_by_gi_lines, 0) AS issued_by_gi_lines,
          (mm.qty_issued - COALESCE(gl.issued_by_gi_lines, 0)) AS qty_diff
        FROM mo_material mm
        JOIN erp_production_orders mo ON mo.id = mm.production_order_id
        LEFT JOIN gi_line_sum gl ON gl.material_id = mm.material_id
        WHERE ABS(mm.qty_issued - COALESCE(gl.issued_by_gi_lines, 0)) > $1
        ORDER BY ABS(mm.qty_issued - COALESCE(gl.issued_by_gi_lines, 0)) DESC,
                 mo.reference_no;
      `,
      params: [tolerance],
    },
    {
      key: 'production-gi-lines-vs-txn',
      title: 'Phase 3A - Production GI lines vs inventory ISSUE txns',
      sql: `
        WITH gi_prod AS (
          SELECT id, issue_no
          FROM erp_goods_issues
          WHERE status = 'POSTED'
            AND COALESCE(is_deleted, false) = false
            AND production_order_id IS NOT NULL
        ),
        line_qty AS (
          SELECT
            l.goods_issue_id AS document_id,
            l.item_id,
            SUM(COALESCE(l.qty_issued, 0))::numeric AS line_qty
          FROM erp_goods_issue_lines l
          JOIN gi_prod gi ON gi.id = l.goods_issue_id
          GROUP BY l.goods_issue_id, l.item_id
        ),
        txn_qty AS (
          SELECT
            t.document_id,
            t.item_id,
            SUM(COALESCE(t.qty_out, 0))::numeric AS txn_qty
          FROM erp_inventory_transactions t
          JOIN gi_prod gi ON gi.id = t.document_id
          WHERE t.transaction_type = 'ISSUE'
            AND t.document_type = 'GOODS_ISSUE'
          GROUP BY t.document_id, t.item_id
        )
        SELECT
          COALESCE(l.document_id, t.document_id) AS goods_issue_id,
          gi.issue_no,
          COALESCE(l.item_id, t.item_id) AS item_id,
          COALESCE(l.line_qty, 0) AS line_qty,
          COALESCE(t.txn_qty, 0) AS txn_qty,
          (COALESCE(t.txn_qty, 0) - COALESCE(l.line_qty, 0)) AS qty_diff
        FROM line_qty l
        FULL OUTER JOIN txn_qty t
          ON t.document_id = l.document_id
         AND t.item_id IS NOT DISTINCT FROM l.item_id
        LEFT JOIN gi_prod gi ON gi.id = COALESCE(l.document_id, t.document_id)
        WHERE ABS(COALESCE(t.txn_qty, 0) - COALESCE(l.line_qty, 0)) > $1
        ORDER BY ABS(COALESCE(t.txn_qty, 0) - COALESCE(l.line_qty, 0)) DESC,
                 gi.issue_no NULLS LAST;
      `,
      params: [tolerance],
    },
    {
      key: 'mo-produced-vs-gr-lines',
      title: 'Phase 3B - MO qtyProduced vs finished-good receipts',
      sql: `
        WITH mo_active AS (
          SELECT
            mo.id,
            mo.reference_no,
            mo.finished_good_item_id,
            COALESCE(mo.qty_to_produce, 0)::numeric AS qty_to_produce,
            COALESCE(mo.qty_produced, 0)::numeric AS qty_produced
          FROM erp_production_orders mo
          WHERE COALESCE(mo.is_deleted, false) = false
        ),
        gr_sum AS (
          SELECT
            gr.production_order_id,
            l.item_id,
            SUM(COALESCE(l.qty_received, 0))::numeric AS received_qty
          FROM erp_goods_receipts gr
          JOIN erp_goods_receipt_lines l ON l.goods_receipt_id = gr.id
          WHERE gr.status = 'POSTED'
            AND COALESCE(gr.is_deleted, false) = false
            AND gr.production_order_id IS NOT NULL
          GROUP BY gr.production_order_id, l.item_id
        )
        SELECT
          mo.id AS production_order_id,
          mo.reference_no,
          mo.finished_good_item_id,
          mo.qty_to_produce,
          mo.qty_produced,
          COALESCE(gs.received_qty, 0) AS received_qty_from_gr,
          (mo.qty_produced - COALESCE(gs.received_qty, 0)) AS qty_diff
        FROM mo_active mo
        LEFT JOIN gr_sum gs
          ON gs.production_order_id = mo.id
         AND gs.item_id = mo.finished_good_item_id
        WHERE ABS(mo.qty_produced - COALESCE(gs.received_qty, 0)) > $1
        ORDER BY ABS(mo.qty_produced - COALESCE(gs.received_qty, 0)) DESC,
                 mo.reference_no;
      `,
      params: [tolerance],
    },
    {
      key: 'sales-delivered-vs-gi-lines',
      title: 'Phase 4 - Sales delivered qty vs goods issue lines',
      sql: `
        WITH so_line AS (
          SELECT
            l.id AS sales_order_line_id,
            l.sales_order_id,
            l.item_id,
            COALESCE(l.qty_ordered, 0)::numeric AS qty_ordered,
            COALESCE(l.qty_delivered, 0)::numeric AS qty_delivered
          FROM erp_sales_order_lines l
          JOIN erp_sales_orders so ON so.id = l.sales_order_id
          WHERE COALESCE(so.is_deleted, false) = false
        ),
        gi_sales_posted AS (
          SELECT id
          FROM erp_goods_issues
          WHERE status = 'POSTED'
            AND COALESCE(is_deleted, false) = false
            AND sales_order_id IS NOT NULL
        ),
        gi_line_sum AS (
          SELECT
            l.sales_order_line_id,
            SUM(COALESCE(l.qty_issued, 0))::numeric AS issued_qty
          FROM erp_goods_issue_lines l
          JOIN gi_sales_posted gi ON gi.id = l.goods_issue_id
          WHERE l.sales_order_line_id IS NOT NULL
          GROUP BY l.sales_order_line_id
        )
        SELECT
          sl.sales_order_id,
          so.so_no,
          sl.sales_order_line_id,
          sl.item_id,
          sl.qty_ordered,
          sl.qty_delivered,
          COALESCE(gs.issued_qty, 0) AS issued_qty,
          (sl.qty_delivered - COALESCE(gs.issued_qty, 0)) AS qty_diff
        FROM so_line sl
        JOIN erp_sales_orders so ON so.id = sl.sales_order_id
        LEFT JOIN gi_line_sum gs ON gs.sales_order_line_id = sl.sales_order_line_id
        WHERE ABS(sl.qty_delivered - COALESCE(gs.issued_qty, 0)) > $1
        ORDER BY ABS(sl.qty_delivered - COALESCE(gs.issued_qty, 0)) DESC,
                 so.so_no;
      `,
      params: [tolerance],
    },
    {
      key: 'sales-gi-lines-vs-txn',
      title: 'Phase 4 - Sales GI lines vs inventory ISSUE txns',
      sql: `
        WITH gi_sales AS (
          SELECT id, issue_no
          FROM erp_goods_issues
          WHERE status = 'POSTED'
            AND COALESCE(is_deleted, false) = false
            AND sales_order_id IS NOT NULL
        ),
        line_qty AS (
          SELECT
            l.goods_issue_id AS document_id,
            l.item_id,
            SUM(COALESCE(l.qty_issued, 0))::numeric AS line_qty
          FROM erp_goods_issue_lines l
          JOIN gi_sales gi ON gi.id = l.goods_issue_id
          GROUP BY l.goods_issue_id, l.item_id
        ),
        txn_qty AS (
          SELECT
            t.document_id,
            t.item_id,
            SUM(COALESCE(t.qty_out, 0))::numeric AS txn_qty
          FROM erp_inventory_transactions t
          JOIN gi_sales gi ON gi.id = t.document_id
          WHERE t.transaction_type = 'ISSUE'
            AND t.document_type = 'GOODS_ISSUE'
          GROUP BY t.document_id, t.item_id
        )
        SELECT
          COALESCE(l.document_id, t.document_id) AS goods_issue_id,
          gi.issue_no,
          COALESCE(l.item_id, t.item_id) AS item_id,
          COALESCE(l.line_qty, 0) AS line_qty,
          COALESCE(t.txn_qty, 0) AS txn_qty,
          (COALESCE(t.txn_qty, 0) - COALESCE(l.line_qty, 0)) AS qty_diff
        FROM line_qty l
        FULL OUTER JOIN txn_qty t
          ON t.document_id = l.document_id
         AND t.item_id IS NOT DISTINCT FROM l.item_id
        LEFT JOIN gi_sales gi ON gi.id = COALESCE(l.document_id, t.document_id)
        WHERE ABS(COALESCE(t.txn_qty, 0) - COALESCE(l.line_qty, 0)) > $1
        ORDER BY ABS(COALESCE(t.txn_qty, 0) - COALESCE(l.line_qty, 0)) DESC,
                 gi.issue_no NULLS LAST;
      `,
      params: [tolerance],
    },
    {
      key: 'balance-vs-ledger',
      title: 'Phase 5 - Inventory balances vs transaction ledger',
      sql: `
        WITH ledger AS (
          SELECT
            t.item_id,
            t.warehouse_code,
            SUM(COALESCE(t.qty_in, 0))::numeric AS qty_in,
            SUM(COALESCE(t.qty_out, 0))::numeric AS qty_out,
            SUM(COALESCE(t.qty_in, 0) - COALESCE(t.qty_out, 0))::numeric AS expected_on_hand
          FROM erp_inventory_transactions t
          GROUP BY t.item_id, t.warehouse_code
        ),
        bal AS (
          SELECT
            b.item_id,
            b.warehouse_code,
            COALESCE(b.qty_on_hand, 0)::numeric AS qty_on_hand,
            COALESCE(b.qty_reserved, 0)::numeric AS qty_reserved,
            COALESCE(b.inventory_value, 0)::numeric AS inventory_value,
            COALESCE(b.avg_unit_cost, 0)::numeric AS avg_unit_cost
          FROM erp_inventory_balances b
        )
        SELECT
          COALESCE(l.item_id, b.item_id) AS item_id,
          COALESCE(l.warehouse_code, b.warehouse_code) AS warehouse_code,
          COALESCE(l.qty_in, 0) AS qty_in,
          COALESCE(l.qty_out, 0) AS qty_out,
          COALESCE(l.expected_on_hand, 0) AS expected_on_hand,
          COALESCE(b.qty_on_hand, 0) AS balance_on_hand,
          (COALESCE(b.qty_on_hand, 0) - COALESCE(l.expected_on_hand, 0)) AS qty_diff,
          COALESCE(b.qty_reserved, 0) AS qty_reserved,
          COALESCE(b.inventory_value, 0) AS inventory_value,
          COALESCE(b.avg_unit_cost, 0) AS avg_unit_cost
        FROM ledger l
        FULL OUTER JOIN bal b
          ON COALESCE(b.item_id::text, '__NULL__') = COALESCE(l.item_id::text, '__NULL__')
         AND COALESCE(b.warehouse_code, '__NULL__') = COALESCE(l.warehouse_code, '__NULL__')
        WHERE ABS(COALESCE(b.qty_on_hand, 0) - COALESCE(l.expected_on_hand, 0)) > $1
        ORDER BY ABS(COALESCE(b.qty_on_hand, 0) - COALESCE(l.expected_on_hand, 0)) DESC,
                 item_id NULLS LAST;
      `,
      params: [tolerance],
    },
  ];
}

async function main() {
  loadEnvFile();
  const args = parseCliArgs(process.argv.slice(2));
  const sections = getSections(args.tolerance);

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required. Check .env in project root.');
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  appDataSource = require('../db/data-source').default as DataSource;
  await appDataSource.initialize();

  try {
    console.log('Running ERP core inventory audit...');
    console.log(
      `Options: limit=${args.limit}, tolerance=${args.tolerance}, failOnMismatch=${args.failOnMismatch}, exportDir=${args.exportDir ?? 'none'}, exportFormat=${args.exportFormat}`,
    );

    let totalMismatches = 0;
    const results: RunSectionResult[] = [];
    for (const section of sections) {
      if (args.only && section.key !== args.only) continue;
      const result = await runSection(section, args.limit);
      results.push(result);
      if (section.key !== 'baseline') totalMismatches += result.rows.length;
    }

    printHeader('Audit summary');
    console.log(`Total mismatch rows (excluding baseline): ${totalMismatches}`);

    if (args.failOnMismatch && totalMismatches > 0) {
      process.exitCode = 2;
      console.log('fail-on-mismatch is enabled. Exiting with code 2.');
    }

    if (args.exportDir) {
      const resolvedOutput = path.resolve(process.cwd(), args.exportDir);
      writeSectionExports(resolvedOutput, results, args.exportFormat);
    }
  } finally {
    await appDataSource.destroy();
  }
}

main().catch((error) => {
  console.error('Inventory audit failed:', error);
  process.exitCode = 1;
});
