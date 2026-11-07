/**
 * Đo read-only (quy tắc B): phiếu thu trạng thái NULL và phần ảnh hưởng công nợ phiếu dịch vụ.
 * Chạy: TS_NODE_TRANSPILE_ONLY=true node -r ts-node/register -r tsconfig-paths/register src/v2/modules/cashflow-garage/scripts/measure-null-receipts.ts --target=greenway-staging
 */
import './verify-env';
import dataSource from '../../../../db/data-source';

async function main(): Promise<void> {
  await dataSource.initialize();
  await dataSource.query('SET default_transaction_read_only = on');
  const [{ db }] = await dataSource.query('SELECT current_database() AS db');
  console.log('DB', db);

  const [all] = await dataSource.query(`
    SELECT count(*)::int AS n, COALESCE(sum(amount), 0)::text AS total
      FROM kgara_cashflow_vouchers
     WHERE voucher_type = 'RECEIPT' AND payment_status IS NULL`);
  const [linked] = await dataSource.query(`
    SELECT count(*)::int AS n, COALESCE(sum(amount), 0)::text AS total,
           count(DISTINCT case_id)::int AS cases
      FROM kgara_cashflow_vouchers
     WHERE voucher_type = 'RECEIPT' AND payment_status IS NULL AND case_id IS NOT NULL`);
  const [linkedWithSettle] = await dataSource.query(`
    SELECT count(*)::int AS n, COALESCE(sum(v.amount), 0)::text AS total
      FROM kgara_cashflow_vouchers v
     WHERE v.voucher_type = 'RECEIPT' AND v.payment_status IS NULL AND v.case_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM kgara_case_settlements s WHERE s.cashflow_voucher_id = v.id)`);
  const perCase = await dataSource.query(`
    SELECT v.case_id::text AS case_id, sum(v.amount)::text AS total, count(*)::int AS n
      FROM kgara_cashflow_vouchers v
     WHERE v.voucher_type = 'RECEIPT' AND v.payment_status IS NULL AND v.case_id IS NOT NULL
     GROUP BY v.case_id
     ORDER BY sum(v.amount) DESC
     LIMIT 10`);

  console.log('Phiếu thu NULL (tất cả):', JSON.stringify(all));
  console.log('Phiếu thu NULL gắn phiếu dịch vụ:', JSON.stringify(linked));
  console.log(
    '… trong đó đã có settlement ở bản cũ:',
    JSON.stringify(linkedWithSettle),
  );
  console.log(
    '10 phiếu dịch vụ có tổng NULL lớn nhất:',
    JSON.stringify(perCase),
  );
  await dataSource.destroy();
}

main().catch(async (error: unknown) => {
  console.error('ERR', error instanceof Error ? error.message : error);
  process.exit(1);
});
