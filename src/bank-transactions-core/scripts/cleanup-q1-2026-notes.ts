/**
 * cleanup-q1-2026-notes.ts
 *
 * Dọn ghi chú tạm trong sao kê Q1/2026 (01/01–31/03, giờ Việt Nam):
 * - Mục đích "Bồi thường bảo hiểm" → "Khách hàng thanh toán", ghi chú = "Bảo hiểm".
 * - Dòng khác đã phân loại có ghi chú tạm → xoá ghi chú.
 * Dòng chưa phân loại và dòng đã là "Bảo hiểm" được giữ nguyên (chạy lại không đổi gì).
 *
 * Env: theo loader chuẩn (src/common/scripts/load-script-env.ts), KHÔNG có file mặc định:
 *   <.env.xxx> (tham số vị trí) | --env=<file> | --target=<tenant>-<stage> | ENV_FILE | .env
 * Mặc định là DRY-RUN. Ghi DB cần --apply; DB production cần thêm --confirm=<tên DB>.
 *
 * Cách chạy (trong thư mục erp-api):
 *   bun src/bank-transactions-core/scripts/cleanup-q1-2026-notes.ts .env.greenway-production --backup=/tmp/q1-notes-backup.csv
 *   bun src/bank-transactions-core/scripts/cleanup-q1-2026-notes.ts .env.greenway-production --apply --confirm=erp_greenway_production --backup=<file.csv>
 *   Tham số: [--backup=<file.csv>] [--apply] [--confirm=<db>]
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
  INSURANCE_NOTE,
  planNoteCleanup,
  NoteCleanupAction,
} from '../utils/q1-note-cleanup';

const args = process.argv.slice(2);
const backupArg = args.find((a) => a.startsWith('--backup='));
const backupPath = backupArg ? backupArg.slice('--backup='.length) : null;

const PERIOD_START = '2026-01-01';
const PERIOD_END = '2026-03-31';

interface TxnRow {
  id: string;
  trans_date: string;
  source_type: string;
  cashflow_classification: string | null;
  cashflow_purpose: string | null;
  note: string | null;
}

interface Planned {
  row: TxnRow;
  action: NoteCleanupAction;
}

const csvCell = (value: string | number | null | undefined): string => {
  const text = value === null || value === undefined ? '' : `${value}`;
  return `"${text.replace(/"/g, '""')}"`;
};

async function main() {
  console.log(
    '================================================================',
  );
  console.log('DỌN GHI CHÚ TẠM SAO KÊ Q1/2026');
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
              source_type,
              cashflow_classification,
              cashflow_purpose,
              note
         FROM erp_bank_transactions
        WHERE is_deleted = false
          AND source_type = 'BANK'
          AND (trans_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
              BETWEEN $1::date AND $2::date
        ORDER BY trans_date`,
      [PERIOD_START, PERIOD_END],
    );

    const planned: Planned[] = rows.map((row) => ({
      row,
      action: planNoteCleanup({
        cashflowClassification: row.cashflow_classification,
        cashflowPurpose: row.cashflow_purpose,
        note: row.note,
      }),
    }));

    const count = (action: NoteCleanupAction) =>
      planned.filter((p) => p.action === action).length;
    console.log(`Tổng dòng trong kỳ: ${rows.length}`);
    console.table({
      convert_insurance: { số_dòng: count('convert_insurance') },
      clear_note: { số_dòng: count('clear_note') },
      skip: { số_dòng: count('skip') },
    });

    const changing = planned.filter((p) => p.action !== 'skip');
    if (backupPath) {
      const header = ['id', 'trans_date', 'old_purpose', 'old_note', 'action'];
      const lines = changing.map((p) =>
        [
          p.row.id,
          p.row.trans_date,
          p.row.cashflow_purpose,
          p.row.note,
          p.action,
        ]
          .map(csvCell)
          .join(','),
      );
      writeFileSync(
        backupPath,
        [header.join(','), ...lines].join('\n'),
        'utf8',
      );
      console.log(
        `Sao lưu trạng thái cũ (${changing.length} dòng): ${backupPath}`,
      );
    } else if (changing.length > 0) {
      console.log(
        '[CẢNH BÁO] Chưa có --backup: nên xuất sao lưu trước khi --apply.',
      );
    }

    if (!guard.allowed) {
      console.log(
        'DRY-RUN: không ghi DB. Thêm --apply --confirm=<tên DB> để cập nhật.',
      );
      return;
    }

    await client.query('BEGIN');
    let convertedRows = 0;
    let clearedRows = 0;
    for (const p of changing) {
      if (p.action === 'convert_insurance') {
        const res = await client.query(
          `UPDATE erp_bank_transactions
              SET cashflow_purpose = 'CUSTOMER_PAYMENT',
                  note = $2,
                  updated_at = NOW()
            WHERE id = $1
              AND cashflow_purpose = 'INSURANCE_CLAIM'`,
          [p.row.id, INSURANCE_NOTE],
        );
        convertedRows += res.rowCount ?? 0;
      } else {
        const res = await client.query(
          `UPDATE erp_bank_transactions
              SET note = NULL,
                  updated_at = NOW()
            WHERE id = $1
              AND note IS NOT NULL`,
          [p.row.id],
        );
        clearedRows += res.rowCount ?? 0;
      }
    }
    await client.query('COMMIT');
    console.log(
      `ĐÃ GHI (transaction đã commit): ${convertedRows} dòng đổi bảo hiểm, ${clearedRows} dòng xoá ghi chú.`,
    );
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
