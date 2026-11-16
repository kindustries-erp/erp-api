/**
 * backfill-invoice-files.ts
 *
 * Backfill file hóa đơn V1 (`erp_attachments`, `erp_invoices.pdf_file_key|xml_file_key|pdf_files`)
 * sang `file_attachments` (owner INVOICE, origin LEGACY). Chỉ trỏ lại khóa R2, không copy object.
 * Idempotent: chạy lại chỉ thêm phần còn thiếu.
 *
 * Env: <.env.xxx> (tham số vị trí) | --env=<file> | --target=<tenant>-<stage> | ENV_FILE | .env
 * Mặc định là DRY-RUN (chạy trong transaction rồi ROLLBACK, số liệu khớp lần ghi thật).
 * Ghi DB cần --apply VÀ --confirm=<tên DB> (bắt buộc ở mọi môi trường, không chỉ production).
 *
 * Chạy (trong thư mục erp-api):
 *   bun src/v2/modules/file-attachments/scripts/backfill-invoice-files.ts .env
 *   bun src/v2/modules/file-attachments/scripts/backfill-invoice-files.ts .env --apply --confirm=<tên DB>
 */
import {
  describeScriptEnv,
  getWriteGuard,
  resolveScriptEnv,
  ScriptEnvError,
  type WriteGuard,
} from '../../../../common/scripts/load-script-env';
import { withPgSession } from '../../../../common/scripts/script-db';
import {
  buildReport,
  INSERT_SQL,
  PREVIEW_SQL,
  SKIPPED_DELETED_SQL,
  type InsertedRow,
  type PreviewRow,
} from './backfill-invoice-files.sql';

async function main() {
  const argv = process.argv.slice(2);
  const scriptEnv = resolveScriptEnv({ argv });
  let guard: WriteGuard = getWriteGuard(scriptEnv, argv);

  if (guard.apply) {
    const confirm = argv.find((a) => a.startsWith('--confirm='));
    const value = confirm ? confirm.slice('--confirm='.length) : '';
    if (value !== scriptEnv.dbName) {
      guard = {
        apply: true,
        allowed: false,
        message: `Cần thêm --confirm=${scriptEnv.dbName} để ghi (bắt buộc với backfill này).`,
      };
    }
  }
  console.log(describeScriptEnv(scriptEnv, guard));

  const { result, outcome } = await withPgSession(
    scriptEnv,
    guard,
    async (client) => {
      const db = await client.query<{ db: string }>(
        'SELECT current_database() AS db',
      );
      console.log(`current_database(): ${db.rows[0].db}`);
      const preview = await client.query<PreviewRow>(PREVIEW_SQL);
      const skipped = await client.query<{ invoices: number }>(
        SKIPPED_DELETED_SQL,
      );
      const inserted = await client.query<InsertedRow>(INSERT_SQL);
      return {
        report: buildReport(preview.rows, inserted.rows),
        skippedDeletedInvoices: skipped.rows[0]?.invoices ?? 0,
      };
    },
  );

  console.table(result.report.bySource);
  console.log(
    `Ứng viên sau khi gộp: ${result.report.totalCandidates} | đã có ở V2: ${result.report.totalAlreadyPresent} | ` +
      `ghi mới: ${result.report.totalInserted} | hóa đơn đã xóa mềm bị bỏ qua: ${result.skippedDeletedInvoices}`,
  );
  console.log(
    outcome === 'COMMITTED'
      ? 'ĐÃ GHI (COMMIT).'
      : 'DRY-RUN: đã ROLLBACK, DB không đổi.',
  );
}

main().catch((err: unknown) => {
  if (err instanceof ScriptEnvError) console.error(err.message);
  else console.error(err);
  process.exit(1);
});
