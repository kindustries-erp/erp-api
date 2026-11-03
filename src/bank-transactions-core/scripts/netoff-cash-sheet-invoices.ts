/**
 * netoff-cash-sheet-invoices.ts
 *
 * Đưa các khoản thu tiền mặt trong sheet "Cash-2026" vào sổ quỹ (erp_bank_transactions,
 * source_type = 'CASH') và cấn trừ với hóa đơn bán ra cùng biển số.
 *
 * Quy tắc:
 * - Khoản thu khớp 1-1 với hóa đơn cùng biển, hóa đơn xuất vào ngày thu hoặc sau đó,
 *   |còn lại − tiền thu| < --tolerance (mặc định 10.000đ). Xem utils/cash-invoice-matcher.ts.
 * - Số cấn trừ = min(tiền thu, còn lại). Phần chênh lệch để nguyên trên giao dịch hoặc hóa đơn.
 * - Idempotent: reference_number = CASH2026-R<dòng sheet>; dòng đã có thì bỏ qua.
 * - Hóa đơn có MST và đối tác tồn tại: InvoiceDebtsNetOffService.allocate (có khóa, kiểm tra đầy đủ).
 *   Còn lại (khách không MST / chưa có đối tác): TransactionAccountingService.linkInvoiceToTransaction
 *   sau khi tự kiểm tra lại số dư hóa đơn tại thời điểm ghi.
 * - Dừng ngay ở lỗi đầu tiên; mọi dòng đã ghi nằm trong file --backup để gỡ bằng --rollback.
 *
 * Env: theo loader chuẩn (src/common/scripts/load-script-env.ts), truyền tường minh, ví dụ .env.greenway-production.
 * Mặc định là DRY-RUN (chỉ đọc, xuất --report). Ghi cần --apply; DB production cần thêm --confirm=<tên DB>.
 *
 * Cách chạy (trong thư mục erp-api):
 *   node -r ts-node/register -r tsconfig-paths/register src/bank-transactions-core/scripts/netoff-cash-sheet-invoices.ts \
 *     .env.greenway-production --xlsx="<đường dẫn xlsx>" --cash-book=<uuid> --report=<file.csv>
 *   ... --apply --confirm=erp_greenway_production --backup=<file.csv>
 *   ... --rollback=<file.csv> --apply --confirm=erp_greenway_production
 */
/* eslint-disable @typescript-eslint/no-require-imports -- nạp env trước khi load AppModule */
import { randomUUID } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import {
  describeScriptEnv,
  getWriteGuard,
  resolveScriptEnv,
} from '../../common/scripts/load-script-env';
import {
  matchReceiptsToInvoices,
  type CashInvoiceMatchResult,
  type OpenInvoice,
} from '../utils/cash-invoice-matcher';
import { readCashReceipts } from '../utils/cash-sheet-reader';

const scriptEnv = resolveScriptEnv();
Object.assign(process.env, scriptEnv.config);

const argv = process.argv.slice(2);
const argValue = (name: string): string | null => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(`--${name}=`.length) : null;
};

const SHEET_NAME = argValue('sheet') ?? 'Cash-2026';
const TOLERANCE_VND = Number(argValue('tolerance') ?? '10000');
const CASH_BOOK_ID = argValue('cash-book');
const XLSX_PATH = argValue('xlsx');
const REPORT_PATH = argValue('report');
const BACKUP_PATH = argValue('backup');
const ROLLBACK_PATH = argValue('rollback');
const REF_PREFIX = 'CASH2026-R';
const MST_MIN_LENGTH = 10;

const csvCell = (value: string | number | null | undefined): string => {
  const text = value === null || value === undefined ? '' : `${value}`;
  return `"${text.replace(/"/g, '""')}"`;
};
const csvLine = (cells: Array<string | number | null | undefined>) =>
  cells.map(csvCell).join(',');

interface BackupLine {
  txnId: string;
  invoiceId: string;
  allocated: number;
  route: string;
}

async function main() {
  const guard = getWriteGuard(scriptEnv, argv);
  console.log(describeScriptEnv(scriptEnv, guard));
  const apply = guard.allowed;
  if (!apply && guard.apply) {
    console.error(`[ABORT] ${guard.message}`);
    process.exitCode = 1;
    return;
  }

  const { NestFactory } = require('@nestjs/core');
  const { DataSource } = require('typeorm');
  const { AppModule } = require('../../app.module');
  const {
    InvoiceDebtsNetOffService,
  } = require('../../erp-invoices-core/services/sub-services/invoice-debts-net-off.service');
  const {
    InvoicePartnerType,
  } = require('../../erp-invoices-core/dto/get-invoice-debts.dto');
  const {
    TransactionAccountingService,
  } = require('../services/transaction-accounting.service');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const dataSource = app.get(DataSource);
    const [{ current_database: dbName }] = await dataSource.query(
      'SELECT current_database()',
    );
    console.log(`[DB] current_database() = ${dbName}`);

    if (ROLLBACK_PATH) {
      await rollback(dataSource, ROLLBACK_PATH, apply);
      return;
    }

    if (!XLSX_PATH) throw new Error('Thiếu --xlsx=<đường dẫn file>');
    if (!CASH_BOOK_ID) throw new Error('Thiếu --cash-book=<uuid sổ quỹ>');
    if (!Number.isFinite(TOLERANCE_VND) || TOLERANCE_VND <= 0) {
      throw new Error('--tolerance phải là số dương (VND)');
    }

    const [cashBook] = await dataSource.query(
      `SELECT id, branch_id FROM erp_cash_books WHERE id = $1 AND is_deleted = false`,
      [CASH_BOOK_ID],
    );
    if (!cashBook) throw new Error('Không tìm thấy sổ quỹ (hoặc đã xóa)');

    const { receipts, skipped } = await readCashReceipts(XLSX_PATH, SHEET_NAME);
    console.log(
      `[SHEET] ${SHEET_NAME}: ${receipts.length} khoản thu có biển, bỏ qua ${skipped.length} dòng`,
    );

    const invoices = await loadOpenInvoices(dataSource);
    const result = matchReceiptsToInvoices(receipts, invoices, TOLERANCE_VND);
    printSummary(result);

    if (REPORT_PATH) writeReport(REPORT_PATH, result, invoices);
    if (!apply) {
      console.log(
        '[DRY-RUN] Chưa ghi DB. Duyệt báo cáo rồi chạy lại với --apply.',
      );
      return;
    }
    if (!BACKUP_PATH) throw new Error('Ghi DB cần --backup=<file.csv>');

    const netOff = app.get(InvoiceDebtsNetOffService);
    const txnAccounting = app.get(TransactionAccountingService);
    await applyMatches(
      dataSource,
      result,
      { branchId: cashBook.branch_id, cashBookId: cashBook.id },
      { netOff, txnAccounting, partnerType: InvoicePartnerType.CUSTOMER },
    );
  } finally {
    await app.close();
  }
}

async function loadOpenInvoices(dataSource: any): Promise<OpenInvoice[]> {
  const rows: Array<{
    id: string;
    invoice_no: string;
    invoice_date: string;
    plate: string;
    remaining: string;
  }> = await dataSource.query(`
    SELECT i.id,
           i.invoice_no,
           i.invoice_date::text AS invoice_date,
           upper(replace(i.license_plate, ' ', '')) AS plate,
           (i.total_amount
             - COALESCE((SELECT SUM(n.net_off_amount) FROM erp_invoice_voucher_netoff n WHERE n.invoice_id = i.id), 0)
             - COALESCE((SELECT SUM(a.offset_amount) FROM erp_invoice_adjustment_netoff a WHERE a.original_invoice_id = i.id), 0)
           )::text AS remaining
      FROM erp_invoices i
     WHERE i.is_deleted = false
       AND i.direction = 'OUT'
       AND i.license_plate IS NOT NULL
       AND (i.tax_invoice_status IS NULL OR i.tax_invoice_status NOT IN (3, 4))
  `);
  return rows.map((r) => ({
    id: r.id,
    invoiceNo: r.invoice_no,
    invoiceDate: r.invoice_date,
    plate: r.plate,
    remaining: Number(r.remaining),
  }));
}

function printSummary(result: CashInvoiceMatchResult) {
  const grade = { EXACT: 0, NEAR: 0, WIDE: 0 };
  let total = 0;
  for (const m of result.matches) {
    grade[m.grade] += 1;
    total += m.allocated;
  }
  const reasons: Record<string, number> = {};
  for (const u of result.unmatched) {
    reasons[u.reason] = (reasons[u.reason] ?? 0) + 1;
  }
  console.log(
    `[MATCH] ${result.matches.length} cặp 1-1 (EXACT ${grade.EXACT}, NEAR ${grade.NEAR}, WIDE ${grade.WIDE}), cấn trừ ${total.toLocaleString('vi-VN')}đ`,
  );
  console.log(`[UNMATCHED] ${result.unmatched.length} khoản:`, reasons);
}

function writeReport(
  path: string,
  result: CashInvoiceMatchResult,
  invoices: OpenInvoice[],
) {
  const byId = new Map(invoices.map((i) => [i.id, i]));
  const lines = [
    csvLine([
      'dòng sheet',
      'ngày thu',
      'biển số',
      'tiền thu',
      'số HĐ',
      'ngày HĐ',
      'còn lại HĐ',
      'cấn trừ',
      'chênh lệch',
      'mức',
      'trạng thái',
    ]),
  ];
  for (const m of result.matches) {
    const inv = byId.get(m.invoice.id) ?? m.invoice;
    lines.push(
      csvLine([
        m.receipt.row,
        m.receipt.date,
        m.receipt.plate,
        m.receipt.amount,
        inv.invoiceNo,
        inv.invoiceDate,
        inv.remaining,
        m.allocated,
        m.diff,
        m.grade,
        'GHÉP',
      ]),
    );
  }
  for (const u of result.unmatched) {
    lines.push(
      csvLine([
        u.receipt.row,
        u.receipt.date,
        u.receipt.plate,
        u.receipt.amount,
        '',
        '',
        '',
        '',
        '',
        '',
        u.reason,
      ]),
    );
  }
  writeFileSync(path, '\uFEFF' + lines.join('\n') + '\n', 'utf8');
  console.log(`[REPORT] ${path}`);
}

async function applyMatches(
  dataSource: any,
  result: CashInvoiceMatchResult,
  cash: { branchId: string; cashBookId: string },
  svc: { netOff: any; txnAccounting: any; partnerType: string },
) {
  const batchId = randomUUID();
  const backupLines: string[] = [
    csvLine(['txn_id', 'invoice_id', 'allocated', 'route', 'batch_id', 'ref']),
  ];
  writeFileSync(
    BACKUP_PATH as string,
    '\uFEFF' + backupLines.join('\n') + '\n',
    'utf8',
  );

  let done = 0;
  let skipped = 0;
  for (const m of result.matches) {
    const ref = `${REF_PREFIX}${m.receipt.row}`;
    const [existing] = await dataSource.query(
      `SELECT id FROM erp_bank_transactions WHERE reference_number = $1`,
      [ref],
    );
    if (existing) {
      skipped += 1;
      continue;
    }

    const [inv] = await dataSource.query(
      `SELECT i.buyer_tax_code, i.buyer_name, i.buyer_personal_name,
              (i.total_amount
                - COALESCE((SELECT SUM(n.net_off_amount) FROM erp_invoice_voucher_netoff n WHERE n.invoice_id = i.id), 0)
                - COALESCE((SELECT SUM(a.offset_amount) FROM erp_invoice_adjustment_netoff a WHERE a.original_invoice_id = i.id), 0)
              )::text AS remaining
         FROM erp_invoices i WHERE i.id = $1 AND i.is_deleted = false`,
      [m.invoice.id],
    );
    if (!inv || Number(inv.remaining) + 0.005 < m.allocated) {
      throw new Error(
        `Hóa đơn ${m.invoice.invoiceNo} (dòng ${m.receipt.row}) không còn đủ số dư; dừng. Gỡ bằng --rollback nếu cần.`,
      );
    }

    const taxCode = String(inv.buyer_tax_code ?? '').trim();
    const hasMst = taxCode.length >= MST_MIN_LENGTH;
    const [partner] = hasMst
      ? await dataSource.query(
          `SELECT id FROM erp_business_partners WHERE tax_code = $1 AND is_deleted = false LIMIT 1`,
          [taxCode],
        )
      : [];
    const route = partner ? 'MST' : 'KHONG_MST';

    const [txn] = await dataSource.query(
      `INSERT INTO erp_bank_transactions
         (source_type, cash_book_id, branch_id, branch_ids, trans_date,
          debit_amount, credit_amount, reference_number, description,
          correspondent_name, cashflow_classification, cashflow_purpose,
          import_batch_id, partner_id)
       VALUES ('CASH', $1, $2, ARRAY[$2]::uuid[], $3,
               0, $4, $5, $6, $7, 'OPERATING', 'CUSTOMER_PAYMENT', $8, $9)
       RETURNING id`,
      [
        cash.cashBookId,
        cash.branchId,
        m.receipt.date,
        m.receipt.amount,
        ref,
        `Thu tiền mặt ${m.receipt.plate} (dòng ${m.receipt.row} sheet ${SHEET_NAME})`,
        String(inv.buyer_name ?? inv.buyer_personal_name ?? '').slice(0, 255),
        batchId,
        partner?.id ?? null,
      ],
    );

    backupLines.push(csvLine([txn.id, m.invoice.id, '', route, batchId, ref]));
    writeFileSync(
      BACKUP_PATH as string,
      '\uFEFF' + backupLines.join('\n') + '\n',
      'utf8',
    );

    if (partner) {
      await svc.netOff.allocate(taxCode, {
        partnerType: svc.partnerType,
        bankTransactionId: txn.id,
        allocations: [{ invoiceId: m.invoice.id, amount: m.allocated }],
      });
    } else {
      await svc.txnAccounting.linkInvoiceToTransaction(txn.id, {
        invoiceId: m.invoice.id,
        netOffAmount: m.allocated,
      });
    }
    backupLines[backupLines.length - 1] = csvLine([
      txn.id,
      m.invoice.id,
      m.allocated,
      route,
      batchId,
      ref,
    ]);
    writeFileSync(
      BACKUP_PATH as string,
      '\uFEFF' + backupLines.join('\n') + '\n',
      'utf8',
    );
    done += 1;
  }
  console.log(
    `[APPLY] ghi ${done} cặp, bỏ qua ${skipped} (đã có). Backup: ${BACKUP_PATH}`,
  );
}

async function rollback(dataSource: any, path: string, apply: boolean) {
  const lines = readFileSync(path, 'utf8')
    .replace(/^\uFEFF/, '')
    .split('\n')
    .slice(1)
    .filter((l) => l.trim());
  const parsed: BackupLine[] = lines.map((l) => {
    const cells = l.split(',').map((c) => c.replace(/^"|"$/g, ''));
    return {
      txnId: cells[0],
      invoiceId: cells[1],
      allocated: Number(cells[2]),
      route: cells[3],
    } as BackupLine;
  });
  console.log(`[ROLLBACK] ${parsed.length} dòng trong backup`);
  if (!apply) {
    console.log('[DRY-RUN] Chưa gỡ. Thêm --apply --confirm=<DB> để gỡ.');
    return;
  }
  for (const line of parsed) {
    await dataSource.query(
      `DELETE FROM erp_invoice_voucher_netoff WHERE bank_transaction_id = $1 AND invoice_id = $2`,
      [line.txnId, line.invoiceId],
    );
    await dataSource.query(
      `UPDATE erp_bank_transactions SET is_deleted = true, updated_at = now()
        WHERE id = $1 AND source_type = 'CASH' AND reference_number LIKE 'CASH2026-R%'`,
      [line.txnId],
    );
  }
  console.log(`[ROLLBACK] đã gỡ ${parsed.length} khoản`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
