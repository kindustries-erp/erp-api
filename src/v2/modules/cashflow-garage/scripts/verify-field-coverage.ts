/**
 * Xác minh read-only (plan phần 2, bước 1.2): cột của bảng cũ kgara_cashflow_vouchers đã có chỗ trong bảng mới chưa.
 * Chạy: TS_NODE_TRANSPILE_ONLY=true node -r ts-node/register -r tsconfig-paths/register src/v2/modules/cashflow-garage/scripts/verify-field-coverage.ts --target=greenway-staging
 */
import './verify-env';
import dataSource from '../../../../db/data-source';

/** Ánh xạ cột cũ -> nơi chứa ở mô hình mới. null = chưa có chỗ chứa (cần quyết định). */
const MAPPING: Record<string, string | null> = {
  id: 'cashflow_forecasts.id',
  voucher_code: 'cashflow_forecasts.code',
  voucher_type: 'cashflow_forecasts.direction',
  amount: 'cashflow_forecasts.amount',
  trans_date:
    'cashflow_forecasts.planned_date / cashflow_payments.payment_date',
  case_id: 'cashflow_garage_forecast_ext.case_id',
  license_plate: 'cashflow_garage_forecast_ext.license_plate',
  payment_method:
    'cashflow_garage_forecast_ext.legacy_payment_method / cashflow_payments.channel',
  payment_content: 'cashflow_garage_forecast_ext.payment_content',
  payment_status: 'cashflow_forecasts.status',
  note: 'cashflow_forecasts.note',
  created_by: 'cashflow_forecasts.created_by / legacy_created_by',
  created_at: 'cashflow_forecasts.created_at',
  updated_at: 'cashflow_forecasts.updated_at',
  is_deleted: 'cashflow_forecasts.is_deleted',
  erp_bank_transaction_id: 'cashflow_payments.bank_transaction_id',
  erp_cash_voucher_id: null,
  partner_name: 'cashflow_forecasts.partner_name',
  partner_phone: null,
  reference_number: null,
  is_auto_expected: 'cashflow_garage_forecast_ext.is_auto_expected',
  is_auto_commission: 'cashflow_garage_forecast_ext.is_auto_commission',
  pnl_period_year: 'cashflow_garage_forecast_ext.pnl_period_year',
  pnl_period_month: 'cashflow_garage_forecast_ext.pnl_period_month',
  pnl_commission_type: 'cashflow_garage_forecast_ext.pnl_commission_type',
  pnl_commission_anchor_id:
    'cashflow_garage_forecast_ext.pnl_commission_anchor_id',
};

async function main(): Promise<void> {
  await dataSource.initialize();
  await dataSource.query('SET default_transaction_read_only = on');
  const [{ db }] = await dataSource.query('SELECT current_database() AS db');
  console.log('DB', db);

  const rows: Array<{ column_name: string }> = await dataSource.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'kgara_cashflow_vouchers'
    ORDER BY ordinal_position`);
  const legacy = rows.map((r) => r.column_name);
  const unmapped = legacy.filter((c) => !(c in MAPPING));
  const gaps = legacy.filter((c) => MAPPING[c] === null);

  console.log(`cột bảng cũ: ${legacy.length}`);
  console.log(
    'chưa có trong bảng ánh xạ:',
    unmapped.length ? unmapped : 'không',
  );
  console.log(
    'chưa có chỗ chứa (cần quyết định):',
    gaps.length ? gaps : 'không',
  );
  console.log(
    unmapped.length === 0
      ? 'KẾT QUẢ: đã phủ hết cột'
      : 'KẾT QUẢ: còn cột chưa ánh xạ',
  );
  await dataSource.destroy();
}

main().catch(async (error: unknown) => {
  console.error('ERR', error instanceof Error ? error.message : error);
  process.exit(1);
});
