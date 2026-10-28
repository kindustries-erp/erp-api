/**
 * classify-bank-period.ts
 *
 * Backfill Phân loại & Mục đích dòng tiền (cashflow_classification / cashflow_purpose)
 * và dọn ghi chú tạm cho sao kê trong một kỳ (giờ Việt Nam), dùng cho Q2/2026 trở đi.
 *
 * Thứ tự quyết định cho mỗi dòng đang NULL cả hai cột:
 *   1. Quy tắc nội dung (`utils/cashflow-rule-classifier.ts`).
 *      Khớp bảo hiểm → OPERATING/CUSTOMER_PAYMENT + ghi chú "Bảo hiểm".
 *      Khớp thẻ POS (`flagForCheck`) → gán nhưng nối ghi chú "check lại".
 *   2. Không khớp quy tắc → theo hướng hóa đơn cấn trừ liên kết
 *      (`utils/cashflow-invoice-link-classifier.ts`).
 *   3. Vẫn không xác định → giữ NULL, liệt kê trong báo cáo để kế toán duyệt tay.
 * Dòng được gán: chỉ bỏ câu hỏi "Thu tiền của đối tượng nào?…" khỏi ghi chú (phần còn lại
 * giữ nguyên). Không ghi đè dòng đã có phân loại; không đụng description.
 *
 * Env: theo loader chuẩn (src/common/scripts/load-script-env.ts), KHÔNG có file mặc định:
 *   <.env.xxx> (tham số vị trí) | --env=<file> | --target=<tenant>-<stage> | ENV_FILE | .env
 * Mặc định là DRY-RUN. Ghi DB cần --apply; DB production cần thêm --confirm=<tên DB>.
 *
 * Cách chạy (trong thư mục erp-api):
 *   bun src/bank-transactions-core/scripts/classify-bank-period.ts .env.greenway-production \
 *     --from=2026-04-01 --to=2026-06-30 --report=<file.csv> --backup=<file.csv>
 *   bun src/bank-transactions-core/scripts/classify-bank-period.ts .env.greenway-production \
 *     --from=2026-04-01 --to=2026-06-30 --apply --confirm=erp_greenway_production \
 *     --backup=<file.csv>
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
import { classifyCashflowByInvoiceLink } from '../utils/cashflow-invoice-link-classifier';
import { classifyCashflowByRule } from '../utils/cashflow-rule-classifier';
import { INSURANCE_NOTE } from '../utils/q1-note-cleanup';
import { stripThuTienQuestion } from '../utils/temp-note-question';

const args = process.argv.slice(2);
const argValue = (name: string): string | null => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(`--${name}=`.length) : null;
};

const reportPath = argValue('report');
const backupPath = argValue('backup');
const fromDate = argValue('from');
const toDate = argValue('to');

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CHECK_NOTE = 'check lại';

interface TxnRow {
  id: string;
  trans_date: string;
  is_in: boolean;
  amount: string;
  correspondent_name: string | null;
  description: string | null;
  note: string | null;
  current_classification: string | null;
  current_purpose: string | null;
  invoice_directions: ('IN' | 'OUT')[];
}

type Source = 'RULE' | 'INVOICE' | 'NONE';
type NoteAction = 'convert_insurance' | 'trim_question' | 'mark_check' | 'skip';

interface Planned {
  row: TxnRow;
  source: Source;
  classification: CashflowClassification | null;
  purpose: CashflowPurpose | null;
  reason: string;
  noteAction: NoteAction;
  newNote: string | null;
}

const csvCell = (value: string | number | null | undefined): string => {
  const text = value === null || value === undefined ? '' : `${value}`;
  return `"${text.replace(/"/g, '""')}"`;
};

const formatMoney = (value: number): string =>
  value.toLocaleString('en-US', { maximumFractionDigits: 0 });

/** Nối "check lại" vào ghi chú hiện có (không ghi đè); đã có thì giữ nguyên. */
const appendCheckNote = (note: string | null): string | null => {
  const existing = note?.trim() ?? '';
  if (existing.includes(CHECK_NOTE)) return note;
  return existing === '' ? CHECK_NOTE : `${existing}; ${CHECK_NOTE}`;
};

const decide = (row: TxnRow): Omit<Planned, 'row'> => {
  const rule = classifyCashflowByRule({
    isIn: row.is_in,
    correspondentName: row.correspondent_name,
    description: row.description,
    amount: Number(row.amount),
  });

  let source: Source = 'NONE';
  let decision: {
    classification: CashflowClassification;
    purpose: CashflowPurpose;
    reason: string;
    flagForCheck?: boolean;
  } | null = null;

  if (rule) {
    source = 'RULE';
    decision = rule;
  } else {
    const link = classifyCashflowByInvoiceLink({
      isIn: row.is_in,
      invoiceDirections: row.invoice_directions,
    });
    if (link) {
      source = 'INVOICE';
      decision = link;
    }
  }

  if (!decision) {
    const newNote = appendCheckNote(row.note);
    return {
      source,
      classification: null,
      purpose: null,
      reason: 'KHÔNG KHỚP',
      noteAction: newNote === row.note ? 'skip' : 'mark_check',
      newNote,
    };
  }

  if (!isPurposeAllowed(decision.classification, decision.purpose)) {
    throw new Error(
      `Cặp không hợp lệ: ${decision.classification}/${decision.purpose} (${row.id})`,
    );
  }

  if (decision.purpose === 'INSURANCE_CLAIM') {
    return {
      source,
      classification: 'OPERATING',
      purpose: 'CUSTOMER_PAYMENT',
      reason: decision.reason,
      noteAction: 'convert_insurance',
      newNote: INSURANCE_NOTE,
    };
  }

  const trimmedNote = stripThuTienQuestion(row.note);
  const newNote = decision.flagForCheck
    ? appendCheckNote(trimmedNote)
    : trimmedNote;
  const changed = newNote !== row.note;

  return {
    source,
    classification: decision.classification,
    purpose: decision.purpose,
    reason: decision.reason,
    noteAction: !changed
      ? 'skip'
      : decision.flagForCheck
        ? 'mark_check'
        : 'trim_question',
    newNote: changed ? newNote : row.note,
  };
};

async function main() {
  console.log(
    '================================================================',
  );
  console.log('BACKFILL PHÂN LOẠI DÒNG TIỀN SAO KÊ THEO KỲ');
  console.log(
    '================================================================',
  );

  if (
    !fromDate ||
    !toDate ||
    !DATE_PATTERN.test(fromDate) ||
    !DATE_PATTERN.test(toDate)
  ) {
    throw new ScriptEnvError('Bắt buộc --from=YYYY-MM-DD --to=YYYY-MM-DD.');
  }

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
    console.log(`Kỳ: ${fromDate} → ${toDate}`);

    const { rows } = await client.query<TxnRow>(
      `SELECT t.id,
              to_char(t.trans_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD HH24:MI') AS trans_date,
              (t.credit_amount > 0) AS is_in,
              (t.debit_amount + t.credit_amount)::text AS amount,
              t.correspondent_name,
              t.description,
              t.note,
              t.cashflow_classification AS current_classification,
              t.cashflow_purpose AS current_purpose,
              inv.directions AS invoice_directions
         FROM erp_bank_transactions t
         LEFT JOIN LATERAL (
              SELECT COALESCE(array_agg(i.direction::text), '{}') AS directions
                FROM erp_invoice_voucher_netoff o
                JOIN erp_invoices i ON i.id = o.invoice_id
               WHERE o.bank_transaction_id = t.id
         ) inv ON true
        WHERE t.is_deleted = false
          AND (t.trans_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
              BETWEEN $1::date AND $2::date
        ORDER BY t.trans_date`,
      [fromDate, toDate],
    );

    const alreadySet = rows.filter(
      (r) => r.current_classification !== null || r.current_purpose !== null,
    );
    const planned: Planned[] = rows
      .filter((r) => !alreadySet.includes(r))
      .map((row) => ({ row, ...decide(row) }));

    const writable = planned.filter((p) => p.classification !== null);
    const unmatched = planned.filter((p) => p.classification === null);
    const notesTrimmed = writable.filter(
      (p) => p.noteAction === 'trim_question',
    );
    const toWrite = planned.filter(
      (p) => p.classification !== null || p.noteAction === 'mark_check',
    );

    const bucketMap = new Map<string, { n: number; total: number }>();
    for (const p of writable) {
      const key = `${p.classification} / ${p.purpose} [${p.source}]`;
      const bucket = bucketMap.get(key) ?? { n: 0, total: 0 };
      bucket.n += 1;
      bucket.total += Number(p.row.amount);
      bucketMap.set(key, bucket);
    }

    console.log(`Tổng dòng kỳ: ${rows.length}`);
    console.log(`Đã có phân loại (bỏ qua): ${alreadySet.length}`);
    console.log(`Sẽ gán: ${writable.length}`);
    console.log(
      `Không khớp (giữ NULL, ghi chú "${CHECK_NOTE}"): ${unmatched.length}`,
    );
    console.log(
      `Sẽ bỏ câu hỏi "Thu tiền của đối tượng nào?" khỏi ghi chú: ${notesTrimmed.length}`,
    );
    console.log('--- Theo nhóm ---');
    for (const [key, b] of [...bucketMap.entries()].sort()) {
      console.log(
        `${key.padEnd(48)} ${String(b.n).padStart(4)} dòng  ${formatMoney(b.total).padStart(18)} VND`,
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
        'invoice_directions',
        'classification',
        'purpose',
        'source',
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
          p.row.invoice_directions.join('|'),
          p.classification,
          p.purpose,
          p.source,
          p.reason,
          p.classification === null ? 'KHONG_KHOP' : 'SE_GAN',
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

    const changing = toWrite.filter((p) => p.noteAction !== 'skip');
    if (backupPath) {
      const header = [
        'id',
        'trans_date',
        'old_note',
        'new_note',
        'note_action',
      ];
      const lines = changing.map((p) =>
        [p.row.id, p.row.trans_date, p.row.note, p.newNote, p.noteAction]
          .map(csvCell)
          .join(','),
      );
      writeFileSync(
        backupPath,
        [header.join(','), ...lines].join('\n'),
        'utf8',
      );
      console.log(
        `Sao lưu ghi chú cũ (${changing.length} dòng): ${backupPath}`,
      );
    }

    if (!guard.apply) {
      console.log('DRY-RUN: không ghi DB.');
      return;
    }

    await client.query('BEGIN');
    let updated = 0;
    for (const p of toWrite) {
      const res = await client.query(
        `UPDATE erp_bank_transactions
            SET cashflow_classification = $2,
                cashflow_purpose = $3,
                note = $4,
                updated_at = NOW()
          WHERE id = $1
            AND cashflow_classification IS NULL
            AND cashflow_purpose IS NULL`,
        [p.row.id, p.classification, p.purpose, p.newNote],
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
