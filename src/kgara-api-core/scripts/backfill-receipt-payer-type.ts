/**
 * backfill-receipt-payer-type.ts
 *
 * Gắn payer_type = 'BH' cho khoản thu (settlement RECEIPT) cũ của phiếu có phần bảo hiểm,
 * vì writer trước đây luôn ghi 'KH'. Quy tắc giống writer (resolveReceiptPayerType):
 * khoản đang là KH có số tiền khớp phần BH còn thiếu (±1.000đ) thì đổi sang BH.
 * - Phiếu có phần BH nhưng không khoản nào khớp: chỉ liệt kê (mơ hồ), không đổi.
 * - PAYMENT và phiếu không có phần BH không bị đụng.
 *
 * Mặc định là DRY-RUN: chạy trong một transaction rồi ROLLBACK.
 * --apply --confirm=<tên DB>: COMMIT (DB production bắt buộc --confirm). Trước khi COMMIT ghi backup JSON
 * (payer_type cũ của từng settlement bị đổi) vào erp-api/backups/. Chạy lại không đổi gì thêm.
 *
 * Env: bắt buộc chỉ định file tường minh (loader chuẩn src/common/scripts/load-script-env.ts):
 *   bun src/kgara-api-core/scripts/backfill-receipt-payer-type.ts .env
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
import { getCaseReceivableDues } from '../helpers/kgara-case-dues.helper';
import { planReceiptPayerBackfill } from '../helpers/kgara-receipt-payer-backfill.helper';

const argv = process.argv.slice(2);

interface ReceiptRow {
  id: string;
  case_id: string;
  so_chung_tu: string | null;
  tien_co_thue: string | null;
  raw_data: Record<string, unknown> | null;
  amount: string;
  payer_type: string | null;
  trans_date: string | null;
}

interface Change {
  settlementId: string;
  caseId: string;
  soChungTu: string | null;
  amount: number;
  from: string | null;
  to: string;
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

      const { rows } = await client.query<ReceiptRow>(
        `SELECT s.id, s.case_id, k.so_chung_tu, k.tien_co_thue::text,
                k.raw_data, s.amount::text, s.payer_type, s.trans_date::text
           FROM kgara_case_settlements s
           JOIN kgara_cases k ON k.id = s.case_id
          WHERE s.settlement_type = 'RECEIPT'
            AND k.kgara_deleted_at IS NULL
          ORDER BY s.case_id, s.trans_date NULLS LAST, s.created_at, s.id`,
      );

      const byCase = new Map<string, ReceiptRow[]>();
      for (const r of rows) {
        const list = byCase.get(r.case_id) ?? [];
        list.push(r);
        byCase.set(r.case_id, list);
      }

      const changes: Change[] = [];
      const ambiguous: Array<{
        soChungTu: string | null;
        dueBH: number;
        receipts: number[];
      }> = [];
      let bhCases = 0;

      for (const [caseId, list] of byCase) {
        const head = list[0];
        const { dueBH } = getCaseReceivableDues(
          head.raw_data,
          head.tien_co_thue,
        );
        if (!(dueBH > 0)) continue;
        bhCases++;
        const plan = planReceiptPayerBackfill(
          list.map((r) => ({
            id: r.id,
            amount: Number(r.amount) || 0,
            payerType: r.payer_type,
          })),
          dueBH,
        );
        for (const c of plan.changes) {
          const row = list.find((r) => r.id === c.id)!;
          changes.push({
            settlementId: c.id,
            caseId,
            soChungTu: head.so_chung_tu,
            amount: Number(row.amount) || 0,
            from: c.from,
            to: c.to,
          });
        }
        if (plan.ambiguous) {
          ambiguous.push({
            soChungTu: head.so_chung_tu,
            dueBH,
            receipts: list.map((r) => Number(r.amount) || 0),
          });
        }
      }

      if (guard.allowed && changes.length > 0) {
        const backupDir = path.resolve(process.cwd(), 'backups');
        fs.mkdirSync(backupDir, { recursive: true });
        const backupFile = path.join(
          backupDir,
          `kgara-receipt-payer-backfill-${timestamp()}.json`,
        );
        fs.writeFileSync(
          backupFile,
          JSON.stringify(
            { database: dbRes.rows[0].db, settlements: changes },
            null,
            2,
          ),
        );
        console.log(`Backup trước khi ghi: ${backupFile}`);
      }

      for (const c of changes) {
        await client.query(
          `UPDATE kgara_case_settlements
              SET payer_type = $2, updated_at = now()
            WHERE id = $1 AND settlement_type = 'RECEIPT' AND payer_type = 'KH'`,
          [c.settlementId, c.to],
        );
      }

      return { changes, ambiguous, bhCases, totalReceipts: rows.length };
    },
  );

  console.log(`\nKhoản thu (RECEIPT) quét: ${result.totalReceipts}`);
  console.log(`Phiếu có phần BH và có thu: ${result.bhCases}`);
  console.log(`Khoản cần đổi KH → BH: ${result.changes.length}`);
  for (const c of result.changes) {
    console.log(
      `  [BH] ${c.soChungTu}: ${c.amount} (${c.from} → ${c.to}) settlement ${c.settlementId}`,
    );
  }
  console.log(
    `Phiếu mơ hồ (không đổi, cần anh chốt tay): ${result.ambiguous.length}`,
  );
  for (const a of result.ambiguous) {
    console.log(
      `  [?] ${a.soChungTu}: phần BH ${a.dueBH}, các khoản thu ${a.receipts.join(' + ')}`,
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
