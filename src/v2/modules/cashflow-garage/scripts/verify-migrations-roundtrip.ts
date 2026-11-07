/**
 * Kiểm tra down -> up của hai migration cashflow trong MỘT transaction rồi ROLLBACK.
 * Không để lại thay đổi nào trên DB. Không dùng cho production.
 * Chạy: TS_NODE_TRANSPILE_ONLY=true node -r ts-node/register -r tsconfig-paths/register src/v2/modules/cashflow-garage/scripts/verify-migrations-roundtrip.ts --target=greenway-staging
 */
import './verify-env';
import dataSource from '../../../../db/data-source';
import { CreateCashflowCoreTables20261107120000 } from '../../../../migrations/20261107120000-create-cashflow-core-tables';
import { AddLegacyLabelsToCashflowGarageExt20261108090000 } from '../../../../migrations/20261108090000-add-legacy-labels-to-cashflow-garage-ext';

const TABLES = [
  'cashflow_forecasts',
  'cashflow_forecast_lines',
  'cashflow_payment_requests',
  'cashflow_payment_request_lines',
  'cashflow_payments',
  'cashflow_allocations',
  'cashflow_garage_forecast_ext',
  'cashflow_garage_payment_ext',
];

async function tableNames(qr: {
  query: (sql: string) => Promise<unknown>;
}): Promise<string[]> {
  const rows = (await qr.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name LIKE 'cashflow\\_%'`)) as Array<{
    table_name: string;
  }>;
  return rows.map((r) => r.table_name).sort();
}

async function legacyLabelColumns(qr: {
  query: (sql: string) => Promise<unknown>;
}): Promise<string[]> {
  const rows = (await qr.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'cashflow_garage_forecast_ext'
      AND column_name IN ('legacy_created_by', 'legacy_payment_method')
    ORDER BY column_name`)) as Array<{ column_name: string }>;
  return rows.map((r) => r.column_name);
}

async function counts(qr: {
  query: (sql: string) => Promise<unknown>;
}): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  for (const t of [
    'kgara_cashflow_vouchers',
    'cashflow_forecasts',
    'cashflow_payments',
    'cashflow_allocations',
  ]) {
    const [row] = (await qr.query(
      `SELECT count(*)::int AS n FROM ${t}`,
    )) as Array<{ n: number }>;
    result[t] = row.n;
  }
  return result;
}

async function main(): Promise<void> {
  await dataSource.initialize();
  const [{ db }] = await dataSource.query('SELECT current_database() AS db');
  console.log('DB', db);

  const qr = dataSource.createQueryRunner();
  await qr.connect();
  const before = {
    tables: await tableNames(qr),
    labels: await legacyLabelColumns(qr),
    counts: await counts(qr),
  };
  console.log('trước:', JSON.stringify(before));

  const core = new CreateCashflowCoreTables20261107120000();
  const labels = new AddLegacyLabelsToCashflowGarageExt20261108090000();
  let ok = false;
  await qr.startTransaction();
  try {
    await labels.down(qr);
    await core.down(qr);
    console.log('sau down: bảng cashflow còn', (await tableNames(qr)).length);
    await core.up(qr);
    await labels.up(qr);
    const after = {
      tables: await tableNames(qr),
      labels: await legacyLabelColumns(qr),
    };
    console.log('sau up: bảng', after.tables.length, 'cột nhãn', after.labels);
    const missing = TABLES.filter((t) => !after.tables.includes(t));
    ok = missing.length === 0 && after.labels.length === 2;
    console.log(
      missing.length
        ? `THIẾU bảng: ${missing.join(', ')}`
        : 'đủ 8 bảng cashflow',
    );
  } catch (error) {
    console.error(
      'LỖI trong transaction:',
      error instanceof Error ? error.message : error,
    );
  } finally {
    await qr.rollbackTransaction();
    console.log('đã ROLLBACK');
  }

  const restored = {
    tables: await tableNames(qr),
    labels: await legacyLabelColumns(qr),
    counts: await counts(qr),
  };
  await qr.release();
  console.log('sau rollback:', JSON.stringify(restored));
  const same = JSON.stringify(before) === JSON.stringify(restored);
  console.log(
    same
      ? 'DB khôi phục đúng trạng thái ban đầu'
      : 'CẢNH BÁO: trạng thái sau rollback khác trước',
  );
  console.log(
    ok && same
      ? 'KẾT QUẢ: down->up sạch, không để lại thay đổi'
      : 'KẾT QUẢ: có lỗi, xem log',
  );
  await dataSource.destroy();
  if (!(ok && same)) process.exit(1);
}

main().catch(async (error: unknown) => {
  console.error('ERR', error instanceof Error ? error.message : error);
  process.exit(1);
});
