/**
 * Xác minh read-only (plan phần 2, task 2.2): dashboard thu chi mới so với engine cũ trên staging.
 * Chạy: TS_NODE_TRANSPILE_ONLY=true node -r ts-node/register -r tsconfig-paths/register src/v2/modules/cashflow-garage/scripts/verify-legacy-dashboard.ts --target=greenway-staging
 */
import './verify-env';
import dataSource from '../../../../db/data-source';
import { KgaraCashflowVoucher } from '../../../../kgara-api-core/entities/kgara_cashflow_voucher.entity';
import type { GarageCashflowDashboardQueryDto } from '../../../../kgara-api-core/dto/garage-cashflow.dto';
import { GarageCashflowDashboardEngine } from '../../../../kgara-api-core/services/engines/garage-cashflow-dashboard.engine';
import { LegacyVoucherDashboardService } from '../compat/legacy-voucher-dashboard.service';

async function main(): Promise<void> {
  await dataSource.initialize();
  await dataSource.query('SET default_transaction_read_only = on');
  const [{ db }] = await dataSource.query('SELECT current_database() AS db');
  console.log('DB', db);

  const legacy = new GarageCashflowDashboardEngine(
    dataSource.getRepository(KgaraCashflowVoucher),
  );
  const next = new LegacyVoucherDashboardService(dataSource);

  const [pm] = await dataSource.query(
    `SELECT payment_method FROM kgara_cashflow_vouchers WHERE payment_method IS NOT NULL GROUP BY 1 ORDER BY count(*) DESC LIMIT 1`,
  );
  const [pc] = await dataSource.query(
    `SELECT payment_content FROM kgara_cashflow_vouchers WHERE payment_content IS NOT NULL GROUP BY 1 ORDER BY count(*) DESC LIMIT 1`,
  );
  const [br] = await dataSource.query(
    `SELECT b.external_id FROM kgara_branches b JOIN kgara_cases c ON c.branch_external_id = b.external_id GROUP BY 1 ORDER BY count(*) DESC LIMIT 1`,
  );

  const cases: Array<{ name: string; q: GarageCashflowDashboardQueryDto }> = [
    { name: 'không lọc', q: {} },
    { name: 'kỳ 10/2026', q: { dateFrom: '2026-10-01', dateTo: '2026-10-31' } },
    {
      name: `phương thức ${pm?.payment_method}`,
      q: { paymentMethod: pm?.payment_method },
    },
    {
      name: `nội dung ${pc?.payment_content}`,
      q: { paymentContent: pc?.payment_content },
    },
    { name: `chi nhánh ${br?.external_id}`, q: { branchId: br?.external_id } },
    { name: 'ALL', q: { paymentMethod: 'ALL', branchId: 'ALL' } },
  ];

  let mismatch = 0;
  for (const c of cases) {
    const a = await legacy.getDashboardStats(c.q);
    const b = await next.getDashboardStats(c.q);
    const parts = [
      'kpi',
      'methodBreakdown',
      'contentBreakdown',
      'trend',
    ] as const;
    for (const p of parts) {
      if (JSON.stringify(a[p]) !== JSON.stringify(b[p])) {
        mismatch++;
        console.log(`LỆCH ${c.name} / ${p}`);
        console.log('  cũ:', JSON.stringify(a[p]).slice(0, 400));
        console.log('  mới:', JSON.stringify(b[p]).slice(0, 400));
      }
    }
    for (const side of ['in', 'out'] as const) {
      const ia = a.topTransactions[side].map((t) => `${t.id}|${t.amount}`);
      const ib = b.topTransactions[side].map((t) => `${t.id}|${t.amount}`);
      if (JSON.stringify(ia) !== JSON.stringify(ib)) {
        mismatch++;
        console.log(`LỆCH ${c.name} / top ${side} (id|số tiền)`);
        console.log('  cũ:', ia.join(', '));
        console.log('  mới:', ib.join(', '));
      }
      const sa = a.topTransactions[side]
        .map((t) => `${t.id}|${t.paymentStatus}`)
        .join(',');
      const sb = b.topTransactions[side]
        .map((t) => `${t.id}|${t.paymentStatus}`)
        .join(',');
      if (sa !== sb) {
        console.log(
          `(ghi nhận) ${c.name} / top ${side}: khác nhãn trạng thái — dự kiến với phiếu thu NULL → PAID`,
        );
      }
    }
    console.log(
      `so sánh xong: ${c.name} (kpi thu ${b.kpi.totalIn}, chi ${b.kpi.totalOut})`,
    );
  }
  console.log(
    mismatch === 0
      ? 'KẾT QUẢ: khớp (trừ nhãn đã biết)'
      : `KẾT QUẢ: ${mismatch} mục lệch`,
  );
  await dataSource.destroy();
  if (mismatch > 0) process.exit(1);
}

main().catch(async (error: unknown) => {
  console.error('ERR', error instanceof Error ? error.message : error);
  process.exit(1);
});
