/**
 * scripts/backfill-invoice-categories-autopost.ts
 *
 * Phân loại AI (9router) + hạch toán hóa đơn mua vào (direction = 'IN') bằng CHÍNH các service của app
 * (InvoiceAiHandler, InvoiceCategoryAutopostService, AccountingCoreService) nên dùng chung bảng tài khoản,
 * cấu hình tài khoản trong DB, cách đánh số chứng từ và fallback T0003 với hệ thống.
 *
 * Env: BẮT BUỘC theo quy ước loader (src/common/scripts/load-script-env.ts), không có file mặc định:
 *   <.env.xxx> (tham số vị trí) | --env=<file> | --target=<tenant>-<stage> | ENV_FILE | .env
 *
 * Chế độ (--mode):
 *   new             (mặc định) chưa có danh mục và chưa có bút toán -> AI phân loại + hạch toán
 *   retry-fallback  chưa có danh mục, bút toán còn nằm hoàn toàn ở T0003/1331 -> chạy lại AI.
 *                   HĐ anh đã sửa tay sang tài khoản khác sẽ KHÔNG bị chọn.
 *   unposted        đã có danh mục nhưng chưa hạch toán -> hạch toán theo danh mục (không gọi AI)
 *
 * Ví dụ (chạy trong thư mục erp-api):
 *   bun scripts/backfill-invoice-categories-autopost.ts .env --limit=10
 *   bun scripts/backfill-invoice-categories-autopost.ts --target=greenway-staging --mode=retry-fallback
 *   bun scripts/backfill-invoice-categories-autopost.ts .env.greenway-production --apply --confirm=erp_greenway_production
 *
 * Tham số khác: --no-memory (tắt bộ nhớ theo người bán)  --limit=N  --ai-concurrency=4  --model=<tên model 9router>  --report=<file.csv>  --apply  --confirm=<tên DB>
 * Mặc định là dry-run (chỉ phân loại + xem trước tài khoản, KHÔNG ghi DB).
 */
import 'reflect-metadata';
import * as fs from 'fs';
import { DataSource } from 'typeorm';
import {
  describeScriptEnv,
  getWriteGuard,
  resolveScriptEnv,
  ScriptEnvError,
} from '../src/common/scripts/load-script-env';
import { NineRouterClient } from '../src/ai-hub-core/clients/nine-router.client';
import {
  ClassifyInvoiceCategoryResult,
  InvoiceAiHandler,
} from '../src/ai-hub-core/handlers/invoice-ai.handler';
import { ErpDocumentSequence } from '../src/accounting-core/entities/erp_document_sequence.entity';
import { ErpChartOfAccount } from '../src/accounting-core/entities/erp_chart_of_account.entity';
import { ErpJournalEntry } from '../src/accounting-core/entities/erp_journal_entry.entity';
import { ErpJournalEntryLine } from '../src/accounting-core/entities/erp_journal_entry_line.entity';
import { AccountingCoreService } from '../src/accounting-core/services/accounting-core.service';
import { ErpInvoice } from '../src/erp-invoices-core/entities/erp_invoice.entity';
import { InvoiceCategoryAutopostService } from '../src/erp-invoices-core/services/sub-services/invoice-category-autopost.service';
import { InvoiceCategoryMemoryService } from '../src/erp-invoices-core/services/sub-services/invoice-category-memory.service';
import { ErpModuleAttributeDef } from '../src/module-config/entities/erp_module_attribute_def.entity';
import { ErpModuleCategory } from '../src/module-config/entities/erp_module_category.entity';
import { resolveInvoiceAccountsByCategory } from '../src/erp-invoices-core/helpers/invoice-category-account-mapping.helper';

type Mode = 'new' | 'retry-fallback' | 'unposted';

interface Row {
  id: string;
  invoice_no: string | null;
  serial_no: string | null;
  seller_name: string | null;
  seller_tax_code: string | null;
  total_amount: string | null;
}

interface Outcome {
  row: Row;
  categoryCode: string | null;
  debitAccount: string;
  source:
    | 'VINFAST'
    | 'MEMORY'
    | 'AI'
    | 'EXISTING'
    | 'FALLBACK'
    | 'ERROR'
    | 'SKIPPED';
  fallbackReason: string | null;
  reason: string;
}

const INVOICE_CATEGORY_SUBQUERY = `(SELECT id FROM erp_module_categories WHERE module_key = 'INVOICE')`;
const UNCATEGORIZED = `(inv.category_id IS NULL OR inv.category_id NOT IN ${INVOICE_CATEGORY_SUBQUERY})`;
const NOT_POSTED = `(inv.journal_entry_id IS NULL AND (inv.posting_status IS NULL OR inv.posting_status <> 'POSTED'))`;
const JE_DEBIT_ONLY_FALLBACK = `
  EXISTS (
    SELECT 1 FROM erp_journal_entry_lines l JOIN erp_chart_of_accounts a ON a.id = l.account_id
    WHERE l.journal_entry_id = inv.journal_entry_id AND l.debit > 0 AND a.account_code = 'T0003'
  ) AND NOT EXISTS (
    SELECT 1 FROM erp_journal_entry_lines l JOIN erp_chart_of_accounts a ON a.id = l.account_id
    WHERE l.journal_entry_id = inv.journal_entry_id AND l.debit > 0
      AND a.account_code NOT IN ('T0003', '133', '1331')
  )`;

const WHERE_BY_MODE: Record<Mode, string> = {
  new: `${UNCATEGORIZED} AND ${NOT_POSTED}`,
  'retry-fallback': `${UNCATEGORIZED} AND inv.journal_entry_id IS NOT NULL AND ${JE_DEBIT_ONLY_FALLBACK}`,
  unposted: `inv.category_id IN ${INVOICE_CATEGORY_SUBQUERY} AND (inv.journal_entry_id IS NULL OR inv.posting_status <> 'POSTED')`,
};

function readIntArg(argv: string[], name: string, fallback: number): number {
  const raw = argv.find((a) => a.startsWith(`--${name}=`));
  if (!raw) return fallback;
  const n = Number(raw.split('=')[1]);
  if (!Number.isInteger(n) || n < 1) {
    throw new ScriptEnvError(`--${name} phải là số nguyên >= 1`);
  }
  return n;
}

function readStringArg(argv: string[], name: string): string | undefined {
  return argv
    .find((a) => a.startsWith(`--${name}=`))
    ?.split('=')
    .slice(1)
    .join('=');
}

async function runPool<T>(
  items: T[],
  size: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let next = 0;
  const runners = Array.from(
    { length: Math.min(size, items.length) },
    async () => {
      while (next < items.length) {
        const i = next++;
        await worker(items[i], i);
      }
    },
  );
  await Promise.all(runners);
}

function csvCell(v: string | number | null | undefined): string {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

async function main() {
  const argv = process.argv.slice(2);

  // 1. Env + an toàn ghi
  const scriptEnv = resolveScriptEnv({ argv });
  const guard = getWriteGuard(scriptEnv, argv);
  console.log('\n=== BACKFILL PHÂN LOẠI AI & HẠCH TOÁN HÓA ĐƠN MUA VÀO ===');
  console.log(describeScriptEnv(scriptEnv, guard));
  if (!scriptEnv.explicit && scriptEnv.isProduction) {
    throw new ScriptEnvError(
      `Env mặc định đang trỏ DB production (${scriptEnv.dbLabel}). Hãy chỉ định env tường minh (vd --target=... hoặc .env.xxx).`,
    );
  }
  if (guard.apply && !guard.allowed) throw new ScriptEnvError(guard.message);

  const mode = (readStringArg(argv, 'mode') || 'new') as Mode;
  if (!(mode in WHERE_BY_MODE)) {
    throw new ScriptEnvError('--mode phải là new | retry-fallback | unposted');
  }
  const limit = argv.some((a) => a.startsWith('--limit='))
    ? readIntArg(argv, 'limit', 1)
    : undefined;
  const aiConcurrency = readIntArg(argv, 'ai-concurrency', 4);
  const reportPath = readStringArg(argv, 'report');
  const modelOverride = readStringArg(argv, 'model');
  if (argv.includes('--no-memory')) process.env.INVOICE_CATEGORY_MEMORY = 'off';
  console.log(
    `MODE: ${mode}${limit ? ` | limit ${limit}` : ''} | AI song song ${aiConcurrency}\n`,
  );

  // 2. Dựng DataSource + service của app. data-source.ts đọc process.env ngay khi import
  // nên chỉ nạp SAU khi loader đã áp env (khác với entity/service, import tĩnh ở đầu file).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const baseDs: DataSource = require('../src/db/data-source').default;

  const ds = new DataSource({
    ...(baseDs.options as any),
    url: scriptEnv.databaseUrl,
    ssl: scriptEnv.ssl,
    extra: scriptEnv.ssl ? { ssl: scriptEnv.ssl } : {},
    entities: [
      ...((baseDs.options as any).entities as any[]),
      ErpDocumentSequence,
    ],
  });
  await ds.initialize();

  try {
    const client = new NineRouterClient({
      get: (k: string) => process.env[k],
    } as any);
    const aiHandler = new InvoiceAiHandler(client);
    const accounting = new AccountingCoreService(
      ds.getRepository(ErpChartOfAccount),
      ds.getRepository(ErpJournalEntry),
      ds.getRepository(ErpJournalEntryLine),
      ds.getRepository(ErpDocumentSequence),
    );
    const autopost = new InvoiceCategoryAutopostService(
      ds.getRepository(ErpInvoice),
      ds.getRepository(ErpModuleCategory),
      ds.getRepository(ErpModuleAttributeDef),
      ds.getRepository(ErpChartOfAccount),
      ds.getRepository(ErpJournalEntry),
      ds.getRepository(ErpJournalEntryLine),
      accounting,
      aiHandler,
      new InvoiceCategoryMemoryService(ds.getRepository(ErpInvoice)),
    );

    // 3. Chọn hóa đơn
    const rows: Row[] = await ds.query(
      `SELECT inv.id, inv.invoice_no, inv.serial_no, inv.seller_name, inv.seller_tax_code, inv.total_amount
         FROM erp_invoices inv
        WHERE inv.direction = 'IN' AND inv.is_deleted = false AND ${WHERE_BY_MODE[mode]}
        ORDER BY inv.invoice_date DESC, inv.created_at DESC
        ${limit ? `LIMIT ${limit}` : ''}`,
    );
    console.log(`Tìm thấy ${rows.length} hóa đơn thuộc chế độ "${mode}".`);
    if (rows.length === 0) return;

    // 4. Phân loại AI song song (mode unposted không cần AI)
    const needsAi = mode !== 'unposted';
    const classified = new Map<string, ClassifyInvoiceCategoryResult | Error>();
    if (needsAi) {
      let done = 0;
      await runPool(rows, aiConcurrency, async (row) => {
        try {
          classified.set(
            row.id,
            await autopost.classifyInvoiceOnly(row.id, modelOverride),
          );
        } catch (e: any) {
          classified.set(row.id, e instanceof Error ? e : new Error(String(e)));
        }
        if (++done % 25 === 0 || done === rows.length)
          console.log(`  AI: ${done}/${rows.length}`);
      });
    }

    // 5. Hạch toán tuần tự (hoặc xem trước nếu dry-run)
    const outcomes: Outcome[] = [];
    let posted = 0;
    for (const [idx, row] of rows.entries()) {
      const pre = classified.get(row.id);
      try {
        if (pre instanceof Error) throw pre;

        let outcome: Outcome;
        if (mode === 'unposted') {
          const res = guard.allowed
            ? await autopost.autoPostInvoiceByCategory(row.id)
            : null;
          if (res) posted++;
          outcome = {
            row,
            categoryCode: null,
            debitAccount: '(theo danh mục)',
            source: 'EXISTING',
            fallbackReason: null,
            reason: 'Hạch toán theo danh mục đã có',
          };
        } else {
          const result = pre as ClassifyInvoiceCategoryResult;
          const mapping = resolveInvoiceAccountsByCategory(result.categoryCode);
          const stillFallback = !result.categoryCode;
          if (mode === 'retry-fallback' && stillFallback) {
            outcome = {
              row,
              categoryCode: null,
              debitAccount: 'T0003',
              source: 'SKIPPED',
              fallbackReason: result.fallbackReason ?? null,
              reason: `Vẫn không phân loại được: ${result.reason}`,
            };
          } else {
            if (guard.allowed) {
              await autopost.classifyAndAutoPost(row.id, result);
              posted++;
            }
            outcome = {
              row,
              categoryCode: result.categoryCode,
              debitAccount: mapping.debitAccountCode,
              source: result.isVfDirectMatch
                ? 'VINFAST'
                : result.fromMemory
                  ? 'MEMORY'
                  : stillFallback
                    ? 'FALLBACK'
                    : 'AI',
              fallbackReason: result.fallbackReason ?? null,
              reason: result.reason,
            };
          }
        }
        outcomes.push(outcome);
      } catch (e: any) {
        outcomes.push({
          row,
          categoryCode: null,
          debitAccount: '',
          source: 'ERROR',
          fallbackReason: null,
          reason: e?.message || String(e),
        });
      }
      if ((idx + 1) % 25 === 0 || idx + 1 === rows.length)
        console.log(`  Xử lý: ${idx + 1}/${rows.length}`);
    }

    // 6. Báo cáo
    const count = (f: (o: Outcome) => boolean) => outcomes.filter(f).length;
    console.log('\n--- KẾT QUẢ ---');
    console.log(
      `Khớp trực tiếp VinFast : ${count((o) => o.source === 'VINFAST')}`,
    );
    console.log(
      `Theo lịch sử người bán : ${count((o) => o.source === 'MEMORY')} (không tốn AI)`,
    );
    console.log(`AI phân loại được      : ${count((o) => o.source === 'AI')}`);
    console.log(
      `Rơi T0003 (dò tay)     : ${count((o) => o.source === 'FALLBACK')}`,
    );
    for (const reason of ['AI_ERROR', 'LOW_CONFIDENCE', 'INVALID_CODE']) {
      const n = count(
        (o) => o.source === 'FALLBACK' && o.fallbackReason === reason,
      );
      if (n) console.log(`   - ${reason}: ${n}`);
    }
    if (mode === 'retry-fallback')
      console.log(
        `Vẫn chưa phân loại được : ${count((o) => o.source === 'SKIPPED')}`,
      );
    if (mode === 'unposted')
      console.log(
        `Hạch toán theo danh mục : ${count((o) => o.source === 'EXISTING')}`,
      );
    console.log(
      `Lỗi                    : ${count((o) => o.source === 'ERROR')}`,
    );
    console.log(
      guard.allowed
        ? `Đã ghi DB: ${posted} hóa đơn.`
        : 'Dry-run: chưa ghi gì vào DB (thêm --apply để ghi).',
    );
    if (!guard.allowed) {
      console.log(
        'Lưu ý: dry-run xem trước tài khoản theo bảng tĩnh; khi --apply app còn áp cấu hình tài khoản trong DB.',
      );
    }

    const fallbacks = outcomes.filter(
      (o) => o.source === 'FALLBACK' || o.source === 'SKIPPED',
    );
    if (fallbacks.length) {
      console.log(
        `\nDanh sách hóa đơn rơi/giữ T0003 (${fallbacks.length}), tối đa 50 dòng:`,
      );
      for (const o of fallbacks.slice(0, 50)) {
        console.log(
          `  ${o.row.invoice_no ?? '?'} | ${o.row.seller_name ?? ''} | ${o.fallbackReason ?? '-'} | ${o.reason.slice(0, 80)}`,
        );
      }
    }
    for (const o of outcomes.filter((x) => x.source === 'ERROR').slice(0, 20)) {
      console.error(`  LỖI ${o.row.invoice_no ?? o.row.id}: ${o.reason}`);
    }

    if (reportPath) {
      const header = [
        'invoice_id',
        'invoice_no',
        'serial_no',
        'seller_name',
        'seller_tax_code',
        'total_amount',
        'source',
        'category',
        'debit_account',
        'fallback_reason',
        'reason',
      ];
      const lines = outcomes.map((o) =>
        [
          o.row.id,
          o.row.invoice_no,
          o.row.serial_no,
          o.row.seller_name,
          o.row.seller_tax_code,
          o.row.total_amount,
          o.source,
          o.categoryCode,
          o.debitAccount,
          o.fallbackReason,
          o.reason,
        ]
          .map(csvCell)
          .join(','),
      );
      fs.writeFileSync(
        reportPath,
        '﻿' + [header.join(','), ...lines].join('\n'),
      );
      console.log(`\nĐã ghi báo cáo CSV: ${reportPath}`);
    }
    if (count((o) => o.source === 'ERROR') > 0) process.exitCode = 1;
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => {
  if (err instanceof ScriptEnvError) {
    console.error(`❌ ${err.message}`);
  } else {
    console.error('❌ Lỗi Backfill Script:', err);
  }
  process.exit(1);
});
