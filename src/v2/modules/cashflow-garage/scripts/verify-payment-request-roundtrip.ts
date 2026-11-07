/**
 * Kiểm tra up -> down -> up của các migration DNTT / dấu đóng PR / quyền DNTT
 * trong MỘT transaction, rồi ROLLBACK. Không để lại thay đổi nào trên DB.
 * Chạy: TS_NODE_TRANSPILE_ONLY=true node -r ts-node/register -r tsconfig-paths/register src/v2/modules/cashflow-garage/scripts/verify-payment-request-roundtrip.ts --target=greenway-staging
 */
import './verify-env';
import dataSource from '../../../../db/data-source';
import { GeneralizeCashflowPaymentRequests20261108110000 } from '../../../../migrations/20261108110000-generalize-cashflow-payment-requests';
import { AddCloseFieldsToCashflowGarageExt20261108120000 } from '../../../../migrations/20261108120000-add-close-fields-to-cashflow-garage-ext';
import { SeedGaragePaymentRequestPermissions20261108130000 } from '../../../../migrations/20261108130000-seed-garage-payment-request-permissions';

type Qr = {
  query: (sql: string, params?: unknown[]) => Promise<unknown>;
};

interface Migration {
  name: string;
  up(qr: never): Promise<void>;
  down(qr: never): Promise<void>;
}

/** Ảnh chụp schema/dữ liệu liên quan, so sánh trước và sau. */
async function snapshot(qr: Qr): Promise<Record<string, string>> {
  const cols = (await qr.query(`
    SELECT table_name || '.' || column_name || ':' || is_nullable AS k
      FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name IN ('cashflow_payment_requests','cashflow_payment_request_lines','cashflow_garage_forecast_ext')
     ORDER BY 1`)) as Array<{ k: string }>;
  const checks = (await qr.query(`
    SELECT conname AS k, pg_get_constraintdef(oid) AS def
      FROM pg_constraint
     WHERE conname IN ('ck_cashflow_payment_requests_status','ck_cashflow_payment_request_lines_ref')
     ORDER BY 1`)) as Array<{ k: string; def: string }>;
  const tables = (await qr.query(`
    SELECT count(*)::int AS n FROM information_schema.tables
     WHERE table_schema = current_schema()
       AND table_name = 'cashflow_payment_request_line_payments'`)) as Array<{
    n: number;
  }>;
  const statuses = (await qr.query(`
    SELECT f.status || ':' || count(*) AS k
      FROM cashflow_forecasts f
     WHERE f.source_type = 'LEGACY_PR'
     GROUP BY f.status ORDER BY 1`)) as Array<{ k: string }>;
  const perms = (await qr.query(`
    SELECT count(*)::int AS n FROM core_permissions
     WHERE resource = 'garage_payment_requests'`)) as Array<{ n: number }>;
  const out: Record<string, string> = {
    columns: cols.map((c) => c.k).join(','),
    line_payments_table: String(tables[0].n),
    pr_statuses: statuses.map((s) => s.k).join(','),
    payment_request_permissions: String(perms[0].n),
  };
  for (const c of checks) out[c.k] = c.def;
  return out;
}

async function roundtrip(
  runner: { query: Qr['query'] },
  migration: Migration,
): Promise<string> {
  const qr = runner as unknown as Qr;
  const up = migration.up.bind(migration) as (q: unknown) => Promise<void>;
  const down = migration.down.bind(migration) as (q: unknown) => Promise<void>;
  const same = (a: Record<string, string>, b: Record<string, string>) =>
    JSON.stringify(a) === JSON.stringify(b);

  const before = await snapshot(qr);
  await up(runner);
  const afterUp = await snapshot(qr);
  await down(runner);
  const afterDown = await snapshot(qr);
  await up(runner);
  const afterReUp = await snapshot(qr);

  const lines = [
    `${migration.name}`,
    `  up đổi schema/dữ liệu: ${same(before, afterUp) ? 'KHÔNG (lỗi)' : 'CÓ'}`,
    `  down về trạng thái ban đầu: ${same(before, afterDown) ? 'OK' : 'LỆCH'}`,
    `  up lần 2 khớp up lần 1: ${same(afterUp, afterReUp) ? 'OK' : 'LỆCH'}`,
  ];
  return lines.join('\n');
}

async function main(): Promise<void> {
  await dataSource.initialize();
  const runner = dataSource.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();
  try {
    const [{ db }] = (await runner.query(
      'SELECT current_database() AS db',
    )) as Array<{ db: string }>;
    console.log('DB', db);

    const migrations: Migration[] = [
      new GeneralizeCashflowPaymentRequests20261108110000() as unknown as Migration,
      new AddCloseFieldsToCashflowGarageExt20261108120000() as unknown as Migration,
      new SeedGaragePaymentRequestPermissions20261108130000() as unknown as Migration,
    ];
    for (const m of migrations) {
      console.log(await roundtrip(runner, m));
    }
    console.log('KẾT QUẢ: đã ROLLBACK, DB không đổi');
  } finally {
    await runner.rollbackTransaction();
    await runner.release();
    await dataSource.destroy();
  }
}

main().catch(async (error: unknown) => {
  console.error('ERR', error instanceof Error ? error.message : error);
  process.exit(1);
});
