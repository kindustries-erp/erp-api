/**
 * backfill-cashflow-vouchers-garage.ts
 *
 * Nạp bù phiếu thu chi V1 (`kgara_cashflow_vouchers`) còn thiếu hoặc lệch ở v2 (`cashflow_vouchers_garage`).
 * Mặc định DRY-RUN trong transaction READ ONLY: in số phiếu thiếu theo loại/trạng thái, phiếu lệch theo trường,
 * phiếu trùng mã (không nạp được) và phiếu chỉ có ở v2 (chỉ báo, không đụng).
 * `--apply` gọi `LegacyProjectorService.projectVoucher` cho từng phiếu thiếu hoặc lệch (idempotent, mỗi phiếu
 * một transaction). Lệnh này cũng dựng lại sổ nợ và phân bổ LEGACY của vụ việc liên quan.
 * DB production cần thêm `--confirm=<tên DB>`; chỉ `--apply` sau khi chủ hệ thống đồng ý.
 *
 * Env tường minh (load-script-env.ts), ví dụ:
 *   bun .../backfill-cashflow-vouchers-garage.ts --target=greenway-staging
 *   bun .../backfill-cashflow-vouchers-garage.ts --target=greenway-production --apply --confirm=erp_greenway_production
 * Tham số: `--limit=<n>` chỉ áp tối đa n phiếu (mặc định tất cả), `--dry-run`.
 */

import type { DataSource } from 'typeorm';
import {
  getWriteGuard,
  resolveScriptEnv,
} from '../../../../common/scripts/load-script-env';
import { GarageDebtLedgerProjector } from '../../debts-garage/services/garage-debt-ledger.projector';
import { GarageDebtOriginService } from '../../debts-garage/services/garage-debt-origin.service';
import { GarageDebtSettlementService } from '../../debts-garage/services/garage-debt-settlement.service';
import { LegacyAllocationSyncService } from '../legacy/legacy-allocation-sync.service';
import { LegacyProjectorService } from '../legacy/legacy-projector.service';

type Row = Record<string, string | null>;

const argv = process.argv.slice(2);

/** Cột so khớp: [tên báo cáo, biểu thức V1, cột v2]. Cùng cách chiếu của `LegacyProjectorService`. */
const COMPARED: Array<[string, string, string]> = [
  ['status', "COALESCE(o.payment_status, 'PAID')", 'n.status'],
  ['voucher_type', 'o.voucher_type', 'n.voucher_type'],
  ['amount', 'o.amount', 'n.amount'],
  ['trans_date', 'o.trans_date', 'n.trans_date'],
  ['case_id', 'o.case_id', 'n.case_id'],
  ['license_plate', 'o.license_plate', 'n.license_plate'],
  ['payment_method', 'o.payment_method', 'n.payment_method'],
  ['payment_content', 'o.payment_content', 'n.payment_content'],
  ['partner_name', 'o.partner_name', 'n.partner_name'],
  ['note', 'o.note', 'n.note'],
];

const DIFF_FIELDS_SQL = `array_remove(ARRAY[${COMPARED.map(
  ([name, v1, v2]) =>
    `CASE WHEN ${v1} IS DISTINCT FROM ${v2} THEN '${name}' END`,
).join(', ')}], NULL)`;

const JOINED = `kgara_cashflow_vouchers o LEFT JOIN cashflow_vouchers_garage n ON n.id = o.id`;

/** Mã phiếu đã thuộc một phiếu v2 khác id: cột mã là duy nhất nên không nạp được. */
const CODE_CONFLICT = `EXISTS (SELECT 1 FROM cashflow_vouchers_garage x WHERE x.voucher_code = o.voucher_code AND x.id <> o.id)`;

const MISSING_SQL = `
SELECT o.voucher_type AS loai, COALESCE(o.payment_status, '(trống)') AS trang_thai,
       COUNT(*) AS so_phieu, COUNT(*) FILTER (WHERE o.case_id IS NULL) AS khong_vu_viec,
       SUM(o.amount) AS tong_tien
FROM ${JOINED}
WHERE n.id IS NULL
GROUP BY 1, 2 ORDER BY 1, 2`;

const DIFF_SUMMARY_SQL = `
SELECT field AS truong, COUNT(*) AS so_phieu
FROM (SELECT unnest(${DIFF_FIELDS_SQL}) AS field FROM ${JOINED} WHERE n.id IS NOT NULL) d
GROUP BY 1 ORDER BY 2 DESC, 1`;

const CONFLICT_SQL = `
SELECT o.voucher_code AS ma_phieu FROM ${JOINED}
WHERE n.id IS NULL AND ${CODE_CONFLICT} ORDER BY 1`;

const ORPHAN_SQL = `
SELECT n.status AS trang_thai, n.source AS nguon, COUNT(*) AS so_phieu
FROM cashflow_vouchers_garage n
LEFT JOIN kgara_cashflow_vouchers o ON o.id = n.id
WHERE o.id IS NULL AND n.is_deleted = false
GROUP BY 1, 2 ORDER BY 1, 2`;

const TARGETS_SQL = `
SELECT o.id::text AS id, o.voucher_code AS code FROM ${JOINED}
WHERE (n.id IS NULL AND NOT ${CODE_CONFLICT})
   OR (n.id IS NOT NULL AND cardinality(${DIFF_FIELDS_SQL}) > 0)
ORDER BY o.created_at, o.id`;

function section(title: string, rows: Row[]): void {
  console.log(`\n=== ${title} ===`);
  if (rows.length) console.table(rows);
  else console.log('(không có)');
}

/** Mọi truy vấn báo cáo chạy trong transaction READ ONLY rồi ROLLBACK. */
async function report(ds: DataSource): Promise<Row[]> {
  const qr = ds.createQueryRunner();
  await qr.connect();
  try {
    await qr.query('BEGIN TRANSACTION READ ONLY');
    const query = (sql: string) => qr.query(sql) as Promise<Row[]>;
    const [{ db }] = await query('SELECT current_database() AS db');
    console.log(`current_database() = ${db}`);
    section('Phiếu V1 chưa có ở v2', await query(MISSING_SQL));
    section('Phiếu có ở cả hai nhưng lệch', await query(DIFF_SUMMARY_SQL));
    section('Không nạp được vì trùng mã', await query(CONFLICT_SQL));
    section('Chỉ có ở v2 (không đụng)', await query(ORPHAN_SQL));
    return await query(TARGETS_SQL);
  } finally {
    await qr.query('ROLLBACK').catch(() => undefined);
    await qr.release();
  }
}

async function main(): Promise<number> {
  const scriptEnv = resolveScriptEnv({ argv });
  if (!scriptEnv.explicit) {
    throw new Error(
      'Chỉ định file env tường minh: .env.<tenant>-<stage> | --env=<file> | --target=<tenant>-<stage>',
    );
  }
  const guard = getWriteGuard(scriptEnv, argv);
  console.log(`ENV : ${scriptEnv.envSource}`);
  console.log(
    `DB  : ${scriptEnv.dbLabel}${scriptEnv.isProduction ? ' [PRODUCTION]' : ''}`,
  );
  console.log(`MODE: ${guard.message}\n`);

  // Nạp sau khi env đã được resolve, để DataSource đọc đúng DATABASE_URL.
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- nạp sau khi env đã resolve
  const ds: DataSource = require('../../../../db/data-source').default;
  await ds.initialize();
  try {
    const targets = await report(ds);
    console.log(`\nCần chiếu sang v2: ${targets.length} phiếu`);
    if (!guard.allowed) {
      console.log('DRY-RUN: không có thay đổi nào được ghi.');
      return 0;
    }

    const limitArg = argv.find((a) => a.startsWith('--limit='));
    const limit = limitArg ? Number(limitArg.slice(8)) : targets.length;
    if (!Number.isInteger(limit) || limit < 0) {
      throw new Error('--limit phải là số nguyên không âm');
    }
    const projector = new LegacyProjectorService(
      ds,
      new LegacyAllocationSyncService(
        new GarageDebtLedgerProjector(new GarageDebtOriginService()),
        new GarageDebtSettlementService(),
      ),
    );
    const failed: Row[] = [];
    const batch = targets.slice(0, limit);
    for (const target of batch) {
      try {
        await projector.projectVoucher(String(target.id));
      } catch (err) {
        failed.push({
          ma_phieu: target.code,
          loi: err instanceof Error ? err.message : String(err),
        });
      }
    }
    console.log(
      `\nĐã chiếu ${batch.length - failed.length}/${batch.length} phiếu.`,
    );
    section('Phiếu lỗi', failed);
    console.log('\n--- Đối chiếu lại sau khi ghi ---');
    await report(ds);
    return failed.length > 0 ? 1 : 0;
  } finally {
    await ds.destroy();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(2);
  });
