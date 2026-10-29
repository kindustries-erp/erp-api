/**
 * classify-q1-2026.ts
 *
 * Backfill Phân loại & Mục đích dòng tiền (cashflow_classification / cashflow_purpose)
 * cho sao kê Q1/2026 (01/01–31/03, giờ Việt Nam) bằng bộ quy tắc
 * `utils/cashflow-rule-classifier.ts`.
 *
 * Chỉ ghi vào dòng đang NULL cả hai cột; không đụng description / note.
 * Dòng không khớp quy tắc được giữ NULL và liệt kê trong báo cáo để kế toán duyệt tay.
 *
 * Env: theo loader chuẩn (src/common/scripts/load-script-env.ts), KHÔNG có file mặc định:
 *   <.env.xxx> (tham số vị trí) | --env=<file> | --target=<tenant>-<stage> | ENV_FILE | .env
 * Mặc định là DRY-RUN. Ghi DB cần --apply; DB production cần thêm --confirm=<tên DB>.
 *
 * Cách chạy (trong thư mục erp-api):
 *   bun src/bank-transactions-core/scripts/classify-q1-2026.ts .env.greenway-production --report=/tmp/q1.csv
 *   bun src/bank-transactions-core/scripts/classify-q1-2026.ts .env.greenway-production --apply --confirm=erp_greenway_production
 *   Tham số: [--report=<file.csv>] [--apply] [--confirm=<db>]
 */

import { writeFileSync } from 'fs';
import { Client } from 'pg';
import {
  describeScriptEnv,
  getWriteGuard,
  resolveScriptEnv,
  ScriptEnvError,
} from '../../common/scripts/load-script-env';
import {
  CashflowClassification,
  CashflowPurpose,
  isPurposeAllowed,
} from '../constants/cashflow-attributes.constants';
import { classifyCashflowByRule } from '../utils/cashflow-rule-classifier';

const args = process.argv.slice(2);
const reportArg = args.find((a) => a.startsWith('--report='));
const reportPath = reportArg ? reportArg.slice('--report='.length) : null;

const PERIOD_START = '2026-01-01';
const PERIOD_END = '2026-03-31';

interface TxnRow {
  id: string;
  trans_date: string;
  is_in: boolean;
  amount: string;
  correspondent_name: string | null;
  description: string | null;
  current_classification: string | null;
  current_purpose: string | null;
}

interface Planned {
  row: TxnRow;
  classification: CashflowClassification | null;
  purpose: CashflowPurpose | null;
  reason: string;
}

const csvCell = (value: string | number | null | undefined): string => {
  const text = value === null || value === undefined ? '' : `${value}`;
  return `"${text.replace(/"/g, '""')}"`;
};

const formatMoney = (value: number): string =>
  value.toLocaleString('en-US', { maximumFractionDigits: 0 });

async function main() {
  console.log(
    '================================================================',
  );
  console.log('BACKFILL PHÂN LOẠI DÒNG TIỀN SAO KÊ Q1/2026');
  console.log(
    '================================================================',
  );

  const scriptEnv = resolveScriptEnv({ argv: args });
  const guard = getWriteGuard(scriptEnv, args);
  console.log(describeScriptEnv(scriptEnv, guard));
  if (!scriptEnv.explicit && scriptEnv.isProduction) {
    throw new ScriptEnvError(
      `Env mặc định đang trỏ DB production (${scriptEnv.dbLabel}). Hãy chỉ định env tường minh.`,
    );
  }
  if (guard.apply && !guard.allowed) throw new ScriptEnvError(guard.message);

  const client = new Client({
    connectionString: scriptEnv.databaseUrl,
    ssl: scriptEnv.ssl,
  });
  await client.connect();

  try {
    const { rows: dbRows } = await client.query<{ db: string }>(
      'SELECT current_database() AS db',
    );
    console.log(`Database thực tế: ${dbRows[0].db}`);

    const { rows } = await client.query<TxnRow>(
      `SELECT id,
              to_char(trans_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD HH24:MI') AS trans_date,
              (credit_amount > 0) AS is_in,
              (debit_amount + credit_amount)::text AS amount,
              correspondent_name,
              description,
              cashflow_classification AS current_classification,
              cashflow_purpose AS current_purpose
         FROM erp_bank_transactions
        WHERE is_deleted = false
          AND (trans_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
              BETWEEN $1::date AND $2::date
        ORDER BY trans_date`,
      [PERIOD_START, PERIOD_END],
    );

    const planned: Planned[] = rows.map((row) => {
      const match = classifyCashflowByRule({
        isIn: row.is_in,
        correspondentName: row.correspondent_name,
        description: row.description,
      });
      if (!match) {
        return {
          row,
          classification: null,
          purpose: null,
          reason: 'KHÔNG KHỚP',
        };
      }
      if (!isPurposeAllowed(match.classification, match.purpose)) {
        throw new Error(
          `Quy tắc sinh cặp không hợp lệ: ${match.classification}/${match.purpose} (${row.id})`,
        );
      }
      return {
        row,
        classification: match.classification,
        purpose: match.purpose,
        reason: match.reason,
      };
    });

    const alreadySet = planned.filter(
      (p) =>
        p.row.current_classification !== null || p.row.current_purpose !== null,
    );
    const writable = planned.filter(
      (p) =>
        p.classification !== null &&
        p.row.current_classification === null &&
        p.row.current_purpose === null,
    );
    const unmatched = planned.filter((p) => p.classification === null);

    const bucketMap = new Map<string, { n: number; total: number }>();
    for (const p of writable) {
      const key = `${p.classification} / ${p.purpose}`;
      const bucket = bucketMap.get(key) ?? { n: 0, total: 0 };
      bucket.n += 1;
      bucket.total += Number(p.row.amount);
      bucketMap.set(key, bucket);
    }

    console.log(`Tổng dòng kỳ: ${planned.length}`);
    console.log(`Đã có phân loại (bỏ qua): ${alreadySet.length}`);
    console.log(`Sẽ gán: ${writable.length}`);
    console.log(`Không khớp quy tắc (giữ NULL): ${unmatched.length}`);
    console.log('--- Theo nhóm ---');
    for (const [key, b] of [...bucketMap.entries()].sort()) {
      console.log(
        `${key.padEnd(36)} ${String(b.n).padStart(4)} dòng  ${formatMoney(b.total).padStart(18)} VND`,
      );
    }

    if (reportPath) {
      const header = [
        'id',
        'trans_date',
        'direction',
        'amount',
        'correspondent_name',
        'description',
        'classification',
        'purpose',
        'reason',
        'status',
      ];
      const lines = planned.map((p) =>
        [
          p.row.id,
          p.row.trans_date,
          p.row.is_in ? 'IN' : 'OUT',
          p.row.amount,
          p.row.correspondent_name,
          p.row.description,
          p.classification,
          p.purpose,
          p.reason,
          p.row.current_classification !== null ||
          p.row.current_purpose !== null
            ? 'DA_CO'
            : p.classification === null
              ? 'KHONG_KHOP'
              : 'SE_GAN',
        ]
          .map(csvCell)
          .join(','),
      );
      writeFileSync(
        reportPath,
        [header.join(','), ...lines].join('\n'),
        'utf8',
      );
      console.log(`Báo cáo CSV: ${reportPath}`);
    }

    if (!guard.apply) {
      console.log('DRY-RUN: không ghi DB.');
      return;
    }

    await client.query('BEGIN');
    let updated = 0;
    for (const p of writable) {
      const res = await client.query(
        `UPDATE erp_bank_transactions
            SET cashflow_classification = $2,
                cashflow_purpose = $3,
                updated_at = NOW()
          WHERE id = $1
            AND cashflow_classification IS NULL
            AND cashflow_purpose IS NULL`,
        [p.row.id, p.classification, p.purpose],
      );
      updated += res.rowCount ?? 0;
    }
    await client.query('COMMIT');
    console.log(`ĐÃ GHI: ${updated} dòng (transaction đã commit).`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
