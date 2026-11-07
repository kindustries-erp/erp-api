/**
 * Xác minh read-only: liên kết giao dịch ngân hàng của phiếu cũ so với cashflow_payments.
 * Chạy: node -r ts-node/register -r tsconfig-paths/register src/v2/modules/cashflow-garage/scripts/verify-bank-link.ts --target=greenway-staging
 */
import './verify-env';
import dataSource from '../../../../db/data-source';
import { LegacyVoucherListService } from '../compat/legacy-voucher-list.service';

async function main(): Promise<void> {
  await dataSource.initialize();
  await dataSource.query('SET default_transaction_read_only = on');
  const [{ db }] = await dataSource.query('SELECT current_database() AS db');
  console.log('DB', db);

  const [legacy] = await dataSource.query(`
    SELECT count(*)::int AS total,
      count(erp_bank_transaction_id)::int AS linked
    FROM kgara_cashflow_vouchers`);
  const [payments] = await dataSource.query(`
    SELECT count(*)::int AS total,
      count(bank_transaction_id)::int AS linked
    FROM cashflow_payments`);
  const [cmp] = await dataSource.query(`
    SELECT
      count(*) FILTER (WHERE v.erp_bank_transaction_id IS NOT NULL AND p.id IS NULL)::int AS link_missing_payment,
      count(*) FILTER (WHERE v.erp_bank_transaction_id IS NOT NULL AND p.id IS NOT NULL
        AND p.bank_transaction_id IS DISTINCT FROM v.erp_bank_transaction_id)::int AS link_differs,
      count(*) FILTER (WHERE v.erp_bank_transaction_id IS NULL AND p.bank_transaction_id IS NOT NULL)::int AS payment_only_link
    FROM kgara_cashflow_vouchers v
    LEFT JOIN cashflow_payments p ON p.code = 'PM-' || v.voucher_code`);
  const [fk] = await dataSource.query(`
    SELECT count(*)::int AS n FROM pg_constraint
    WHERE conrelid = 'cashflow_payments'::regclass AND contype = 'f'
      AND pg_get_constraintdef(oid) ILIKE '%bank_transaction%'`);

  const [orphan] = await dataSource.query(`
    SELECT count(*)::int AS n FROM cashflow_payments p
    WHERE p.bank_transaction_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM erp_bank_transactions t WHERE t.id = p.bank_transaction_id)`);

  console.log('legacy vouchers:', legacy);
  console.log('cashflow_payments:', payments);
  console.log('so sánh:', cmp);
  console.log('FK bank_transaction trên cashflow_payments:', fk);
  console.log('link trỏ tới giao dịch không tồn tại:', orphan);
  // Response tương thích phải trả đúng link của phiếu cũ, cho mọi phiếu.
  const legacyLinks: Array<{
    voucher_code: string;
    erp_bank_transaction_id: string | null;
  }> = await dataSource.query(`
      SELECT voucher_code, erp_bank_transaction_id
      FROM kgara_cashflow_vouchers
      WHERE erp_bank_transaction_id IS NOT NULL`);
  const svc = new LegacyVoucherListService(dataSource);
  const all = await svc.list({ tab: 'all', page: 1, pageSize: 1000 });
  const byCode = new Map(all.data.map((r) => [r.voucherCode, r]));
  let responseMismatch = 0;
  let responseWithBank = 0;
  for (const row of legacyLinks) {
    const got = byCode.get(row.voucher_code);
    if (
      !got ||
      got.erpBankTransactionId !== row.erp_bank_transaction_id ||
      got.erpBankTransaction?.id !== row.erp_bank_transaction_id
    ) {
      responseMismatch++;
    } else {
      responseWithBank++;
    }
  }
  const withBankInResponse = all.data.filter(
    (r) => r.erpBankTransaction,
  ).length;
  console.log(
    `phản hồi tương thích: ${responseWithBank}/${legacyLinks.length} phiếu có link đúng, số phiếu có erpBankTransaction = ${withBankInResponse}`,
  );
  if (withBankInResponse !== legacyLinks.length) responseMismatch++;

  const bad =
    responseMismatch +
    cmp.link_missing_payment +
    cmp.link_differs +
    cmp.payment_only_link +
    orphan.n;
  console.log(bad === 0 ? 'KẾT QUẢ: khớp' : `KẾT QUẢ: ${bad} mục lệch`);
  await dataSource.destroy();
}

main().catch(async (error: unknown) => {
  console.error('ERR', error instanceof Error ? error.message : error);
  process.exit(1);
});
