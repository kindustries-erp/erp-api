/**
 * Xác minh read-only: danh sách tương thích (LegacyVoucherListService) so với SQL trên bảng cũ.
 * Chạy: node -r ts-node/register -r tsconfig-paths/register src/v2/modules/cashflow-garage/scripts/verify-legacy-list.ts --target=greenway-staging
 */
import './verify-env';
import dataSource from '../../../../db/data-source';
import { LegacyVoucherListService } from '../compat/legacy-voucher-list.service';

const LEGACY = {
  all: 'TRUE',
  forecast:
    "((voucher_type='RECEIPT' AND payment_status='EXPECTED') OR (voucher_type='PAYMENT' AND payment_status IN ('PENDING','APPROVED')))",
  vouchers:
    "((voucher_type='RECEIPT' AND (payment_status IS NULL OR payment_status NOT IN ('EXPECTED','CANCELLED'))) OR (voucher_type='PAYMENT' AND (payment_status IS NULL OR payment_status='PAID')))",
};

interface LegacyTotals {
  n: number;
  thu: number;
  chi: number;
}

async function legacyTotals(where: string): Promise<LegacyTotals> {
  const [row] = await dataSource.query(
    `SELECT count(*)::int n,
        COALESCE(SUM(CASE WHEN voucher_type='RECEIPT' THEN amount ELSE 0 END),0)::float8 thu,
        COALESCE(SUM(CASE WHEN voucher_type='PAYMENT' THEN amount ELSE 0 END),0)::float8 chi
       FROM kgara_cashflow_vouchers WHERE ${where}`,
  );
  return row as LegacyTotals;
}

async function main(): Promise<void> {
  await dataSource.initialize();
  await dataSource.query('SET default_transaction_read_only = on');
  const [{ db }] = await dataSource.query('SELECT current_database() AS db');
  console.log('DB', db);
  const svc = new LegacyVoucherListService(dataSource);

  const cases = [
    { name: 'tất cả', q: { tab: 'all' as const }, legacy: LEGACY.all },
    {
      name: 'dự kiến',
      q: { tab: 'forecast' as const },
      legacy: LEGACY.forecast,
    },
    {
      name: 'thực tế',
      q: { tab: 'vouchers' as const },
      legacy: LEGACY.vouchers,
    },
    {
      name: 'chỉ thu',
      q: { tab: 'all' as const, voucher_type: 'RECEIPT' as const },
      legacy: "voucher_type='RECEIPT'",
    },
    {
      name: 'khoảng ngày 10/2026',
      q: {
        tab: 'all' as const,
        date_from: '2026-10-01',
        date_to: '2026-10-31',
      },
      legacy: "trans_date BETWEEN '2026-10-01' AND '2026-10-31'",
    },
    {
      name: 'lọc cột: PAYMENT',
      q: {
        tab: 'all' as const,
        column_filters: '{"voucherType":["PAYMENT"]}',
      },
      legacy: "voucher_type='PAYMENT'",
    },
    {
      name: 'lọc cột: PAID',
      q: {
        tab: 'all' as const,
        column_filters: '{"paymentStatus":["PAID"]}',
      },
      // Phiếu thu có payment_status NULL hiển thị PAID (chênh lệch đã biết, đã báo anh).
      legacy:
        "(payment_status='PAID' OR (voucher_type='RECEIPT' AND payment_status IS NULL))",
    },
    {
      name: 'lọc cột: APPROVED',
      q: {
        tab: 'all' as const,
        column_filters: '{"paymentStatus":["APPROVED"]}',
      },
      legacy: "voucher_type='PAYMENT' AND payment_status='APPROVED'",
    },
    {
      name: 'tìm mã DC',
      q: {
        tab: 'all' as const,
        column_search: '{"voucherCode":"DC"}',
      },
      legacy: "voucher_code ILIKE '%DC%'",
    },
  ];

  let fail = 0;
  for (const c of cases) {
    const got = await svc.list({ ...c.q, page: 1, pageSize: 20 });
    const leg = await legacyTotals(c.legacy);
    const ok =
      got.total === leg.n &&
      Math.abs(got.totals!.grandTotalThu - leg.thu) < 0.01 &&
      Math.abs(got.totals!.grandTotalChi - leg.chi) < 0.01;
    if (!ok) fail++;
    console.log(
      `${ok ? 'OK ' : 'LỆCH'} ${c.name.padEnd(20)} mới n=${got.total} thu=${got.totals!.grandTotalThu} chi=${got.totals!.grandTotalChi} | cũ n=${leg.n} thu=${leg.thu} chi=${leg.chi}`,
    );
  }

  const all = await svc.list({ tab: 'all', page: 1, pageSize: 50 });
  const p2 = await svc.list({ tab: 'all', page: 2, pageSize: 50 });
  const recvSum = (rows: Array<{ voucherType: string; amount: number }>) =>
    rows
      .filter((r) => r.voucherType === 'RECEIPT')
      .reduce((s, r) => s + r.amount, 0);
  const cumOk =
    Math.abs(
      p2.totals!.cumulativeThu - (recvSum(all.data) + recvSum(p2.data)),
    ) < 0.01;
  if (!cumOk) fail++;
  console.log(
    `${cumOk ? 'OK ' : 'LỆCH'} lũy kế trang 2 (thu): ${p2.totals!.cumulativeThu}`,
  );

  const sorted = await svc.list({
    tab: 'all',
    sorts: '-amount',
    page: 1,
    pageSize: 50,
  });
  const amounts = sorted.data.map((r) => r.amount);
  const sortOk = amounts.every((a, i) => i === 0 || amounts[i - 1] >= a);
  if (!sortOk) fail++;
  console.log(`${sortOk ? 'OK ' : 'LỆCH'} sắp xếp -amount (trang 1)`);

  const sample = (await svc.list({ tab: 'all', page: 1, pageSize: 1 })).data[0];
  console.log(
    'mẫu:',
    JSON.stringify({
      voucherCode: sample.voucherCode,
      voucherType: sample.voucherType,
      paymentStatus: sample.paymentStatus,
      paymentMethod: sample.paymentMethod,
      createdBy: sample.createdBy,
      case: sample.case ? 'có' : null,
      erpBankTransaction: sample.erpBankTransaction,
    }),
  );
  console.log(fail === 0 ? 'KẾT QUẢ: khớp' : `KẾT QUẢ: ${fail} mục lệch`);
  await dataSource.destroy();
}

main().catch(async (error: unknown) => {
  console.error('ERR', error instanceof Error ? error.message : error);
  process.exit(1);
});
