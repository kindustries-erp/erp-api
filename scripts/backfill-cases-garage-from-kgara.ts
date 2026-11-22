/**
 * scripts/backfill-cases-garage-from-kgara.ts
 *
 * Chiếu toàn bộ `kgara_cases` + `kgara_case_services` (V1) sang `cases_garage` + `case_services_garage` (v2)
 * bằng CHÍNH `CaseProjectorService` (một mapper duy nhất, cùng UUID, origin=KGARA_SYNC, idempotent).
 * Không đụng xe NATIVE. Vụ việc V1 chưa có `branch_external_id` bị bỏ qua và được báo cáo.
 *
 * Env: BẮT BUỘC theo quy ước loader (src/common/scripts/load-script-env.ts), không có file mặc định:
 *   <.env.xxx> (tham số vị trí) | --env=<file> | --target=<tenant>-<stage> | ENV_FILE | .env
 *
 * Ví dụ (chạy trong thư mục erp-api; dùng ts-node vì `bun` không nạp được `data-source` do import vòng, đặt TS_NODE_TRANSPILE_ONLY=1):
 *   node -r ts-node/register -r tsconfig-paths/register scripts/backfill-cases-garage-from-kgara.ts .env.greenway-staging            # dry-run + đối soát
 *   node -r ts-node/register -r tsconfig-paths/register scripts/backfill-cases-garage-from-kgara.ts .env.greenway-staging --apply
 *   node -r ts-node/register -r tsconfig-paths/register scripts/backfill-cases-garage-from-kgara.ts .env.greenway-production --apply --confirm=erp_greenway_production
 *
 * Tham số khác: --limit=N (chỉ xử lý N vụ việc đầu)  --branch=<branch_external_id>  --apply  --confirm=<tên DB>
 * Mặc định là dry-run (chỉ đếm và đối soát, KHÔNG ghi DB).
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import {
  describeScriptEnv,
  getWriteGuard,
  resolveScriptEnv,
  ScriptEnvError,
} from '../src/common/scripts/load-script-env';
import { CaseProjectorService } from '../src/v2/modules/cases-garage/services/case-projector.service';

const argValue = (name: string): string | undefined =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];

interface Counts {
  v1WithBranch: number;
  v1NoBranch: number;
  v2Sync: number;
  v1Lines: number;
  v2SyncLines: number;
}

async function counts(ds: DataSource, branch?: string): Promise<Counts> {
  const b = branch ? 'AND branch_external_id = $1' : '';
  const p = branch ? [branch] : [];
  const one = async (sql: string, params: unknown[] = p) =>
    Number((await ds.query(sql, params))[0].n);
  return {
    v1WithBranch: await one(
      `SELECT COUNT(*) n FROM kgara_cases WHERE branch_external_id IS NOT NULL ${b}`,
    ),
    v1NoBranch: await one(
      `SELECT COUNT(*) n FROM kgara_cases WHERE branch_external_id IS NULL`,
      [],
    ),
    v2Sync: await one(
      `SELECT COUNT(*) n FROM cases_garage WHERE origin = 'KGARA_SYNC' ${b}`,
    ),
    v1Lines: await one(
      `SELECT COUNT(*) n FROM kgara_case_services s JOIN kgara_cases c
         ON c.hd_phieu_dich_vu_id = s.hd_phieu_dich_vu_id AND c.account_key = s.account_key
        WHERE c.branch_external_id IS NOT NULL ${b.replace('branch_external_id', 'c.branch_external_id')}`,
    ),
    v2SyncLines: await one(
      `SELECT COUNT(*) n FROM case_services_garage s JOIN cases_garage c ON c.id = s.case_id
        WHERE c.origin = 'KGARA_SYNC' ${b.replace('branch_external_id', 'c.branch_external_id')}`,
    ),
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const scriptEnv = resolveScriptEnv({ argv });
  const guard = getWriteGuard(scriptEnv, argv);
  console.log(describeScriptEnv(scriptEnv, guard));
  if (guard.apply && !guard.allowed) throw new ScriptEnvError(guard.message);

  const baseDs: DataSource = require('../src/db/data-source').default;
  const ds = new DataSource({
    ...(baseDs.options as any),
    url: scriptEnv.databaseUrl,
    ssl: scriptEnv.ssl,
    extra: scriptEnv.ssl ? { ssl: scriptEnv.ssl } : {},
  });
  await ds.initialize();
  try {
    const db = (await ds.query('SELECT current_database() AS db'))[0].db;
    console.log(`📌 current_database() = ${db}`);

    const branch = argValue('branch');
    const limit = Number(argValue('limit')) || undefined;
    const before = await counts(ds, branch);
    console.log('Trước:', before);

    const rows: Array<{ id: string; exists: boolean }> = await ds.query(
      `SELECT c.id, (g.id IS NOT NULL) AS exists
         FROM kgara_cases c LEFT JOIN cases_garage g ON g.id = c.id
        WHERE c.branch_external_id IS NOT NULL ${branch ? 'AND c.branch_external_id = $1' : ''}
        ORDER BY c.created_at ASC, c.id ASC ${limit ? `LIMIT ${limit}` : ''}`,
      branch ? [branch] : [],
    );
    const toCreate = rows.filter((r) => !r.exists).length;
    console.log(
      `Sẽ xử lý ${rows.length} vụ việc: tạo mới ${toCreate}, cập nhật ${rows.length - toCreate}.`,
    );
    if (before.v1NoBranch) {
      console.log(`Bỏ qua ${before.v1NoBranch} vụ việc V1 chưa có branch_external_id.`);
    }
    if (!guard.allowed) {
      console.log('\nDRY-RUN: không ghi DB. Thêm --apply để chiếu.');
      return;
    }

    const projector = new CaseProjectorService(ds);
    const result = { created: 0, updated: 0, skipped: 0 };
    const errors: Array<{ id: string; message: string }> = [];
    for (const [i, r] of rows.entries()) {
      try {
        result[await projector.project(r.id)] += 1;
      } catch (e) {
        errors.push({ id: r.id, message: e instanceof Error ? e.message : String(e) });
      }
      if ((i + 1) % 500 === 0) console.log(`  ... ${i + 1}/${rows.length}`);
    }
    console.log('\nKết quả:', result, `lỗi: ${errors.length}`);
    errors.slice(0, 20).forEach((e) => console.log(`  ✗ ${e.id}: ${e.message}`));

    const after = await counts(ds, branch);
    console.log('Sau:', after);
    const drift = {
      cases: before.v1WithBranch - after.v2Sync - (limit ? 0 : 0),
      lines: after.v1Lines - after.v2SyncLines,
    };
    console.log('Lệch (V1 − v2):', drift);
    if (errors.length || (!limit && (drift.cases !== 0 || drift.lines !== 0))) {
      process.exitCode = 1;
    }
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => {
  if (err instanceof ScriptEnvError) {
    console.error(`❌ ${err.message}`);
    process.exit(2);
  }
  console.error(err);
  process.exit(1);
});
