/**
 * reconcile-garage-debts-ledger.ts — CHỈ ĐỌC.
 *
 * Đối soát công nợ garage theo từng vụ việc giữa V1 (`/greenway`), v2 (`/api/v2/debts-garage`)
 * và sổ nợ `debts_garage`: phải thu (còn phải thu) và phải trả (chi phí, đã chi, còn phải trả).
 * Chạy trong transaction READ ONLY rồi ROLLBACK. In `MISMATCH <n>`; exit code 1 khi n > 0.
 *
 * Env tường minh (load-script-env.ts), ví dụ:
 *   bun .../reconcile-garage-debts-ledger.ts --target=greenway-production
 * Tham số: `--from=YYYY-MM-DD` (mặc định mốc công nợ 2026-07-01), `--limit=<n>` số dòng lệch in ra (mặc định 50).
 */

import type { DataSource } from 'typeorm';
import { resolveScriptEnv } from '../../../../common/scripts/load-script-env';
import { GARAGE_DEBT_BASELINE_DATE } from '../../debts-garage/helpers/garage-debt-sql.helper';
import {
  reconcileRows,
  type ReconcileResult,
  type ReconcileRow,
} from '../helpers/garage-debts-reconcile.compare';
import {
  PAYABLE_RECONCILE_SQL,
  RECEIVABLE_RECONCILE_SQL,
} from '../helpers/garage-debts-reconcile.sql';

const argv = process.argv.slice(2);
const argValue = (name: string): string | undefined =>
  argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

const fmt = (n: number) =>
  n.toLocaleString('en-US', { maximumFractionDigits: 2 });

function printSection(
  title: string,
  result: ReconcileResult,
  limit: number,
): void {
  console.log(`\n=== ${title} ===`);
  console.table(
    Object.entries(result.totals).map(([field, t]) => ({
      'Chỉ tiêu': field,
      V1: fmt(t.v1),
      v2: fmt(t.v2),
      'Sổ nợ': fmt(t.led),
    })),
  );
  console.log(`Lệch: ${result.mismatches.length} (vụ × chỉ tiêu)`);
  if (result.mismatches.length) {
    console.table(
      result.mismatches.slice(0, limit).map((m) => ({
        Vụ: m.code ?? m.caseId,
        'Chỉ tiêu': m.field,
        V1: fmt(m.values.v1),
        v2: fmt(m.values.v2),
        'Sổ nợ': fmt(m.values.led),
      })),
    );
  }
}

async function main(): Promise<number> {
  const scriptEnv = resolveScriptEnv({ argv });
  if (!scriptEnv.explicit) {
    throw new Error(
      'Chỉ định file env tường minh: .env.<tenant>-<stage> | --env=<file> | --target=<tenant>-<stage>',
    );
  }
  console.log(`ENV : ${scriptEnv.envSource}`);
  console.log(
    `DB  : ${scriptEnv.dbLabel}${scriptEnv.isProduction ? ' [PRODUCTION]' : ''}`,
  );
  console.log('MODE: READ ONLY');

  // Nạp sau khi env đã được resolve, để DataSource đọc đúng DATABASE_URL.
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- nạp sau khi env đã resolve
  const ds: DataSource = require('../../../../db/data-source').default;
  await ds.initialize();
  const from = argValue('from') ?? GARAGE_DEBT_BASELINE_DATE;
  const limit = Number(argValue('limit') ?? 50);
  const qr = ds.createQueryRunner();
  await qr.connect();
  try {
    await qr.query('BEGIN TRANSACTION READ ONLY');
    const [{ db }] = (await qr.query('SELECT current_database() AS db')) as {
      db: string;
    }[];
    console.log(`current_database() = ${db} | từ ${from}`);

    const recv = reconcileRows(
      (await qr.query(RECEIVABLE_RECONCILE_SQL, [from])) as ReconcileRow[],
      ['bal'],
    );
    const pay = reconcileRows(
      (await qr.query(PAYABLE_RECONCILE_SQL, [from])) as ReconcileRow[],
      ['cost', 'paid', 'bal'],
    );
    printSection('PHẢI THU (bal = còn phải thu)', recv, limit);
    printSection(
      'PHẢI TRẢ (cost, paid = đã chi, bal = còn phải trả)',
      pay,
      limit,
    );

    const total = recv.mismatches.length + pay.mismatches.length;
    console.log(`\nMISMATCH ${total}`);
    return total;
  } finally {
    await qr.query('ROLLBACK').catch(() => undefined);
    await qr.release();
    await ds.destroy();
  }
}

main()
  .then((n) => process.exit(n > 0 ? 1 : 0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(2);
  });
