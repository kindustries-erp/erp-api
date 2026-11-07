/**
 * verify-po-request-parity.ts — đối soát chỉ đọc giữa PR/PO garage cũ và lõi cashflow mới.
 *
 * Kiểm tra:
 *   1. Mọi PO có request_id đều có dự chi PURCHASE tương ứng (cùng id).
 *   2. Mọi dòng PO có request_line_id đều có dòng dự chi tương ứng (cùng id).
 *   3. Số PR cũ (chưa xóa) = số dự chi PURCHASE LEGACY_PR; số dòng khớp.
 *   4. qty_ordered của từng dòng khớp giữa bảng cũ và dòng dự chi mới.
 *   5. Trạng thái PR cũ ánh xạ đúng sang dự chi (CLOSED -> CANCELLED có dấu đóng).
 *
 * Chỉ đọc (default_transaction_read_only = on). Thoát mã 1 nếu có lệch, để dùng được trong pipeline.
 *
 * Chạy (trong thư mục erp-api, env tường minh):
 *   TS_NODE_TRANSPILE_ONLY=true node -r ts-node/register -r tsconfig-paths/register src/v2/modules/cashflow-garage/scripts/verify-po-request-parity.ts --target=greenway-staging
 */

import { Client } from 'pg';
import {
  describeScriptEnv,
  resolveScriptEnv,
  ScriptEnvError,
} from '../../../../common/scripts/load-script-env';

const args = process.argv.slice(2);

/** Ánh xạ trạng thái PR cũ -> dự chi mới (xem plan mục 3.4). */
const EXPECTED_FORECAST_STATUS: Record<string, string> = {
  DRAFT: 'DRAFT',
  APPROVED: 'OPEN',
  CLOSED: 'CANCELLED',
  CANCELLED: 'CANCELLED',
};

interface Check {
  label: string;
  expected: string;
  actual: string;
  ok: boolean;
}

async function scalar(client: Client, sql: string): Promise<string> {
  const { rows } = await client.query<Record<string, string | number>>(sql);
  return String(Object.values(rows[0])[0]);
}

async function collectChecks(client: Client): Promise<Check[]> {
  const checks: Check[] = [];
  const add = (label: string, expected: string, actual: string) =>
    checks.push({ label, expected, actual, ok: expected === actual });

  add(
    'PO header: request_id thiếu dự chi PURCHASE',
    '0',
    await scalar(
      client,
      `SELECT count(*)::text FROM erp_garage_proc_orders o
        WHERE o.request_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM cashflow_forecasts f WHERE f.id = o.request_id AND f.kind = 'PURCHASE')`,
    ),
  );
  add(
    'PO dòng: request_line_id thiếu dòng dự chi',
    '0',
    await scalar(
      client,
      `SELECT count(*)::text FROM erp_garage_proc_order_lines l
        WHERE l.request_line_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM cashflow_forecast_lines fl WHERE fl.id = l.request_line_id)`,
    ),
  );
  add(
    'PR cũ (chưa xóa) = dự chi PURCHASE LEGACY_PR',
    await scalar(
      client,
      `SELECT count(*)::text FROM erp_garage_proc_requests WHERE is_deleted = false`,
    ),
    await scalar(
      client,
      `SELECT count(*)::text FROM cashflow_forecasts WHERE kind = 'PURCHASE' AND source_type = 'LEGACY_PR' AND is_deleted = false`,
    ),
  );
  add(
    'Dòng PR cũ (thuộc PR chưa xóa) = dòng dự chi',
    await scalar(
      client,
      `SELECT count(*)::text FROM erp_garage_proc_request_lines l
         JOIN erp_garage_proc_requests r ON r.id = l.request_id
        WHERE r.is_deleted = false`,
    ),
    await scalar(
      client,
      `SELECT count(*)::text FROM cashflow_forecast_lines fl
         JOIN cashflow_forecasts f ON f.id = fl.forecast_id
        WHERE f.source_type = 'LEGACY_PR' AND f.is_deleted = false`,
    ),
  );
  add(
    'qty_ordered lệch giữa PR cũ và dự chi mới',
    '0',
    await scalar(
      client,
      `SELECT count(*)::text FROM erp_garage_proc_request_lines l
         JOIN cashflow_forecast_lines fl ON fl.id = l.id
        WHERE l.qty_ordered <> fl.qty_ordered`,
    ),
  );

  const { rows: statusRows } = await client.query<{
    old_status: string;
    new_status: string;
    n: string;
  }>(
    `SELECT r.status AS old_status, f.status AS new_status, count(*)::text AS n
       FROM erp_garage_proc_requests r
       JOIN cashflow_forecasts f ON f.id = r.id
      WHERE r.is_deleted = false
      GROUP BY r.status, f.status`,
  );
  for (const row of statusRows) {
    const expected = EXPECTED_FORECAST_STATUS[row.old_status];
    checks.push({
      label: `Trạng thái PR ${row.old_status} -> dự chi ${row.new_status} (${row.n} phiếu)`,
      expected: expected ?? '(không có quy tắc)',
      actual: row.new_status,
      ok: expected === row.new_status,
    });
  }

  return checks;
}

async function main(): Promise<void> {
  console.log(
    '================================================================',
  );
  console.log('ĐỐI SOÁT PO <-> PR GARAGE (chỉ đọc)');
  console.log(
    '================================================================',
  );

  const scriptEnv = resolveScriptEnv({ argv: args });
  console.log(
    describeScriptEnv(scriptEnv, { apply: false, allowed: true, message: '' }),
  );
  if (!scriptEnv.explicit && scriptEnv.isProduction) {
    throw new ScriptEnvError(
      `Env mặc định đang trỏ DB production (${scriptEnv.dbLabel}). Hãy chỉ định env tường minh.`,
    );
  }

  const client = new Client({
    connectionString: scriptEnv.databaseUrl,
    ssl: scriptEnv.ssl,
  });
  await client.connect();
  try {
    await client.query('SET default_transaction_read_only = on');
    const db = await scalar(client, 'SELECT current_database()');
    console.log(`Database thực tế: ${db}\n`);

    const checks = await collectChecks(client);
    for (const c of checks) {
      console.log(
        `  [${c.ok ? 'OK' : 'LỆCH'}] ${c.label.padEnd(56)} kỳ vọng=${c.expected} thực tế=${c.actual}`,
      );
    }
    const failed = checks.filter((c) => !c.ok).length;
    console.log(
      `\nKẾT QUẢ: ${failed === 0 ? 'KHỚP' : `LỆCH ${failed} kiểm tra`}`,
    );
    if (failed > 0) process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error('ERR', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
