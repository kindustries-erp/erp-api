/**
 * verify-legacy-purchase-requests.ts — đối soát chỉ đọc PR cũ với dự chi PURCHASE để facade PR đọc đúng.
 *
 * Kiểm tra (lệch = exit 1):
 *   1. Số PR cũ chưa xóa = số dự chi PURCHASE LEGACY_PR chưa xóa.
 *   2. Tiêu đề, người yêu cầu, mã hàng, mô tả, ghi chú được chép đủ (đếm khớp).
 *   3. qty_requested và qty_ordered của từng dòng khớp.
 *   4. Tổng dự kiến khớp (amount = tổng dòng hoặc estimated_total).
 *   5. Trạng thái PR cũ ánh xạ đúng sang dự chi.
 *
 * Thông tin, không tính là lệch (khác có chủ đích, xem legacy-purchase-request.mapper.ts):
 *   - requestDate = ngày tạo dự chi; neededDate = planned_date (đã gộp với ngày tạo khi thiếu ngày cần).
 *   - cancelReason không có trên dự chi.
 *
 * Chỉ đọc (default_transaction_read_only = on).
 *
 * Chạy (trong thư mục erp-api, env tường minh):
 *   TS_NODE_TRANSPILE_ONLY=true node -r ts-node/register -r tsconfig-paths/register src/v2/modules/cashflow-garage/scripts/verify-legacy-purchase-requests.ts --target=greenway-staging
 */

import { Client } from 'pg';
import {
  describeScriptEnv,
  resolveScriptEnv,
  ScriptEnvError,
} from '../../../../common/scripts/load-script-env';

const args = process.argv.slice(2);

/** Ánh xạ trạng thái PR cũ -> dự chi mới (đồng bộ với legacyPrStatus). */
const EXPECTED_FORECAST_STATUS: Record<string, string> = {
  DRAFT: 'DRAFT',
  APPROVED: 'OPEN',
  CLOSED: 'CANCELLED',
  CANCELLED: 'CANCELLED',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
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
    'Số PR cũ chưa xóa = dự chi PURCHASE LEGACY_PR',
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
    'Tiêu đề (title) đã chép đủ',
    await scalar(
      client,
      `SELECT count(title)::text FROM erp_garage_proc_requests WHERE is_deleted = false`,
    ),
    await scalar(
      client,
      `SELECT count(f.title)::text FROM cashflow_forecasts f WHERE f.source_type = 'LEGACY_PR' AND f.is_deleted = false`,
    ),
  );

  add(
    'Người yêu cầu (requester_employee_id) đã chép đủ',
    await scalar(
      client,
      `SELECT count(requester_employee_id)::text FROM erp_garage_proc_requests WHERE is_deleted = false`,
    ),
    await scalar(
      client,
      `SELECT count(f.requester_employee_id)::text FROM cashflow_forecasts f WHERE f.source_type = 'LEGACY_PR' AND f.is_deleted = false`,
    ),
  );

  add(
    'Mã hàng dòng (item_code) đã chép đủ',
    await scalar(
      client,
      `SELECT count(l.item_code)::text FROM erp_garage_proc_request_lines l
         JOIN erp_garage_proc_requests r ON r.id = l.request_id WHERE r.is_deleted = false`,
    ),
    await scalar(
      client,
      `SELECT count(fl.item_code)::text FROM cashflow_forecast_lines fl
         JOIN cashflow_forecasts f ON f.id = fl.forecast_id
        WHERE f.source_type = 'LEGACY_PR' AND f.is_deleted = false`,
    ),
  );

  add(
    'Dòng PR cũ (thuộc PR chưa xóa) = dòng dự chi',
    await scalar(
      client,
      `SELECT count(*)::text FROM erp_garage_proc_request_lines l
         JOIN erp_garage_proc_requests r ON r.id = l.request_id WHERE r.is_deleted = false`,
    ),
    await scalar(
      client,
      `SELECT count(*)::text FROM cashflow_forecast_lines fl
         JOIN cashflow_forecasts f ON f.id = fl.forecast_id
        WHERE f.source_type = 'LEGACY_PR' AND f.is_deleted = false`,
    ),
  );

  add(
    'qty_requested / qty_ordered lệch giữa PR cũ và dự chi mới',
    '0',
    await scalar(
      client,
      `SELECT count(*)::text FROM erp_garage_proc_request_lines l
         JOIN cashflow_forecast_lines fl ON fl.id = l.id
        WHERE l.qty_requested <> fl.qty_requested OR l.qty_ordered <> fl.qty_ordered`,
    ),
  );

  add(
    'Tổng dự kiến lệch (estimated_total hoặc tổng dòng)',
    '0',
    await scalar(
      client,
      `SELECT count(*)::text FROM erp_garage_proc_requests r
         JOIN cashflow_forecasts f ON f.id = r.id
        WHERE r.is_deleted = false
          AND f.amount <> COALESCE(NULLIF((SELECT sum(l.est_amount) FROM erp_garage_proc_request_lines l WHERE l.request_id = r.id), 0), r.estimated_total, 0)`,
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
  console.log('ĐỐI SOÁT PR CŨ <-> DỰ CHI PURCHASE (chỉ đọc)');
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
