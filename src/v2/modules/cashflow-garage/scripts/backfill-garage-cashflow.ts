/**
 * backfill-garage-cashflow.ts (P1.2 — chỉ DRY-RUN)
 *
 * Đối soát trước khi chuyển dữ liệu từ dòng cũ sang lõi mới:
 *   kgara_cashflow_vouchers     -> cashflow_forecasts / cashflow_payments
 *   erp_garage_proc_requests    -> cashflow_forecasts (kind = PURCHASE)
 *   kgara_case_settlements      -> cashflow_allocations
 *
 * Mặc định chỉ đọc và in báo cáo. --apply ghi DB (một transaction, đối chiếu sau ghi, lệch thì rollback)
 * và BẮT BUỘC kèm --confirm=<tên DB thực tế>.
 *
 * Env: theo loader chuẩn (src/common/scripts/load-script-env.ts), KHÔNG có file mặc định:
 *   <.env.xxx> (tham số vị trí) | --env=<file> | --target=<tenant>-<stage> | ENV_FILE | .env
 *
 * Cách chạy (trong thư mục erp-api):
 *   bun src/v2/modules/cashflow-garage/scripts/backfill-garage-cashflow.ts --target=greenway-staging
 *   bun src/v2/modules/cashflow-garage/scripts/backfill-garage-cashflow.ts --target=greenway-staging --apply --confirm=erp_greenway_staging
 */

import { Client } from 'pg';
import {
  describeScriptEnv,
  resolveScriptEnv,
  ScriptEnvError,
} from '../../../../common/scripts/load-script-env';
import { applyGarageCashflowBackfill } from './backfill-garage-cashflow.apply';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const SIMULATE = args.includes('--simulate');
const CONFIRM = args
  .find((a) => a.startsWith('--confirm='))
  ?.slice('--confirm='.length);

/** Quy tắc map trạng thái cũ -> mới (xem plan mục P1). Trạng thái không có trong bảng sẽ bị báo UNMAPPED. */
const VOUCHER_BUCKETS = [
  {
    bucket: 'RECEIPT EXPECTED -> forecast IN OPEN',
    where: `voucher_type = 'RECEIPT' AND payment_status = 'EXPECTED'`,
  },
  {
    bucket: 'RECEIPT PAID -> payment IN',
    where: `voucher_type = 'RECEIPT' AND payment_status = 'PAID'`,
  },
  {
    bucket: 'RECEIPT NULL -> header SETTLED (payment IN nếu có settlement)',
    where: `voucher_type = 'RECEIPT' AND payment_status IS NULL`,
  },
  {
    bucket: 'PAYMENT PAID -> payment OUT',
    where: `voucher_type = 'PAYMENT' AND payment_status = 'PAID'`,
  },
  {
    bucket: 'PAYMENT PENDING -> forecast OUT PENDING_APPROVAL',
    where: `voucher_type = 'PAYMENT' AND payment_status = 'PENDING'`,
  },
  {
    bucket: 'RECEIPT CANCELLED -> forecast IN CANCELLED',
    where: `voucher_type = 'RECEIPT' AND payment_status = 'CANCELLED'`,
  },
];

async function main(): Promise<void> {
  console.log(
    '================================================================',
  );
  console.log(
    APPLY
      ? 'BACKFILL CASHFLOW GARAGE (P3 — GHI DB)'
      : 'DRY-RUN BACKFILL CASHFLOW GARAGE (P1.2)',
  );
  console.log(
    '================================================================',
  );

  const scriptEnv = resolveScriptEnv({ argv: args });
  console.log(
    describeScriptEnv(scriptEnv, { apply: APPLY, allowed: true, message: '' }),
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
    await client.query(
      `SET default_transaction_read_only = ${APPLY || SIMULATE ? 'off' : 'on'}`,
    );
    const { rows: dbRows } = await client.query<{ db: string }>(
      'SELECT current_database() AS db',
    );
    console.log(`Database thực tế: ${dbRows[0].db}`);

    if (APPLY || SIMULATE) {
      if (APPLY && CONFIRM !== dbRows[0].db) {
        throw new ScriptEnvError(
          `--apply cần --confirm=${dbRows[0].db} (khớp đúng tên DB thực tế).`,
        );
      }
      const report = await applyGarageCashflowBackfill(client, {
        commit: !SIMULATE,
      });
      console.log(
        SIMULATE
          ? '\nMÔ PHỎNG (đã ROLLBACK, không ghi):'
          : '\nGhi dữ liệu (đã COMMIT):',
      );
      for (const s of report.steps)
        console.log(`  ${s.step.padEnd(44)} rows=${s.rows}`);
      console.log('\nĐối chiếu sau ghi:');
      for (const c of report.checks)
        console.log(
          `  [${c.ok ? 'OK' : 'LỆCH'}] ${c.label.padEnd(44)} kỳ vọng=${c.expected} thực tế=${c.actual}`,
        );
      console.log(
        `\nChênh lệch settlement so với phiếu (chưa ghi, xử lý ở P1.3): ${report.settlementMismatch}`,
      );
      return;
    }

    console.log('\n1. Phiếu thu/chi cũ theo nhóm map');
    let mapped = 0;
    for (const b of VOUCHER_BUCKETS) {
      const { rows } = await client.query<{ n: string; total: string }>(
        `SELECT count(*)::text AS n, COALESCE(sum(amount), 0)::text AS total
           FROM kgara_cashflow_vouchers WHERE ${b.where}`,
      );
      mapped += Number(rows[0].n);
      console.log(
        `  ${b.bucket.padEnd(52)} n=${rows[0].n.padStart(4)}  tổng=${rows[0].total}`,
      );
    }

    const { rows: totalRows } = await client.query<{ n: string }>(
      'SELECT count(*)::text AS n FROM kgara_cashflow_vouchers',
    );
    const unmapped = Number(totalRows[0].n) - mapped;
    console.log(
      `  Tổng phiếu cũ: ${totalRows[0].n}, đã map: ${mapped}, UNMAPPED: ${unmapped}`,
    );
    if (unmapped !== 0) {
      const { rows } = await client.query<{
        voucher_type: string;
        payment_status: string | null;
        n: string;
      }>(
        `SELECT voucher_type, payment_status, count(*)::text AS n
           FROM kgara_cashflow_vouchers
          WHERE NOT ((voucher_type = 'RECEIPT' AND (payment_status IN ('EXPECTED','PAID','CANCELLED') OR payment_status IS NULL))
                  OR (voucher_type = 'PAYMENT' AND payment_status IN ('PAID','PENDING')))
          GROUP BY 1, 2`,
      );
      console.log('  Trạng thái UNMAPPED:', rows);
    }

    console.log('\n2. Đề nghị mua (PR garage) theo trạng thái');
    const { rows: prRows } = await client.query<{
      status: string;
      ordering_status: string;
      n: string;
    }>(
      `SELECT status, ordering_status, count(*)::text AS n
         FROM erp_garage_proc_requests WHERE is_deleted = false
        GROUP BY 1, 2 ORDER BY 1, 2`,
    );
    for (const r of prRows)
      console.log(
        `  ${r.status.padEnd(12)} ${r.ordering_status.padEnd(8)} n=${r.n}`,
      );

    console.log('\n3. Cấn trừ và liên kết');
    const { rows: settleRows } = await client.query<{
      n: string;
      linked: string;
      orphan: string;
    }>(
      `SELECT count(*)::text AS n,
              count(cashflow_voucher_id)::text AS linked,
              count(*) FILTER (WHERE cashflow_voucher_id IS NULL)::text AS orphan
         FROM kgara_case_settlements`,
    );
    const s = settleRows[0];
    console.log(
      `  Settlement: ${s.n} (có voucher: ${s.linked}, không có voucher: ${s.orphan})`,
    );

    const { rows: poRows } = await client.query<{
      n: string;
      distinct_lines: string;
    }>(
      `SELECT count(*)::text AS n, count(DISTINCT request_line_id)::text AS distinct_lines
         FROM erp_garage_proc_order_lines WHERE request_line_id IS NOT NULL`,
    );
    console.log(
      `  Dòng PO nối dòng PR: ${poRows[0].n} (${poRows[0].distinct_lines} dòng PR khác nhau) — cần repoint sang dòng dự chi`,
    );

    console.log('\nKết quả: chỉ đọc, không ghi DB.');
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  if (error instanceof ScriptEnvError) {
    console.error(`[ENV] ${error.message}`);
  } else {
    console.error(error);
  }
  process.exit(1);
});
