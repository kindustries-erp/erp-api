/**
 * backfill-discount-case-receivables.ts
 *
 * Sửa "còn phải thu" của phiếu Kgara có chiết khấu (raw_data.TienChietKhau > 0):
 * - kgara_cases.tien_da_thanh_toan / tien_con_phai_thanh_toan tính lại theo tien_co_thue (ròng) − đã thu.
 * - Dự thu EXPECTED tự sinh (is_auto_expected) được cập nhật số tiền; còn 0 thì xóa cứng.
 *   Không đụng phiếu đã PAID, đã gắn bank hoặc phiếu tiền mặt.
 * - Phiếu không chiết khấu bị lệch chỉ báo cáo, không sửa.
 *
 * Mặc định là DRY-RUN: mọi câu lệnh chạy trong một transaction rồi ROLLBACK, nên số dòng báo cáo khớp lần ghi thật.
 * --apply --confirm=<tên DB>: COMMIT (DB production bắt buộc --confirm). Trước khi COMMIT ghi backup JSON
 * (giá trị cũ của mọi dòng sẽ bị sửa/xóa) vào erp-api/backups/.
 *
 * Env: bắt buộc chỉ định file tường minh (loader chuẩn src/common/scripts/load-script-env.ts):
 *   bun src/kgara-api-core/scripts/backfill-discount-case-receivables.ts .env
 *   bun src/kgara-api-core/scripts/backfill-discount-case-receivables.ts --target=<tenant>-<stage>
 *   thêm --apply --confirm=<tên DB> để ghi.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  describeScriptEnv,
  getWriteGuard,
  resolveScriptEnv,
  ScriptEnvError,
} from '../../common/scripts/load-script-env';
import { withPgSession } from '../../common/scripts/script-db';
import {
  computeDiscountCaseFix,
  planForecastChange,
  ForecastAction,
} from '../helpers/kgara-discount-receivable.helper';

const argv = process.argv.slice(2);

interface CaseRow {
  id: string;
  so_chung_tu: string | null;
  tien_co_thue: string | null;
  tien_da_thanh_toan: string | null;
  tien_con_phai_thanh_toan: string | null;
  has_s: boolean;
  rec: string | null;
  has_discount: boolean;
}

interface VoucherRow {
  id: string;
  case_id: string;
  voucher_code: string;
  amount: string;
}

interface CaseChange {
  caseId: string;
  soChungTu: string | null;
  before: { paid: number; remaining: number };
  after: { paid: number; remaining: number };
}

interface VoucherChange {
  voucherId: string;
  voucherCode: string;
  caseId: string;
  action: ForecastAction;
  beforeAmount: number;
  afterAmount: number;
}

const DISCOUNT_CASES_SQL = `
  SELECT k.id,
         k.so_chung_tu,
         k.tien_co_thue::text,
         k.tien_da_thanh_toan::text,
         k.tien_con_phai_thanh_toan::text,
         EXISTS (SELECT 1 FROM kgara_case_settlements s WHERE s.case_id = k.id AND s.settlement_type = 'RECEIPT') AS has_s,
         (SELECT COALESCE(SUM(s.amount), 0)::text FROM kgara_case_settlements s
           WHERE s.case_id = k.id AND s.settlement_type = 'RECEIPT') AS rec,
         COALESCE((k.raw_data->>'TienChietKhau')::numeric, 0) > 0 AS has_discount
    FROM kgara_cases k
   WHERE k.kgara_deleted_at IS NULL`;

function num(value: string | null | undefined): number {
  return Number(value ?? 0) || 0;
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function main(): Promise<void> {
  const scriptEnv = resolveScriptEnv({ argv });
  const guard = getWriteGuard(scriptEnv, argv);
  console.log(describeScriptEnv(scriptEnv, guard));

  if (!scriptEnv.explicit) {
    throw new ScriptEnvError(
      'Chỉ định env tường minh (.env, .env.<tenant>-<stage> hoặc --target=...).',
    );
  }
  if (argv.includes('--apply') && !guard.allowed) {
    throw new ScriptEnvError(guard.message);
  }

  const { result, outcome } = await withPgSession(
    scriptEnv,
    guard,
    async (client) => {
      const dbRes = await client.query('SELECT current_database() AS db');
      console.log(`DB thực tế: ${dbRes.rows[0].db}`);

      const { rows: cases } = await client.query<CaseRow>(DISCOUNT_CASES_SQL);
      const discountCases = cases.filter((c) => c.has_discount);
      const discountIds = new Set(discountCases.map((c) => c.id));

      const caseChanges: CaseChange[] = [];
      const newRemainingByCase = new Map<string, number>();
      for (const c of discountCases) {
        const before = {
          paid: num(c.tien_da_thanh_toan),
          remaining: num(c.tien_con_phai_thanh_toan),
        };
        const fix = computeDiscountCaseFix({
          tienCoThue: num(c.tien_co_thue),
          storedPaid: num(c.tien_da_thanh_toan),
          hasReceipt: c.has_s,
          receipts: num(c.rec),
        });
        newRemainingByCase.set(c.id, fix.remaining);
        if (before.paid !== fix.paid || before.remaining !== fix.remaining) {
          caseChanges.push({
            caseId: c.id,
            soChungTu: c.so_chung_tu,
            before,
            after: fix,
          });
        }
      }

      const caseIds = discountCases.map((c) => c.id);
      const { rows: vouchers } = await client.query<VoucherRow>(
        `SELECT id, case_id, voucher_code, amount::text
           FROM kgara_cashflow_vouchers
          WHERE case_id = ANY($1::uuid[])
            AND is_auto_expected = true
            AND voucher_type = 'RECEIPT'
            AND payment_status = 'EXPECTED'
            AND erp_bank_transaction_id IS NULL
            AND erp_cash_voucher_id IS NULL`,
        [caseIds],
      );
      const voucherChanges: VoucherChange[] = [];
      for (const v of vouchers) {
        const newRemaining = newRemainingByCase.get(v.case_id) ?? 0;
        const action = planForecastChange(newRemaining, num(v.amount));
        if (action === 'NOOP') continue;
        voucherChanges.push({
          voucherId: v.id,
          voucherCode: v.voucher_code,
          caseId: v.case_id,
          action,
          beforeAmount: num(v.amount),
          afterAmount: action === 'DELETE' ? 0 : newRemaining,
        });
      }

      // Phiếu không chiết khấu bị lệch: chỉ báo cáo, không sửa.
      const outOfScope = cases
        .filter((c) => !discountIds.has(c.id))
        .filter((c) => {
          const fix = computeDiscountCaseFix({
            tienCoThue: num(c.tien_co_thue),
            storedPaid: num(c.tien_da_thanh_toan),
            hasReceipt: c.has_s,
            receipts: num(c.rec),
          });
          return num(c.tien_con_phai_thanh_toan) !== fix.remaining;
        })
        .map((c) => c.so_chung_tu);

      if (guard.allowed) {
        const backupDir = path.resolve(process.cwd(), 'backups');
        fs.mkdirSync(backupDir, { recursive: true });
        const backupFile = path.join(
          backupDir,
          `kgara-discount-backfill-${timestamp()}.json`,
        );
        const beforeCases = caseIds.length
          ? (
              await client.query(
                `SELECT id, so_chung_tu, tien_da_thanh_toan::text, tien_con_phai_thanh_toan::text
                   FROM kgara_cases WHERE id = ANY($1::uuid[])`,
                [caseChanges.map((c) => c.caseId)],
              )
            ).rows
          : [];
        fs.writeFileSync(
          backupFile,
          JSON.stringify(
            {
              database: dbRes.rows[0].db,
              cases: beforeCases,
              vouchers: vouchers.filter((v) =>
                voucherChanges.some((vc) => vc.voucherId === v.id),
              ),
            },
            null,
            2,
          ),
        );
        console.log(`Backup trước khi ghi: ${backupFile}`);
      }

      for (const c of caseChanges) {
        await client.query(
          `UPDATE kgara_cases
              SET tien_da_thanh_toan = $2,
                  tien_con_phai_thanh_toan = $3,
                  updated_at = now()
            WHERE id = $1`,
          [c.caseId, c.after.paid, c.after.remaining],
        );
      }
      for (const v of voucherChanges) {
        if (v.action === 'DELETE') {
          await client.query(
            `DELETE FROM kgara_cashflow_vouchers
              WHERE id = $1 AND payment_status = 'EXPECTED' AND is_auto_expected = true`,
            [v.voucherId],
          );
        } else {
          await client.query(
            `UPDATE kgara_cashflow_vouchers
                SET amount = $2, updated_at = now()
              WHERE id = $1`,
            [v.voucherId, v.afterAmount],
          );
        }
      }

      return {
        caseChanges,
        voucherChanges,
        outOfScope,
        discountTotal: discountCases.length,
      };
    },
  );

  const deletes = result.voucherChanges.filter((v) => v.action === 'DELETE');
  const updates = result.voucherChanges.filter((v) => v.action === 'UPDATE');
  console.log(`\nPhiếu có chiết khấu: ${result.discountTotal}`);
  console.log(`Phiếu cần sửa còn phải thu: ${result.caseChanges.length}`);
  console.log(`Dự thu cần cập nhật số tiền: ${updates.length}`);
  console.log(`Dự thu cần xóa (về 0): ${deletes.length}`);
  for (const c of result.caseChanges) {
    console.log(
      `  [CASE] ${c.soChungTu}: còn ${c.before.remaining} → ${c.after.remaining} (đã thu ${c.before.paid} → ${c.after.paid})`,
    );
  }
  for (const v of result.voucherChanges) {
    console.log(
      `  [DT] ${v.voucherCode}: ${v.action} ${v.beforeAmount} → ${v.afterAmount}`,
    );
  }
  if (result.outOfScope.length > 0) {
    console.log(
      `\nPhiếu KHÔNG chiết khấu bị lệch (chỉ báo cáo, không sửa): ${result.outOfScope.join(', ')}`,
    );
  }
  console.log(
    outcome === 'COMMITTED'
      ? '\nĐÃ GHI (COMMIT).'
      : '\nDRY-RUN: đã ROLLBACK, không có gì được ghi. Thêm --apply --confirm=<tên DB> để ghi.',
  );
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`\n❌ ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  });
}
