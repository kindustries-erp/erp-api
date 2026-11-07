/**
 * Xác minh read-only (plan phần 2, task 2.6): công nợ phiếu dịch vụ theo cách cũ
 * (kgara_case_settlements) và cách mới (cashflow_allocations + cùng quy tắc shouldHaveSettlement)
 * có khớp không. Không ghi gì. Chạy:
 * TS_NODE_TRANSPILE_ONLY=true node -r ts-node/register -r tsconfig-paths/register src/v2/modules/cashflow-garage/scripts/verify-case-debt-parity.ts --target=greenway-staging
 */
import './verify-env';
import dataSource from '../../../../db/data-source';
import { shouldHaveSettlement } from '../../../../kgara-api-core/helpers/garage-cashflow-payment-rules';
import { toLegacyPaymentStatus } from '../compat/legacy-voucher.mapper';
import { voucherTypeOf } from '../compat/legacy-voucher-write.mapper';

interface LegacySettlement {
  case_id: string;
  settlement_type: string;
  amount: string;
  cashflow_voucher_id: string | null;
}

interface NewAllocation {
  case_id: string;
  code: string;
  direction: 'IN' | 'OUT';
  status: string;
  payment_content: string | null;
  debt_counted: boolean;
  amount: string;
}

async function main(): Promise<void> {
  await dataSource.initialize();
  await dataSource.query('SET default_transaction_read_only = on');
  const [{ db }] = await dataSource.query('SELECT current_database() AS db');
  console.log('DB', db);

  const legacyRows: LegacySettlement[] = await dataSource.query(`
    SELECT case_id::text AS case_id, settlement_type, amount::text AS amount,
           cashflow_voucher_id::text AS cashflow_voucher_id
      FROM kgara_case_settlements
     WHERE case_id IS NOT NULL`);

  const newRows: NewAllocation[] = await dataSource.query(`
    SELECT e.case_id::text AS case_id, f.code, f.direction, f.status,
           e.payment_content, e.debt_counted, al.amount::text AS amount
      FROM cashflow_allocations al
      JOIN cashflow_payments p ON p.id = al.payment_id
      JOIN cashflow_forecasts f ON f.id = al.forecast_id
      JOIN cashflow_garage_forecast_ext e ON e.forecast_id = f.id
     WHERE e.case_id IS NOT NULL
       AND p.status = 'POSTED' AND p.is_deleted = false AND f.is_deleted = false`);

  const caseRows: Array<{ id: string; raw_paid: string }> =
    await dataSource.query(`
    SELECT id::text AS id, COALESCE((raw_data->>'TienDaThanhToan')::numeric, 0)::text AS raw_paid
      FROM kgara_cases`);
  const rawPaidByCase = new Map(
    caseRows.map((r) => [r.id, Number(r.raw_paid)]),
  );

  const legacyByCase = new Map<string, { n: number; receipts: number }>();
  for (const r of legacyRows) {
    const entry = legacyByCase.get(r.case_id) ?? { n: 0, receipts: 0 };
    entry.n++;
    if (r.settlement_type === 'RECEIPT') entry.receipts += Number(r.amount);
    legacyByCase.set(r.case_id, entry);
  }

  const newByCase = new Map<
    string,
    { n: number; receipts: number; rows: NewAllocation[] }
  >();
  for (const r of newRows) {
    const direction = r.direction;
    const legacyStatus = toLegacyPaymentStatus(direction, r.status);
    const qualifies = shouldHaveSettlement({
      voucherType: voucherTypeOf(direction),
      paymentStatus: legacyStatus,
      paymentContent: r.payment_content,
    });
    if (!qualifies || !r.debt_counted) continue;
    const entry = newByCase.get(r.case_id) ?? {
      n: 0,
      receipts: 0,
      rows: [],
    };
    entry.n++;
    if (direction === 'IN') entry.receipts += Number(r.amount);
    entry.rows.push(r);
    newByCase.set(r.case_id, entry);
  }

  const caseIds = new Set([...legacyByCase.keys(), ...newByCase.keys()]);
  let mismatch = 0;
  const mismatchedCases: string[] = [];
  for (const caseId of caseIds) {
    const legacy = legacyByCase.get(caseId) ?? { n: 0, receipts: 0 };
    const next = newByCase.get(caseId) ?? { n: 0, receipts: 0, rows: [] };
    const raw = rawPaidByCase.get(caseId) ?? 0;
    const legacyPaid = legacy.n > 0 ? legacy.receipts : raw;
    const newPaid = next.n > 0 ? next.receipts : raw;
    if (legacyPaid !== newPaid) {
      mismatch++;
      mismatchedCases.push(caseId);
      if (mismatch <= 20) {
        const codes = next.rows
          .map((r) => `${r.code}(${r.direction},${r.status},${r.amount})`)
          .join(' ');
        console.log(
          `LỆCH case ${caseId}: cũ=${legacyPaid} (settlements=${legacy.n}) mới=${newPaid} (allocations=${next.n}) ${codes}`,
        );
      }
    }
  }

  if (mismatchedCases.length > 0) {
    const legacyVouchers = await dataSource.query(
      `SELECT v.voucher_code, v.voucher_type, v.payment_status, v.amount::text AS amount,
              v.case_id::text AS case_id, v.trans_date::text AS trans_date,
              (SELECT count(*)::int FROM kgara_case_settlements s WHERE s.cashflow_voucher_id = v.id) AS settle_by_voucher
         FROM kgara_cashflow_vouchers v
        WHERE v.case_id::text = ANY($1)`,
      [mismatchedCases],
    );
    console.log('Phiếu cũ của case lệch:', JSON.stringify(legacyVouchers));
  }
  console.log(`Số phiếu dịch vụ kiểm tra: ${caseIds.size}`);
  console.log(
    mismatch === 0
      ? 'KẾT QUẢ: công nợ khớp 100%'
      : `KẾT QUẢ: ${mismatch} phiếu dịch vụ lệch, chưa được cắt`,
  );
  await dataSource.destroy();
  if (mismatch > 0) process.exit(1);
}

main().catch(async (error: unknown) => {
  console.error('ERR', error instanceof Error ? error.message : error);
  process.exit(1);
});
