/**
 * Xác minh read-only (plan phần 2, task 2.4): dữ liệu kỳ, sổ quỹ và bảng kê dự thu/dự chi theo phiếu dịch vụ
 * so với hub/báo cáo cũ trên staging. P&L theo tháng không nằm trong script này (task 2.5).
 * Chạy: TS_NODE_TRANSPILE_ONLY=true node -r ts-node/register -r tsconfig-paths/register src/v2/modules/cashflow-garage/scripts/verify-legacy-period.ts --target=greenway-staging
 */
import './verify-env';
import dataSource from '../../../../db/data-source';
import { KgaraCashflowVoucher } from '../../../../kgara-api-core/entities/kgara_cashflow_voucher.entity';
import { loadPeriodVoucherRows } from '../../../../kgara-api-core/helpers/garage-period-voucher-rows.helper';
import { GaragePeriodLedgerHandler } from '../../../../kgara-api-core/hub/handlers/garage-period-ledger.handler';
import { GarageCaseLedgerHandler } from '../../../../kgara-api-core/hub/handlers/garage-case-ledger.handler';
import { LegacyVoucherPeriodService } from '../compat/legacy-voucher-period.service';

async function main(): Promise<void> {
  await dataSource.initialize();
  await dataSource.query('SET default_transaction_read_only = on');
  const [{ db }] = await dataSource.query('SELECT current_database() AS db');
  console.log('DB', db);

  const repo = dataSource.getRepository(KgaraCashflowVoucher);
  const legacyLedger = new GaragePeriodLedgerHandler(repo);
  const legacyCase = new GarageCaseLedgerHandler(repo);
  const next = new LegacyVoucherPeriodService(dataSource);

  const [br] = await dataSource.query(
    `SELECT b.external_id FROM kgara_branches b JOIN kgara_cases c ON c.branch_external_id = b.external_id GROUP BY 1 ORDER BY count(*) DESC LIMIT 1`,
  );
  const periods: Array<{
    name: string;
    from?: string;
    to?: string;
    branch?: string;
  }> = [
    { name: 'không lọc' },
    { name: 'tháng 10/2026', from: '2026-10-01', to: '2026-10-31' },
    { name: 'quý 4/2026', from: '2026-10-01', to: '2026-12-31' },
    { name: `chi nhánh ${br?.external_id}`, branch: br?.external_id },
  ];

  let mismatch = 0;
  for (const p of periods) {
    const a = await legacyLedger.loadLedger(p.from, p.to, p.branch);
    const b = await next.loadLedger(p.from, p.to, p.branch);
    const ta = JSON.stringify(a.totals);
    const tb = JSON.stringify(b.totals);
    const codesA = a.vouchers
      .map((v) => v.voucherCode)
      .sort()
      .join(',');
    const codesB = b.vouchers
      .map((v) => v.voucherCode)
      .sort()
      .join(',');
    if (ta !== tb || codesA !== codesB) {
      mismatch++;
      console.log(`LỆCH sổ quỹ ${p.name}`);
      console.log('  cũ:', ta, a.vouchers.length, 'dòng');
      console.log('  mới:', tb, b.vouchers.length, 'dòng');
    } else {
      console.log(`OK sổ quỹ ${p.name}: ${b.vouchers.length} dòng, ${tb}`);
    }

    const rowsA = await loadPeriodVoucherRows(repo, p.from, p.to, p.branch);
    const rowsB = await next.loadVouchers(p.from, p.to, p.branch);
    const sumA = rowsA.reduce((s, r) => s + r.amount, 0);
    const sumB = rowsB.reduce((s, r) => s + r.amount, 0);
    const setA = rowsA
      .map((r) => r.voucherCode)
      .sort()
      .join(',');
    const setB = rowsB
      .map((r) => r.voucherCode)
      .sort()
      .join(',');
    if (rowsA.length !== rowsB.length || sumA !== sumB || setA !== setB) {
      mismatch++;
      console.log(
        `LỆCH dòng kỳ ${p.name}: cũ=${rowsA.length}/${sumA} mới=${rowsB.length}/${sumB}`,
      );
    }
  }

  // Bảng kê dự thu/dự chi theo phiếu dịch vụ: lấy mẫu các phiếu dịch vụ có phiếu.
  const caseRows: Array<{ case_id: string }> = await dataSource.query(
    `SELECT DISTINCT case_id FROM kgara_cashflow_vouchers WHERE case_id IS NOT NULL LIMIT 300`,
  );
  const caseIds = caseRows.map((r) => r.case_id);
  const ca = await legacyCase.loadCaseLedger(caseIds);
  const cb = await next.loadCaseLedger(caseIds);
  const keysA = Object.keys(ca).sort();
  const keysB = Object.keys(cb).sort();
  let caseDiff = 0;
  for (const k of new Set([...keysA, ...keysB])) {
    const x = ca[k] ?? { expectedIn: 0, plannedOut: 0 };
    const y = cb[k] ?? { expectedIn: 0, plannedOut: 0 };
    if (x.expectedIn !== y.expectedIn || x.plannedOut !== y.plannedOut)
      caseDiff++;
  }
  if (caseDiff > 0) mismatch++;
  console.log(
    `bảng kê theo phiếu dịch vụ: ${caseIds.length} phiếu, có số ${keysA.length}, lệch ${caseDiff}`,
  );

  console.log(
    mismatch === 0 ? 'KẾT QUẢ: khớp' : `KẾT QUẢ: ${mismatch} mục lệch`,
  );
  await dataSource.destroy();
  if (mismatch > 0) process.exit(1);
}

main().catch(async (error: unknown) => {
  console.error('ERR', error instanceof Error ? error.message : error);
  process.exit(1);
});
