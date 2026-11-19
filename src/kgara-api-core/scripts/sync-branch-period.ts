/**
 * sync-branch-period.ts
 *
 * Sync một chi nhánh KGara (theo MaSo) trong một khoảng ngày, tài khoản MAIN:
 *   1. syncCasesForBranch  — danh sách phiếu (số khung từ receivables, giữ nguyên dữ liệu đã có)
 *   2. syncCaseDetailsBatch (force) — chi tiết phiếu (đối tượng thanh toán)
 *
 * Mặc định CHỈ ĐỌC: chỉ đọc kgara_branches để tìm UUID chi nhánh và đếm phiếu trong kỳ.
 * --apply mới gọi sync (ghi DB). Với production cần thêm --confirm=<tên DB>.
 *
 * Env: loader chuẩn, bắt buộc chỉ định file tường minh:
 *   --target=greenway-staging | .env.greenway-staging | --env=<file>
 *
 * Tham số:
 *   --branch-code=GR   (MaSo chi nhánh, bắt buộc)
 *   --account=MAIN     (mặc định MAIN)
 *   --from=YYYY-MM-DD  (bắt buộc)
 *   --to=YYYY-MM-DD    (bắt buộc)
 *   --apply            ghi DB
 *
 * Ví dụ:
 *   bun src/kgara-api-core/scripts/sync-branch-period.ts --target=greenway-staging --branch-code=GR --from=2026-10-01 --to=2026-10-31
 *   ... (thêm) --apply
 */

import {
  describeScriptEnv,
  getWriteGuard,
  resolveScriptEnv,
  ScriptEnvError,
} from '../../common/scripts/load-script-env';
import { withPgSession } from '../../common/scripts/script-db';
import { KgaraAccountKey } from '../enums/kgara-account.enum';

const argv = process.argv.slice(2);

function argValue(name: string): string | undefined {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

async function main(): Promise<void> {
  const scriptEnv = resolveScriptEnv({ argv });
  const guard = getWriteGuard(scriptEnv, argv);
  console.log(describeScriptEnv(scriptEnv, guard));

  if (!scriptEnv.explicit) {
    throw new ScriptEnvError(
      'Chỉ định env tường minh (--target=greenway-staging hoặc .env.greenway-staging).',
    );
  }

  const branchCode = argValue('branch-code');
  const from = argValue('from');
  const to = argValue('to');
  const account = (argValue('account') ?? 'MAIN').toUpperCase();
  if (!branchCode || !from || !to) {
    throw new ScriptEnvError('Thiếu --branch-code, --from hoặc --to.');
  }
  if (account !== 'MAIN') {
    throw new ScriptEnvError('Script này chỉ hỗ trợ --account=MAIN.');
  }

  // Đọc: tìm UUID chi nhánh và đếm phiếu hiện có trong kỳ (không ghi)
  const { result: branch } = await withPgSession(
    scriptEnv,
    guard,
    async (client) => {
      const found = await client.query(
        `SELECT external_id, name FROM kgara_branches WHERE code = $1 AND account_key = $2`,
        [branchCode, account],
      );
      if (found.rowCount !== 1) {
        throw new ScriptEnvError(
          `Không tìm thấy đúng 1 chi nhánh code=${branchCode} account=${account} (có ${found.rowCount}).`,
        );
      }
      const before = await client.query(
        `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE COALESCE(so_khung,'') <> '')::int AS khung,
              count(*) FILTER (WHERE doi_tuong_thanh_toan_code IS NOT NULL)::int AS payer
         FROM kgara_cases
        WHERE branch_external_id = $1 AND account_key = $2
          AND COALESCE(ngay_tiep_nhan, ngay_phat_sinh) >= $3::date
          AND COALESCE(ngay_tiep_nhan, ngay_phat_sinh) < ($4::date + interval '1 day')`,
        [found.rows[0].external_id, account, from, to],
      );
      console.log(
        `[TRƯỚC] chi nhánh ${branchCode} (${found.rows[0].name}), kỳ ${from}→${to}: phiếu=${before.rows[0].total}, có số khung=${before.rows[0].khung}, có đối tượng TT=${before.rows[0].payer}`,
      );
      return { uuid: found.rows[0].external_id as string };
    },
  );

  if (!guard.allowed) {
    console.log(guard.message);
    console.log('Dừng ở chế độ chỉ đọc. Không gọi sync.');
    return;
  }

  // Ghi: nạp AppModule sau khi env đã resolve (cùng cách với các script khác trong thư mục này)
  /* eslint-disable @typescript-eslint/no-require-imports -- nạp AppModule sau khi env đã được resolve */
  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require('../../app.module');
  const { SyncCaseService } = require('../services/sync-case.service');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const sync = app.get(SyncCaseService);
    const accountKey = KgaraAccountKey.MAIN;
    console.log(`[APPLY] syncCasesForBranch ${branch.uuid} ${from}→${to}`);
    const casesResult = await sync.syncCasesForBranch(
      branch.uuid,
      from,
      to,
      undefined,
      accountKey,
    );
    console.log(`[APPLY] kết quả cases: ${JSON.stringify(casesResult)}`);

    console.log(
      `[APPLY] syncCaseDetailsBatch (force) ${branchCode} ${from}→${to}`,
    );
    const detailResult = await sync.syncCaseDetailsBatch(branch.uuid, {
      from,
      to,
      force: true,
      accountKey,
    });
    console.log(`[APPLY] kết quả detail: ${JSON.stringify(detailResult)}`);
  } finally {
    await app.close();
  }

  // Kiểm tra sau ghi (chỉ đọc)
  await withPgSession(
    scriptEnv,
    getWriteGuard(scriptEnv, []),
    async (client) => {
      const after = await client.query(
        `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE COALESCE(so_khung,'') <> '')::int AS khung,
              count(*) FILTER (WHERE doi_tuong_thanh_toan_code IS NOT NULL)::int AS payer
         FROM kgara_cases
        WHERE branch_external_id = $1 AND account_key = $2
          AND COALESCE(ngay_tiep_nhan, ngay_phat_sinh) >= $3::date
          AND COALESCE(ngay_tiep_nhan, ngay_phat_sinh) < ($4::date + interval '1 day')`,
        [branch.uuid, account, from, to],
      );
      console.log(
        `[SAU] phiếu=${after.rows[0].total}, có số khung=${after.rows[0].khung}, có đối tượng TT=${after.rows[0].payer}`,
      );
    },
  );
}

main().catch((error) => {
  console.error('sync-branch-period failed:', error?.stack ?? error);
  process.exit(1);
});
