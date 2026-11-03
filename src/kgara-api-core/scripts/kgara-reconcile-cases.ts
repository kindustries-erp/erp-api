/**
 * kgara-reconcile-cases.ts
 *
 * Đối chiếu phiếu dịch vụ và dòng chi tiết giữa Kgara live và DB (kgara_cases / kgara_case_services).
 *
 * Mặc định là CHỈ ĐỌC: không ghi DB, không ghi kgara_auth (đăng nhập trực tiếp, token chỉ giữ trong bộ nhớ).
 *
 * --apply (backfill, chỉ chạy sau khi đã backup, migration đã áp dụng và anh duyệt báo cáo dry-run):
 *   1. Đổi account về MAIN cho phiếu OJ bị ghi đè (UUID thuộc Kgara MAIN).
 *   2. Chạy SyncCaseService của app: syncBranches (cả hai tài khoản), syncCasesForBranch (MAIN rồi OJ),
 *      syncCaseDetail cho các phiếu lệch dòng/tổng tiền. Mọi guard ghi đè chéo của sync vẫn áp dụng.
 *   Lưu ý: bước sync dùng kết nối riêng của app, không nằm trong một transaction của script.
 *   Phần không sửa được (phiếu OJ không thuộc Kgara) chỉ báo cáo, không xóa.
 *
 * Env: loader chuẩn (src/common/scripts/load-script-env.ts), bắt buộc chỉ định file tường minh:
 *   .env.greenway-production | --env=<file> | --target=<tenant>-<stage>
 *
 * Tham số:
 *   --from=YYYY-MM-DD      (mặc định 2026-01-01)
 *   --to=YYYY-MM-DD        (mặc định hôm nay)
 *   --account=MAIN|OJ|ALL  (mặc định ALL; --apply bắt buộc ALL)
 *   --out=<đường dẫn json> (tùy chọn, ghi báo cáo chi tiết)
 *   --apply                ghi DB (cần thêm --confirm=<tên DB> với production)
 *   --dry-run              ép chỉ đọc
 *
 * Cách chạy (trong thư mục erp-api):
 *   bun src/kgara-api-core/scripts/kgara-reconcile-cases.ts --target=greenway-production --account=ALL --out=/tmp/x.json
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  describeScriptEnv,
  getWriteGuard,
  resolveScriptEnv,
  ScriptEnv,
  ScriptEnvError,
  WriteGuard,
} from '../../common/scripts/load-script-env';
import { withPgSession } from '../../common/scripts/script-db';
import { KgaraAccountKey } from '../enums/kgara-account.enum';
import {
  buildGuidMap,
  KgaraReceivableRow,
  resolveCaseGuid,
} from '../helpers/kgara-case-identity.helper';
import {
  buildReconcileReport,
  DbCaseSnapshot,
  KgaraCaseSnapshot,
  ReconcileReport,
} from '../helpers/kgara-reconcile-report.helper';
import {
  OjDbCaseRow,
  planCorruptedRepairs,
  RepairPlan,
} from '../helpers/kgara-reconcile-repair.helper';

/* eslint-disable @typescript-eslint/no-require-imports -- nạp AppModule sau khi env đã được resolve */

type AccountKey = 'MAIN' | 'OJ';

const ACCOUNT_ENV: Record<
  AccountKey,
  { user: string; pass: string; makh: string }
> = {
  MAIN: {
    user: 'KGARA_USERNAME',
    pass: 'KGARA_PASSWORD',
    makh: 'KGARA_MA_KHACH_HANG',
  },
  OJ: {
    user: 'KGARA_USERNAME_2',
    pass: 'KGARA_PASSWORD_2',
    makh: 'KGARA_MA_KHACH_HANG_2',
  },
};

const argv = process.argv.slice(2);

function argValue(name: string, fallback: string): string {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

function todayIso(): string {
  return new Date().toLocaleDateString('en-CA');
}

function accountsFromArgs(): AccountKey[] {
  const value = argValue('account', 'ALL').toUpperCase();
  if (value === 'ALL') return ['MAIN', 'OJ'];
  if (value === 'MAIN' || value === 'OJ') return [value];
  throw new ScriptEnvError(
    `--account không hợp lệ: ${value} (MAIN | OJ | ALL)`,
  );
}

/** Đọc phiếu và dòng của một tài khoản trong khoảng ngày (theo ngày phát sinh). */
async function readDb(
  scriptEnv: ScriptEnv,
  guard: WriteGuard,
  account: AccountKey,
  from: string,
  to: string,
): Promise<DbCaseSnapshot[]> {
  const { result } = await withPgSession(scriptEnv, guard, async (client) => {
    const caseRows = await client.query(
      `SELECT c.hd_phieu_dich_vu_id, c.so_chung_tu, c.tien_co_thue
         FROM kgara_cases c
        WHERE c.account_key = $1
          AND COALESCE(c.ngay_phat_sinh, c.ngay_tiep_nhan)::date BETWEEN $2::date AND $3::date`,
      [account, from, to],
    );
    const lineRows = await client.query(
      `SELECT s.hd_phieu_dich_vu_id, s.hd_phieu_dich_vu_chi_tiet_id, s.tien_co_thue
         FROM kgara_case_services s
         JOIN kgara_cases c ON c.hd_phieu_dich_vu_id = s.hd_phieu_dich_vu_id
        WHERE c.account_key = $1
          AND COALESCE(c.ngay_phat_sinh, c.ngay_tiep_nhan)::date BETWEEN $2::date AND $3::date`,
      [account, from, to],
    );

    const linesByCase = new Map<string, { ids: string[]; sum: number }>();
    for (const row of lineRows.rows) {
      const bucket = linesByCase.get(row.hd_phieu_dich_vu_id) ?? {
        ids: [],
        sum: 0,
      };
      bucket.ids.push(row.hd_phieu_dich_vu_chi_tiet_id);
      bucket.sum += Number(row.tien_co_thue ?? 0);
      linesByCase.set(row.hd_phieu_dich_vu_id, bucket);
    }

    const cases: DbCaseSnapshot[] = caseRows.rows.map((row: any) => {
      const lines = linesByCase.get(row.hd_phieu_dich_vu_id);
      return {
        soChungTu: row.so_chung_tu,
        hdPhieuDichVuId: row.hd_phieu_dich_vu_id,
        tienCoThue: Number(row.tien_co_thue ?? 0),
        lineIds: lines?.ids ?? [],
        lineSum: lines?.sum ?? 0,
      };
    });
    return cases;
  });
  return result;
}

/** Phiếu đang gắn account OJ trong DB, dùng để tìm phiếu MAIN bị ghi đè. */
async function readOjCaseRows(
  scriptEnv: ScriptEnv,
  guard: WriteGuard,
): Promise<OjDbCaseRow[]> {
  const { result } = await withPgSession(scriptEnv, guard, async (client) => {
    const rows = await client.query(
      `SELECT hd_phieu_dich_vu_id, so_chung_tu FROM kgara_cases WHERE account_key = 'OJ'`,
    );
    return rows.rows.map((r: any) => ({
      hdPhieuDichVuId: r.hd_phieu_dich_vu_id,
      soChungTu: r.so_chung_tu,
    }));
  });
  return result;
}

/** Đăng nhập Kgara trực tiếp, không lưu token vào DB. */
async function kgaraLogin(
  scriptEnv: ScriptEnv,
  account: AccountKey,
): Promise<string> {
  const keys = ACCOUNT_ENV[account];
  const host = scriptEnv.config.KGARA_API_HOST;
  const response = await fetch(`https://${host}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      UserName: scriptEnv.config[keys.user],
      Password: scriptEnv.config[keys.pass],
      MaKhachHang: scriptEnv.config[keys.makh],
    }),
  });
  if (!response.ok) {
    throw new Error(
      `Đăng nhập Kgara ${account} thất bại: HTTP ${response.status}`,
    );
  }
  const body = await response.json();
  return body.AccessToken as string;
}

function kgaraClient(scriptEnv: ScriptEnv, token: string, branchId = '') {
  const host = scriptEnv.config.KGARA_API_HOST;
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (branchId) headers.SS_ClientID = branchId;
  return async (endpoint: string): Promise<any> => {
    const response = await fetch(`https://${host}${endpoint}`, { headers });
    if (!response.ok) {
      throw new Error(`${endpoint.split('?')[0]} HTTP ${response.status}`);
    }
    return response.json();
  };
}

async function fetchAllPages(
  get: (endpoint: string) => Promise<any>,
  path: string,
  from: string,
  to: string,
): Promise<any[]> {
  const rows: any[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const json = await get(
      `${path}?page=${page}&pageSize=200&sortDir=asc&from=${from}&to=${to}`,
    );
    rows.push(...(json?.data ?? []));
    totalPages = json?.pagination?.totalPages ?? 1;
    page++;
  } while (page <= totalPages);
  return rows;
}

interface KgaraReadResult {
  cases: KgaraCaseSnapshot[];
  /** Chi nhánh có vụ trong kỳ (đơn vị 404 như Root, HT không đưa vào) */
  branches: string[];
  /** Chi nhánh của từng phiếu, để sync chi tiết đúng đơn vị */
  branchByGuid: Map<string, string>;
  /** Phiếu không lấy được UUID hoặc chi tiết, không đưa vào so sánh */
  unresolved: string[];
  /** Chi tiết không có mảng ListPhieuDichVuChiTiet: không so sánh, không coi là 0 dòng */
  detailWithoutLines: string[];
}

async function readKgara(
  scriptEnv: ScriptEnv,
  account: AccountKey,
  from: string,
  to: string,
): Promise<KgaraReadResult> {
  const token = await kgaraLogin(scriptEnv, account);
  const result: KgaraReadResult = {
    cases: [],
    branches: [],
    branchByGuid: new Map(),
    unresolved: [],
    detailWithoutLines: [],
  };

  // Chi nhánh lấy trực tiếp từ Kgara (không đọc kgara_branches: hàng CN2 có thể đang mang account khác)
  const donVi = await kgaraClient(scriptEnv, token)('/api/v1/donvi/list');
  const allBranches: string[] = (
    Array.isArray(donVi) ? donVi : (donVi?.data ?? [])
  ).map((b: any) => b.DonViID);

  for (const branch of allBranches) {
    const get = kgaraClient(scriptEnv, token, branch);
    let listRows: any[];
    try {
      listRows = await fetchAllPages(get, '/api/v1/gr/cases/list', from, to);
    } catch (err) {
      // Đơn vị không có vụ (Root, HT) trả 404: bỏ qua, không coi là lỗi
      if (err instanceof Error && err.message.includes('HTTP 404')) continue;
      throw err;
    }
    if (listRows.length === 0) continue;
    result.branches.push(branch);

    const needsGuid = listRows.some((r) => !r.HdPhieuDichVuID);
    let guidMap = new Map<string, string>();
    if (needsGuid) {
      const receivables: KgaraReceivableRow[] = await fetchAllPages(
        get,
        '/api/v1/gr/exports/receivables',
        from,
        to,
      );
      guidMap = buildGuidMap(receivables);
    }

    for (const row of listRows) {
      const guid = resolveCaseGuid(row, guidMap);
      if (!guid) {
        result.unresolved.push(row.SoChungTu);
        continue;
      }
      let detail: any;
      try {
        detail = await get(`/api/v1/gr/cases/detail?id=${guid}`);
      } catch {
        result.unresolved.push(row.SoChungTu);
        continue;
      }
      const data = detail?.data;
      const lines = data?.ListPhieuDichVuChiTiet;
      if (!Array.isArray(lines)) {
        result.detailWithoutLines.push(row.SoChungTu);
        continue;
      }
      result.cases.push({
        soChungTu: row.SoChungTu,
        hdPhieuDichVuId: guid,
        tienCoThue: Number(data.TienCoThue ?? row.TienCoThue ?? 0),
        lineIds: lines.map((l: any) => String(l.HdPhieuDichVuChiTietID)),
        lineSum: lines.reduce(
          (s: number, l: any) => s + Number(l.TienCoThue ?? 0),
          0,
        ),
      });
      result.branchByGuid.set(guid, branch);
    }
  }
  return result;
}

function printSummary(
  account: AccountKey,
  report: ReconcileReport,
  kg: KgaraReadResult,
) {
  const { totals } = report;
  console.log(`\n=== ${account} ===`);
  console.log(`Kgara phiếu so sánh được : ${report.kgaraCases}`);
  console.log(`DB phiếu trong kỳ         : ${report.dbCases}`);
  console.log(`Có ở Kgara, thiếu DB      : ${report.kgaraOnly.length}`);
  console.log(`Có ở DB, không ở Kgara    : ${report.dbOnly.length}`);
  console.log(`Phiếu lệch số dòng        : ${report.lineMismatchCases.length}`);
  console.log(
    `Phiếu lệch tổng tiền      : ${report.totalMismatchCases.length}`,
  );
  console.log(
    `Dòng Kgara / DB           : ${totals.kgaraLines} / ${totals.dbLines}`,
  );
  console.log(`Dòng thiếu trong DB       : ${totals.missingInDb}`);
  console.log(`Dòng thừa trong DB        : ${totals.extraInDb}`);
  console.log(`Không resolve được UUID   : ${kg.unresolved.length}`);
  console.log(`Chi tiết thiếu mảng dòng  : ${kg.detailWithoutLines.length}`);
  const sample = (label: string, codes: string[]) => {
    if (codes.length === 0) return;
    console.log(`${label} (tối đa 10): ${codes.slice(0, 10).join(', ')}`);
  };
  sample('Unresolved', kg.unresolved);
  sample('Chi tiết thiếu mảng', kg.detailWithoutLines);
  sample(
    'Thiếu DB',
    report.kgaraOnly.map((c) => c.soChungTu),
  );
  sample(
    'Thừa DB',
    report.dbOnly.map((c) => c.soChungTu),
  );
}

/** Dừng nếu DB chưa có cột của migration 1786400000000 (apply sẽ lỗi hoặc ghi sai). */
async function assertMigrationApplied(scriptEnv: ScriptEnv): Promise<void> {
  const guard = getWriteGuard(scriptEnv, []);
  const { result } = await withPgSession(scriptEnv, guard, async (client) => {
    const rows = await client.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'kgara_case_services' AND column_name IN ('account_key', 'deleted_at')`,
    );
    return rows.rows.length;
  });
  if (result < 2) {
    throw new ScriptEnvError(
      'DB chưa có cột account_key/deleted_at trên kgara_case_services: chạy migration 1786400000000 trước.',
    );
  }
}

/** Chạy apply: đổi account phiếu bị ghi đè, rồi sync bằng SyncCaseService của app. */
async function runApply(
  scriptEnv: ScriptEnv,
  guard: WriteGuard,
  plan: RepairPlan,
  kgara: Record<AccountKey, KgaraReadResult>,
  detailTargets: { guid: string; branch: string }[],
  from: string,
  to: string,
): Promise<void> {
  if (plan.toMain.length > 0) {
    const { result } = await withPgSession(scriptEnv, guard, async (client) => {
      const res = await client.query(
        `UPDATE kgara_cases SET account_key = $1
          WHERE hd_phieu_dich_vu_id = ANY($2::text[]) AND account_key = $3`,
        ['MAIN', plan.toMain, 'OJ'],
      );
      return res.rowCount;
    });
    console.log(`[APPLY] Đổi account OJ → MAIN cho ${result} phiếu bị ghi đè.`);
  }

  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require('../../app.module');
  const { SyncCaseService } = require('../services/sync-case.service');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const sync = app.get(SyncCaseService);
    for (const account of [KgaraAccountKey.MAIN, KgaraAccountKey.OJ]) {
      const key: AccountKey = account === KgaraAccountKey.MAIN ? 'MAIN' : 'OJ';
      await sync.syncBranches(account);
      for (const branch of kgara[key].branches) {
        console.log(`[APPLY] syncCasesForBranch ${key} ${branch}`);
        await sync.syncCasesForBranch(branch, from, to, undefined, account);
      }
    }
    for (const target of detailTargets) {
      console.log(`[APPLY] syncCaseDetail MAIN ${target.guid}`);
      await sync.syncCaseDetail(
        target.branch,
        target.guid,
        KgaraAccountKey.MAIN,
      );
    }
  } finally {
    await app.close();
  }
}

async function main(): Promise<void> {
  console.log(
    '================================================================',
  );
  console.log('ĐỐI CHIẾU KGARA LIVE VỚI DB');
  console.log(
    '================================================================',
  );

  const scriptEnv = resolveScriptEnv({ argv });
  const guard = getWriteGuard(scriptEnv, argv);
  console.log(describeScriptEnv(scriptEnv, guard));

  if (!scriptEnv.explicit) {
    throw new ScriptEnvError(
      'Chỉ định env tường minh (.env.greenway-production hoặc --target=...). Không dùng .env mặc định.',
    );
  }
  if (argv.includes('--apply') && !guard.allowed) {
    throw new ScriptEnvError(guard.message);
  }

  const from = argValue('from', '2026-01-01');
  const to = argValue('to', todayIso());
  const accounts = accountsFromArgs();
  if (guard.apply && accounts.length !== 2) {
    throw new ScriptEnvError(
      '--apply cần --account=ALL (kế hoạch sửa cần cả hai tài khoản).',
    );
  }
  console.log(`Kỳ đối chiếu: ${from} → ${to}`);
  console.log(`Tài khoản   : ${accounts.join(', ')}`);

  const out: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    from,
    to,
  };
  const kgara = {} as Record<AccountKey, KgaraReadResult>;
  for (const account of accounts) {
    const dbCases = await readDb(scriptEnv, guard, account, from, to);
    kgara[account] = await readKgara(scriptEnv, account, from, to);
    const report = buildReconcileReport(dbCases, kgara[account].cases);
    printSummary(account, report, kgara[account]);
    out[account] = {
      report,
      unresolved: kgara[account].unresolved,
      detailWithoutLines: kgara[account].detailWithoutLines,
    };
  }

  let plan: RepairPlan | null = null;
  if (accounts.length === 2) {
    const ojRows = await readOjCaseRows(scriptEnv, guard);
    const mainGuids = new Set(kgara.MAIN.cases.map((c) => c.hdPhieuDichVuId));
    const ojGuids = new Set(kgara.OJ.cases.map((c) => c.hdPhieuDichVuId));
    plan = planCorruptedRepairs(ojRows, mainGuids, ojGuids);
    console.log(`\n=== KẾ HOẠCH SỬA PHIẾU BỊ GHI ĐÈ ===`);
    console.log(`Đổi OJ → MAIN (UUID thuộc Kgara MAIN): ${plan.toMain.length}`);
    console.log(
      `Không thuộc Kgara MAIN/OJ (chỉ báo cáo): ${plan.staleOj.length}`,
    );
    if (plan.staleOj.length > 0) {
      console.log(`Chỉ báo cáo: ${plan.staleOj.join(', ')}`);
    }
    out.plan = plan;
  }

  if (guard.apply) {
    await assertMigrationApplied(scriptEnv);
    const mismatchGuids = new Set<string>();
    const mainReport = out.MAIN as { report?: ReconcileReport } | undefined;
    for (const c of mainReport?.report?.lineMismatchCases ?? [])
      mismatchGuids.add(c.hdPhieuDichVuId);
    for (const c of mainReport?.report?.totalMismatchCases ?? [])
      mismatchGuids.add(c.hdPhieuDichVuId);
    const detailTargets = [...mismatchGuids]
      .map((guid) => ({
        guid,
        branch: kgara.MAIN.branchByGuid.get(guid) ?? '',
      }))
      .filter((t) => t.branch !== '');
    await runApply(
      scriptEnv,
      guard,
      plan ?? { toMain: [], staleOj: [] },
      kgara,
      detailTargets,
      from,
      to,
    );

    console.log('\n=== KIỂM TRA SAU APPLY (CHỈ ĐỌC) ===');
    for (const account of accounts) {
      const dbCases = await readDb(
        scriptEnv,
        getWriteGuard(scriptEnv, []),
        account,
        from,
        to,
      );
      const kg = await readKgara(scriptEnv, account, from, to);
      printSummary(account, buildReconcileReport(dbCases, kg.cases), kg);
    }
  } else {
    console.log(
      '\nDRY-RUN: không có gì được ghi vào DB. Thêm --apply --confirm=<tên DB> để sửa.',
    );
  }

  const outFile = argValue('out', '');
  if (outFile) {
    const target = path.resolve(process.cwd(), outFile);
    fs.writeFileSync(target, JSON.stringify(out, null, 2));
    console.log(`\nBáo cáo chi tiết: ${target}`);
  }
}

main().catch((err) => {
  console.error(`\n❌ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
