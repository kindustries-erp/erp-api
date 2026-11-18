/**
 * seed-kgara-branches.ts
 *
 * Tạo chi nhánh hệ thống cho các chi nhánh Kgara thật sự có vụ việc (GR/MAIN, GN-CN2/OJ) trong
 * `branches_management` và liên kết `(source=KGARA, external_id, account_key)` ở
 * `branches_management_external_links`. Không đổi dữ liệu garage. Idempotent.
 *
 * Env: <.env.xxx> (tham số vị trí) | --env=<file> | --target=<tenant>-<stage> | ENV_FILE | .env
 * Mặc định là DRY-RUN (chạy trong transaction rồi ROLLBACK, số liệu khớp lần ghi thật).
 * Ghi DB cần --apply; DB production cần thêm --confirm=<tên DB> (script này yêu cầu --confirm ở mọi môi trường).
 *
 * Chạy (trong thư mục erp-api):
 *   bun src/v2/modules/branches-management/scripts/seed-kgara-branches.ts .env.greenway-staging
 *   bun src/v2/modules/branches-management/scripts/seed-kgara-branches.ts .env.greenway-staging --apply --confirm=<tên DB>
 */
import {
  describeScriptEnv,
  getWriteGuard,
  resolveScriptEnv,
  ScriptEnvError,
  type WriteGuard,
} from '../../../../common/scripts/load-script-env';
import { withPgSession } from '../../../../common/scripts/script-db';
import { runSeed } from './seed-kgara-branches.sql';

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
        message: `Cần thêm --confirm=${scriptEnv.dbName} để ghi.`,
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
      return runSeed(client);
    },
  );

  console.table(result);
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
