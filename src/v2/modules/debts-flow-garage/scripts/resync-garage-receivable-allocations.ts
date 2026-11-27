/**
 * resync-garage-receivable-allocations.ts
 *
 * Đưa phân bổ LEGACY của các vụ việc lệch phải thu (sổ nợ v2 khác `kgara_cases.tien_con_phai_thanh_toan`)
 * về đúng bộ settlement V1 hiện có, bằng `LegacyAllocationSyncService.syncCase`.
 *
 * Mặc định DRY-RUN (một transaction rồi ROLLBACK). `--apply` mới COMMIT; DB production cần thêm
 * `--confirm=<tên DB>`. Chỉ `--apply` sau khi anh OK. Env tường minh (load-script-env.ts), ví dụ:
 *   bun .../resync-garage-receivable-allocations.ts --target=greenway-production --apply --confirm=erp_greenway_production
 * Tham số: `--cases=<so_chung_tu,...>`, `--from=YYYY-MM-DD` (mặc định 2026-07-01),
 *   `--all` (mọi vụ có sổ nợ phải thu, để kiểm hồi quy; bảng chỉ in vụ đổi số hoặc còn lệch), `--dry-run`.
 */

import type { DataSource } from 'typeorm';
import {
  getWriteGuard,
  resolveScriptEnv,
} from '../../../../common/scripts/load-script-env';
import { LegacyAllocationSyncService } from '../legacy/legacy-allocation-sync.service';
import { GarageDebtLedgerProjector } from '../../debts-garage/services/garage-debt-ledger.projector';
import { GarageDebtOriginService } from '../../debts-garage/services/garage-debt-origin.service';
import { GarageDebtSettlementService } from '../../debts-garage/services/garage-debt-settlement.service';

type Row = Record<string, string | number | null>;

const argv = process.argv.slice(2);

function argValue(name: string): string | undefined {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

/** Vụ lệch: Σ dòng phải thu trong sổ nợ khác cột V1 đã lưu. Cùng mốc và điều kiện với lớp đọc. */
const MISMATCH_SQL = `
WITH led AS (
  SELECT d.case_id::text AS case_id, SUM(d.balance_amount) AS bal
  FROM debts_garage d
  WHERE d.is_deleted = false AND d.status <> 'VOID' AND d.excluded = false
    AND d.direction = 'RECEIVABLE' AND d.due_base_date >= $1
  GROUP BY d.case_id
)
SELECT c.id::text AS id, c.so_chung_tu AS code,
       COALESCE(c.tien_con_phai_thanh_toan, 0)::numeric AS legacy,
       l.bal::numeric AS ledger
FROM led l
JOIN kgara_cases c ON c.id::text = l.case_id
WHERE ($3::boolean OR COALESCE(c.tien_con_phai_thanh_toan, 0) <> l.bal)
  AND ($2::text IS NULL OR c.so_chung_tu = ANY (string_to_array($2, ',')))
ORDER BY c.so_chung_tu`;

async function balanceOf(
  query: (sql: string, params: unknown[]) => Promise<Row[]>,
  caseId: string,
): Promise<number> {
  const [row] = await query(
    `SELECT COALESCE(SUM(balance_amount), 0) AS s FROM debts_garage
     WHERE case_id::text = $1 AND is_deleted = false AND status <> 'VOID'
       AND excluded = false AND direction = 'RECEIVABLE'`,
    [caseId],
  );
  return Number(row.s);
}

async function liveLegacyAllocations(
  query: (sql: string, params: unknown[]) => Promise<Row[]>,
  caseId: string,
): Promise<number> {
  const [row] = await query(
    `SELECT COUNT(*) AS n FROM debt_allocations_garage a
     JOIN debts_garage d ON d.id = a.debt_id
     WHERE d.case_id::text = $1 AND a.origin = 'LEGACY' AND a.reversed_at IS NULL`,
    [caseId],
  );
  return Number(row.n);
}

const fmt = (n: number) =>
  n.toLocaleString('en-US', { maximumFractionDigits: 2 });

async function main(): Promise<void> {
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

  const from = argValue('from') ?? '2026-07-01';
  const cases = argValue('cases') ?? null;
  const qr = ds.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();
  try {
    const m = qr.manager;
    const query = (sql: string, params: unknown[]): Promise<Row[]> =>
      m.query(sql, params) as Promise<Row[]>;
    const [{ db }] = await query('SELECT current_database() AS db', []);
    console.log(`current_database() = ${db}`);

    const all = argv.includes('--all');
    const targets = await query(MISMATCH_SQL, [from, cases, all]);
    console.log(
      `Vụ cần xử lý${all ? ' (--all)' : ' (lệch)'}: ${targets.length}\n`,
    );
    const sync = new LegacyAllocationSyncService(
      new GarageDebtLedgerProjector(new GarageDebtOriginService()),
      new GarageDebtSettlementService(),
    );
    const report: Row[] = [];
    for (const t of targets) {
      const caseId = String(t.id);
      const beforeBal = await balanceOf(query, caseId);
      const beforeLive = await liveLegacyAllocations(query, caseId);
      await sync.syncCase(m, caseId);
      const afterBal = await balanceOf(query, caseId);
      const afterLive = await liveLegacyAllocations(query, caseId);
      report.push({
        vu: t.code,
        v1_con_thu: Number(t.legacy),
        so_du_truoc: beforeBal,
        so_du_sau: afterBal,
        phan_bo_truoc: beforeLive,
        phan_bo_sau: afterLive,
      });
    }

    const shown = report.filter(
      (r) => r.so_du_truoc !== r.so_du_sau || r.so_du_sau !== r.v1_con_thu,
    );
    const stillOff = report.filter((r) => r.so_du_sau !== r.v1_con_thu);
    console.table(
      shown.map((r) => ({
        Vụ: r.vu,
        'V1 còn thu': fmt(Number(r.v1_con_thu)),
        'Sổ nợ trước': fmt(Number(r.so_du_truoc)),
        'Sổ nợ sau': fmt(Number(r.so_du_sau)),
        'PB LEGACY trước': r.phan_bo_truoc,
        'PB LEGACY sau': r.phan_bo_sau,
      })),
    );
    const sumBefore = report.reduce((s, r) => s + Number(r.so_du_truoc), 0);
    const sumAfter = report.reduce((s, r) => s + Number(r.so_du_sau), 0);
    const sumV1 = report.reduce((s, r) => s + Number(r.v1_con_thu), 0);
    console.log(
      `Tổng: V1 ${fmt(sumV1)} | sổ nợ trước ${fmt(sumBefore)} | sổ nợ sau ${fmt(sumAfter)}`,
    );
    console.log(`Còn lệch sau sync: ${stillOff.length} vụ`);

    if (guard.allowed) {
      await qr.commitTransaction();
      console.log('\nCOMMITTED: đã ghi DB.');
    } else {
      await qr.rollbackTransaction();
      console.log('\nROLLED_BACK: dry-run, không có thay đổi nào được ghi.');
    }
  } catch (err) {
    if (qr.isTransactionActive) await qr.rollbackTransaction();
    throw err;
  } finally {
    await qr.release();
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
