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
 *   --branch-code=GR      (MaSo chi nhánh, bắt buộc)
 *   --account=MAIN        (mặc định MAIN)
 *   --from=YYYY-MM-DD     (bắt buộc, trừ khi dùng --cases-file)
 *   --to=YYYY-MM-DD       (bắt buộc, trừ khi dùng --cases-file)
 *   --concurrency=N       (1–10, mặc định 1: gọi song song làm KGara báo deadlock nhiều hơn)
 *   --cases-file=<file>   chỉ sync chi tiết các phiếu trong file (mỗi dòng: HdPhieuDichVuID hoặc SoChungTu,
 *                         lấy cột đầu nếu là CSV); bỏ qua bước sync danh sách
 *   --apply               ghi DB
 *
 * Ví dụ:
 *   bun src/kgara-api-core/scripts/sync-branch-period.ts --target=greenway-staging --branch-code=GR --from=2026-10-01 --to=2026-10-31
 *   ... (thêm) --apply
 */

import * as fs from 'fs';
import type { Client } from 'pg';
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

function parseConcurrency(): number {
  const raw = argValue('concurrency');
  if (raw === undefined) return 1;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 10) {
    throw new ScriptEnvError('--concurrency phải là số nguyên từ 1 đến 10.');
  }
  return value;
}

function readCaseIds(file: string): string[] {
  if (!fs.existsSync(file)) {
    throw new ScriptEnvError(`Không tìm thấy --cases-file: ${file}`);
  }
  const ids = fs
    .readFileSync(file, 'utf8')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.split(',')[0].trim())
    .filter(Boolean)
    // Bỏ dòng tiêu đề CSV nếu có
    .filter(
      (id, i) =>
        i > 0 || !/^(guid|id|so_?chung_?tu|hdphieudichvuid)$/i.test(id),
    );
  if (ids.length === 0) {
    throw new ScriptEnvError(`--cases-file rỗng: ${file}`);
  }
  return Array.from(new Set(ids));
}

interface Counts {
  total: number;
  khung: number;
  payer: number;
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
  const casesFile = argValue('cases-file');
  const concurrency = parseConcurrency();
  const caseIds = casesFile ? readCaseIds(casesFile) : null;

  if (!branchCode || (!caseIds && (!from || !to))) {
    throw new ScriptEnvError(
      'Thiếu --branch-code, hoặc thiếu --from/--to (khi không dùng --cases-file).',
    );
  }
  if (account !== 'MAIN') {
    throw new ScriptEnvError('Script này chỉ hỗ trợ --account=MAIN.');
  }

  const scopeLabel = caseIds
    ? `${caseIds.length} phiếu trong --cases-file`
    : `kỳ ${from}→${to}`;

  const countCases = async (client: Client, uuid: string): Promise<Counts> => {
    const select = `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE COALESCE(so_khung,'') <> '')::int AS khung,
              count(*) FILTER (WHERE doi_tuong_thanh_toan_code IS NOT NULL)::int AS payer
         FROM kgara_cases
        WHERE branch_external_id = $1 AND account_key = $2`;
    const res = caseIds
      ? await client.query(
          `${select} AND (hd_phieu_dich_vu_id = ANY($3::text[]) OR so_chung_tu = ANY($3::text[]))`,
          [uuid, account, caseIds],
        )
      : await client.query(
          `${select}
          AND COALESCE(ngay_tiep_nhan, ngay_phat_sinh) >= $3::date
          AND COALESCE(ngay_tiep_nhan, ngay_phat_sinh) < ($4::date + interval '1 day')`,
          [uuid, account, from, to],
        );
    return res.rows[0] as Counts;
  };

  // Đọc: tìm UUID chi nhánh và đếm phiếu hiện có (không ghi)
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
      const uuid = found.rows[0].external_id as string;
      const before = await countCases(client, uuid);
      console.log(
        `[TRƯỚC] chi nhánh ${branchCode} (${found.rows[0].name}), ${scopeLabel}: phiếu=${before.total}, có số khung=${before.khung}, có đối tượng TT=${before.payer}`,
      );
      return { uuid };
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

    if (caseIds) {
      console.log(
        `[APPLY] syncCaseDetail ${caseIds.length} phiếu, concurrency=${concurrency}`,
      );
      let ok = 0;
      const failed: { id: string; error: string }[] = [];
      for (let i = 0; i < caseIds.length; i += concurrency) {
        const group = caseIds.slice(i, i + concurrency);
        await Promise.all(
          group.map(async (id) => {
            try {
              await sync.syncCaseDetail(branch.uuid, id, accountKey);
              ok++;
            } catch (error: any) {
              failed.push({ id, error: error?.message ?? String(error) });
            }
          }),
        );
      }
      console.log(
        `[APPLY] kết quả detail: ${JSON.stringify({ requested: caseIds.length, ok, failed: failed.length })}`,
      );
      for (const f of failed) console.log(`[LỖI] ${f.id}: ${f.error}`);
      if (failed.length > 0) process.exitCode = 1;
    } else {
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
        `[APPLY] syncCaseDetailsBatch (force) ${branchCode} ${from}→${to}, concurrency=${concurrency}`,
      );
      const detailResult = await sync.syncCaseDetailsBatch(branch.uuid, {
        from,
        to,
        force: true,
        concurrency,
        accountKey,
      });
      console.log(`[APPLY] kết quả detail: ${JSON.stringify(detailResult)}`);
    }
  } finally {
    await app.close();
  }

  // Kiểm tra sau ghi (chỉ đọc)
  await withPgSession(
    scriptEnv,
    getWriteGuard(scriptEnv, []),
    async (client) => {
      const after = await countCases(client, branch.uuid);
      console.log(
        `[SAU] phiếu=${after.total}, có số khung=${after.khung}, có đối tượng TT=${after.payer}`,
      );
    },
  );
}

main().catch((error) => {
  console.error('sync-branch-period failed:', error?.stack ?? error);
  process.exit(1);
});
