/**
 * Xác minh read-only (plan phần 2, bước 1.4): branch_id của cashflow có trỏ tới erp_branches không.
 * Chạy: TS_NODE_TRANSPILE_ONLY=true node -r ts-node/register -r tsconfig-paths/register src/v2/modules/cashflow-garage/scripts/verify-branch-ref.ts --target=greenway-staging
 */
import './verify-env';
import dataSource from '../../../../db/data-source';

async function main(): Promise<void> {
  await dataSource.initialize();
  await dataSource.query('SET default_transaction_read_only = on');
  const [{ db }] = await dataSource.query('SELECT current_database() AS db');
  console.log('DB', db);

  const [row] = await dataSource.query(`
    SELECT
      count(*) FILTER (WHERE f.branch_id IS NOT NULL)::int AS forecasts_with_branch,
      count(*) FILTER (WHERE f.branch_id IS NOT NULL AND b.id IS NULL)::int AS forecasts_orphan_branch
    FROM cashflow_forecasts f
    LEFT JOIN erp_branches b ON b.id = f.branch_id`);
  const [pay] = await dataSource.query(`
    SELECT
      count(*) FILTER (WHERE p.branch_id IS NOT NULL)::int AS payments_with_branch,
      count(*) FILTER (WHERE p.branch_id IS NOT NULL AND b.id IS NULL)::int AS payments_orphan_branch
    FROM cashflow_payments p
    LEFT JOIN erp_branches b ON b.id = p.branch_id`);

  console.log('dự thu/dự chi:', row);
  console.log('thực thu/chi:', pay);
  const orphans = row.forecasts_orphan_branch + pay.payments_orphan_branch;
  console.log(
    orphans === 0
      ? 'KẾT QUẢ: không có branch mồ côi'
      : `KẾT QUẢ: ${orphans} dòng mồ côi`,
  );
  await dataSource.destroy();
}

main().catch(async (error: unknown) => {
  console.error('ERR', error instanceof Error ? error.message : error);
  process.exit(1);
});
