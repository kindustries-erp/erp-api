/**
 * Xác minh read-only (plan phần 2, task 2.1): column-options và duplicate-check mới so với engine cũ trên staging.
 * Chạy: TS_NODE_TRANSPILE_ONLY=true node -r ts-node/register -r tsconfig-paths/register src/v2/modules/cashflow-garage/scripts/verify-legacy-options-duplicate.ts --target=greenway-staging
 */
import './verify-env';
import dataSource from '../../../../db/data-source';
import { KgaraCashflowVoucher } from '../../../../kgara-api-core/entities/kgara_cashflow_voucher.entity';
import { GarageCashflowQueryEngine } from '../../../../kgara-api-core/services/engines/garage-cashflow-query.engine';
import { GarageCashflowDuplicateEngine } from '../../../../kgara-api-core/services/engines/garage-cashflow-duplicate.engine';
import { LegacyVoucherOptionsService } from '../compat/legacy-voucher-options.service';
import { LegacyVoucherDuplicateService } from '../compat/legacy-voucher-duplicate.service';

const COLUMNS = [
  'voucherCode',
  'partnerName',
  'licensePlate',
  'paymentMethod',
  'paymentContent',
  'note',
  'caseCode',
  'transDate',
  'thu',
  'chi',
  'paymentStatus',
];
const TABS: Array<string | undefined> = [undefined, 'forecast', 'vouchers'];
const FILTERS = [
  undefined,
  '{"voucherType":["PAYMENT"]}',
  '{"voucherType":["RECEIPT"],"caseCode":["__BLANK__"]}',
];

async function main(): Promise<void> {
  await dataSource.initialize();
  await dataSource.query('SET default_transaction_read_only = on');
  const [{ db }] = await dataSource.query('SELECT current_database() AS db');
  console.log('DB', db);

  const repo = dataSource.getRepository(KgaraCashflowVoucher);
  const legacyQuery = new GarageCashflowQueryEngine(repo);
  const legacyDup = new GarageCashflowDuplicateEngine(repo);
  const newOptions = new LegacyVoucherOptionsService(dataSource);
  const newDup = new LegacyVoucherDuplicateService(dataSource);

  let mismatch = 0;
  let checked = 0;
  let nonEmpty = 0;
  for (const column of COLUMNS) {
    for (const tab of TABS) {
      for (const filter of FILTERS) {
        const a = await legacyQuery.getColumnOptions(
          column,
          '',
          1,
          1000,
          filter,
          tab,
        );
        const b = await newOptions.getColumnOptions(
          column,
          '',
          1,
          1000,
          filter,
          tab,
        );
        checked++;
        if (a.items.length > 0) nonEmpty++;
        const same =
          JSON.stringify(a.items) === JSON.stringify(b.items) &&
          a.total === b.total;
        if (!same) {
          mismatch++;
          console.log(
            `LỆCH options ${column} tab=${tab} filter=${filter}: cũ=${a.total} mới=${b.total}`,
          );
        }
      }
    }
  }
  // Tìm kiếm: thử một từ khóa phổ biến trên vài cột.
  for (const column of ['caseCode', 'paymentMethod', 'partnerName']) {
    const a = await legacyQuery.getColumnOptions(
      column,
      'a',
      1,
      1000,
      undefined,
      undefined,
    );
    const b = await newOptions.getColumnOptions(
      column,
      'a',
      1,
      1000,
      undefined,
      undefined,
    );
    checked++;
    if (
      JSON.stringify(a.items) !== JSON.stringify(b.items) ||
      a.total !== b.total
    ) {
      mismatch++;
      console.log(`LỆCH tìm kiếm ${column}: cũ=${a.total} mới=${b.total}`);
    }
  }
  console.log(
    `column-options: đã so ${checked} tổ hợp, có dữ liệu thật ${nonEmpty}`,
  );

  // Duplicate-check: lấy mẫu phiếu cũ thật.
  const samples: Array<{
    id: string;
    amount: string;
    trans_date: string;
    case_id: string | null;
    license_plate: string | null;
  }> = await dataSource.query(`
      SELECT id, amount, trans_date::text AS trans_date, case_id, license_plate
      FROM kgara_cashflow_vouchers v
      WHERE v.amount IN (SELECT amount FROM kgara_cashflow_vouchers GROUP BY amount HAVING count(*) > 1)
      ORDER BY random() LIMIT 40`);
  let dupChecked = 0;
  let dupHits = 0;
  for (const s of samples) {
    const q = {
      amount: Number(s.amount),
      transDate: s.trans_date,
      caseId: s.case_id ?? undefined,
      licensePlate: s.license_plate ?? undefined,
      excludeId: s.id,
    };
    const a = await legacyDup.findPotentialDuplicates(q);
    const b = await newDup.findPotentialDuplicates(q);
    dupChecked++;
    dupHits += [a.nearbyDate, a.sameCase, a.samePlate].filter(
      (g) => g.total > 0,
    ).length;
    for (const group of ['nearbyDate', 'sameCase', 'samePlate'] as const) {
      const ta = a[group].total;
      const tb = b[group].total;
      const ia = a[group].items
        .map((i) => i.id)
        .sort()
        .join(',');
      const ib = b[group].items
        .map((i) => i.id)
        .sort()
        .join(',');
      if (ta !== tb || ia !== ib) {
        mismatch++;
        console.log(`LỆCH trùng ${group} phiếu ${s.id}: cũ=${ta} mới=${tb}`);
      }
    }
  }
  console.log(
    `duplicate-check: đã so ${dupChecked} phiếu mẫu, nhóm có phiếu trùng ${dupHits}`,
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
