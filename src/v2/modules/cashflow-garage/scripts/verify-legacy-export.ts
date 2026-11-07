/**
 * Xác minh read-only (plan phần 2, task 2.3): tập dòng export mới so với export cũ trên staging.
 * So sánh danh sách dòng đã lọc (số lượng, tổng số tiền và chuỗi mã theo thứ tự). Không dựng file Excel.
 * Chạy: TS_NODE_TRANSPILE_ONLY=true node -r ts-node/register -r tsconfig-paths/register src/v2/modules/cashflow-garage/scripts/verify-legacy-export.ts --target=greenway-staging
 */
import './verify-env';
import dataSource from '../../../../db/data-source';
import { KgaraCashflowVoucher } from '../../../../kgara-api-core/entities/kgara_cashflow_voucher.entity';
import { GarageCashflowExportService } from '../../../../kgara-api-core/services/garage-cashflow-export.service';
import { GarageCashflowExcelBuilder } from '../../../../kgara-api-core/services/garage-cashflow-excel.builder';
import type { GarageCashflowExportDto } from '../../../../kgara-api-core/dto/garage-cashflow-export.dto';
import { LegacyVoucherExportService } from '../compat/legacy-voucher-export.service';

type Dto = Partial<GarageCashflowExportDto>;

async function legacyRows(
  svc: GarageCashflowExportService,
  dto: Dto,
): Promise<KgaraCashflowVoucher[]> {
  const repo = dataSource.getRepository(KgaraCashflowVoucher);
  const qb = repo.createQueryBuilder('voucher');
  qb.leftJoinAndSelect('voucher.case', 'case');
  qb.leftJoinAndSelect('voucher.erpBankTransaction', 'bankTx');
  // Gọi hàm lọc riêng của bản cũ để so đúng logic.
  (
    svc as unknown as { applyFilters: (q: unknown, d: Dto) => void }
  ).applyFilters(qb, dto);
  return qb.getMany();
}

async function main(): Promise<void> {
  await dataSource.initialize();
  await dataSource.query('SET default_transaction_read_only = on');
  const [{ db }] = await dataSource.query('SELECT current_database() AS db');
  console.log('DB', db);

  const legacy = new GarageCashflowExportService(
    dataSource.getRepository(KgaraCashflowVoucher),
    new GarageCashflowExcelBuilder(),
  );
  const next = new LegacyVoucherExportService(
    dataSource,
    new GarageCashflowExcelBuilder(),
  );

  const [pm] = await dataSource.query(
    `SELECT payment_method FROM kgara_cashflow_vouchers WHERE payment_method IS NOT NULL GROUP BY 1 ORDER BY count(*) DESC LIMIT 1`,
  );

  const cases: Array<{ name: string; dto: Dto; knownDiff?: boolean }> = [
    { name: 'không lọc', dto: {} },
    {
      name: 'theo tháng 2026-10',
      dto: { mode: 'by-period', periodType: 'month', period: '2026-10' },
    },
    {
      name: 'theo quý 2026-Q4',
      dto: { mode: 'by-period', periodType: 'quarter', quarter: '2026-Q4' },
    },
    {
      name: 'kỳ + chỉ chi',
      dto: {
        mode: 'by-period',
        dateFrom: '2026-01-01',
        dateTo: '2026-12-31',
        voucherType: 'PAYMENT',
      },
    },
    {
      name: `kỳ + phương thức ${pm?.payment_method}`,
      dto: {
        mode: 'by-period',
        dateFrom: '2026-01-01',
        dateTo: '2026-12-31',
        paymentMethod: pm?.payment_method,
      },
    },
    {
      name: 'kỳ + trạng thái PAID',
      dto: {
        mode: 'by-period',
        dateFrom: '2026-01-01',
        dateTo: '2026-12-31',
        paymentStatus: 'PAID',
      },
      knownDiff: true,
    },
    {
      name: 'cột: chỉ chi',
      dto: { column_filters: '{"voucherType":["PAYMENT"]}' },
    },
    { name: 'tìm kiếm q=DC', dto: { q: 'DC' } },
    { name: 'tìm kiếm cột mã', dto: { column_search: '{"voucherCode":"DC"}' } },
    { name: 'sắp xếp -thu', dto: { sorts: ['-thu'] } },
  ];

  let mismatch = 0;
  for (const c of cases) {
    const a = await legacyRows(legacy, c.dto);
    const b = await next.loadRows(c.dto as GarageCashflowExportDto);
    const codesA = a.map((r) => r.voucherCode);
    const codesB = b.map((r) => r.voucherCode);
    const sumA = a.reduce((s, r) => s + Number(r.amount || 0), 0);
    const sumB = b.reduce((s, r) => s + Number(r.amount || 0), 0);
    // Dòng cùng ngày (hoặc cùng số tiền khi sắp theo tiền) có thể đổi chỗ giữa hai bên,
    // nên so: tập mã, tổng, và chuỗi khóa sắp xếp. Không so thứ tự mã.
    const sortKey = (rows: Array<{ amount: unknown; transDate: unknown }>) =>
      rows
        .map((r) =>
          c.dto.sorts ? String(Number(r.amount)) : String(r.transDate),
        )
        .join(',');
    const sameSet =
      [...codesA].sort().join(',') === [...codesB].sort().join(',');
    const same =
      codesA.length === codesB.length &&
      sumA === sumB &&
      sameSet &&
      sortKey(a) === sortKey(b);
    if (!same) {
      console.log('  khóa cũ (đầu):', sortKey(a).slice(0, 120));
      console.log('  khóa mới (đầu):', sortKey(b).slice(0, 120));
      if (c.knownDiff) {
        console.log(
          `(đã biết) ${c.name}: cũ=${codesA.length} mới=${codesB.length} (phiếu thu NULL → PAID)`,
        );
      } else {
        mismatch++;
        console.log(
          `LỆCH ${c.name}: cũ=${codesA.length} dòng, mới=${codesB.length} dòng, tổng cũ=${sumA} mới=${sumB}`,
        );
      }
    } else {
      console.log(`OK ${c.name}: ${codesB.length} dòng, tổng ${sumB}`);
    }
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
