// Smoke KINDU-1623 (CHỈ staging/dev): (A) ngày V2 = giờ VN của V1 sau sync, (B) Excel hạng mục tách sheet công/OJ.
// A ghi DB staging qua `POST sync/gross-profit` (chiếu lại V2). Từ chối DB chứa "prod".
// Env: E2E_API_URL (mặc định suy từ PORT), E2E_PASSWORD (đọc từ .env nếu shell chưa có),
//      SMOKE_FROM / SMOKE_TO (mặc định 2026-10-01..2026-10-31), SMOKE_ACCOUNT (mặc định MAIN).
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { resolveApiUrl } from './e2e-ports.mjs';

const envText = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../.env'),
  'utf8',
);
const envVar = (k) =>
  envText
    .match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]
    ?.trim()
    .replace(/^["']|["']$/g, '');

const dbUrl = envVar('DATABASE_URL') ?? '';
const dbName = dbUrl.split('?')[0].split('/').pop() ?? '';
if (!dbName || /prod/i.test(dbName)) {
  console.error(`Từ chối chạy: DB "${dbName}" không phải staging/dev.`);
  process.exit(2);
}
console.log(`DB: ${dbName}`);

const BASE = resolveApiUrl();
const PASSWORD = process.env.E2E_PASSWORD ?? envVar('E2E_PASSWORD');
if (!PASSWORD) {
  console.error('Thiếu E2E_PASSWORD.');
  process.exit(2);
}
const FROM = process.env.SMOKE_FROM ?? '2026-10-01';
const TO = process.env.SMOKE_TO ?? '2026-10-31';
const ACCOUNT = process.env.SMOKE_ACCOUNT ?? 'MAIN';

let fails = 0;
const check = (name, ok, detail = '') => {
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ` :: ${detail}`}`);
};

const db = new pg.Client({ connectionString: dbUrl });
await db.connect();
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];

// Phiếu V2 lệch so với giờ VN của V1 trong khoảng (theo ngày VN của V1).
const MISMATCH_SQL = `
  select count(*)::int n from cases_garage c join kgara_cases k on k.id = c.id
  where k.ngay_phat_sinh is not null
    and k.ngay_phat_sinh >= $1::date and k.ngay_phat_sinh < ($2::date + 1)
    and c.issued_at is distinct from (k.ngay_phat_sinh at time zone 'Asia/Ho_Chi_Minh')`;
const OUTSIDE_SQL = `
  select count(*)::int n from cases_garage c join kgara_cases k on k.id = c.id
  where k.ngay_phat_sinh is not null
    and (k.ngay_phat_sinh < $1::date or k.ngay_phat_sinh >= ($2::date + 1))
    and c.issued_at is distinct from (k.ngay_phat_sinh at time zone 'Asia/Ho_Chi_Minh')`;

const login = await fetch(`${BASE}/api/v2/auth-sessions/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'ai-test-admin@example.com',
    password: PASSWORD,
  }),
});
if (![200, 201].includes(login.status)) {
  console.error(`login -> ${login.status}`);
  process.exit(1);
}
const auth = { Authorization: `Bearer ${(await login.json()).data?.accessToken}` };
const br = await (await fetch(`${BASE}/api/v1/greenway/branches`, { headers: auth })).json();
const H = { ...auth, 'x-kgara-branch-id': (br.data ?? br)?.[0]?.externalId };

// ---- A. Ngày V2 theo giờ VN ----
const before = await one(MISMATCH_SQL, [FROM, TO]);
const outsideBefore = await one(OUTSIDE_SQL, [FROM, TO]);
console.log(`A. lệch trước sync trong ${FROM}..${TO}: ${before.n}; ngoài khoảng: ${outsideBefore.n}`);

// sync/gross-profit chỉ chiếu V2 khi số liệu giá vốn đổi; muốn chiếu lại ngày thì sync chi tiết từng phiếu lệch.
const mism = (
  await db.query(
    `select k.id from cases_garage c join kgara_cases k on k.id = c.id
     where k.ngay_phat_sinh >= $1::date and k.ngay_phat_sinh < ($2::date + 1)
       and c.issued_at is distinct from (k.ngay_phat_sinh at time zone 'Asia/Ho_Chi_Minh')
     limit $3`,
    [FROM, TO, Number(process.env.SMOKE_MAX ?? 60)],
  )
).rows;
let syncFail = 0;
for (const { id } of mism) {
  const r = await fetch(`${BASE}/api/v1/greenway/sync/cases/${id}/detail`, { method: 'POST', headers: H });
  const body = await r.json().catch(() => null);
  if (r.status >= 300 || body?.success === false) {
    syncFail++;
    console.log('SYNC FAIL', id, r.status, JSON.stringify(body)?.slice(0, 160));
  }
}
console.log(`SYNC chi tiết ${mism.length} phiếu, lỗi ${syncFail}`);
check('sync chi tiết không lỗi', syncFail === 0, `${syncFail} lỗi`);

const after = await one(MISMATCH_SQL, [FROM, TO]);
const outsideAfter = await one(OUTSIDE_SQL, [FROM, TO]);
check('A1. V2 issued_at = giờ VN của V1 trong khoảng sau sync', after.n === 0, `còn ${after.n} lệch`);
check('A2. phiếu ngoài khoảng không bị đổi', outsideAfter.n === outsideBefore.n, `${outsideBefore.n} -> ${outsideAfter.n}`);

// Lọc ngày V2 theo ngày VN: phiếu phát sinh trong ngày D (VN) phải xuất hiện khi lọc date_from=date_to=D.
const sample = await one(
  `select to_char(k.ngay_phat_sinh,'YYYY-MM-DD') d, c.case_code as code
   from cases_garage c join kgara_cases k on k.id = c.id
   where k.ngay_phat_sinh >= $1::date and k.ngay_phat_sinh < ($2::date + 1)
     and extract(hour from k.ngay_phat_sinh) < 7 order by k.ngay_phat_sinh limit 1`,
  [FROM, TO],
);
if (sample) {
  const r = await (
    await fetch(`${BASE}/api/v2/cases-garage?date_from=${sample.d}&date_to=${sample.d}&search=${encodeURIComponent(sample.code)}&pageSize=50`, { headers: H })
  ).json().catch(() => null);
  const items = r?.data?.items ?? r?.items ?? r?.data ?? [];
  check(`A3. lọc ngày VN ${sample.d} thấy phiếu ${sample.code} (phát sinh trước 07:00)`, items.some((i) => (i.caseCode ?? i.code ?? i.soChungTu) === sample.code), JSON.stringify(r)?.slice(0, 200));
} else {
  console.log('SKIP A3: không có phiếu phát sinh trước 07:00 trong khoảng');
}

// ---- B. Excel hạng mục tách sheet ----
const ex = await fetch(`${BASE}/api/v1/greenway/cases/services/export/excel?from=${FROM}&to=${TO}`, { headers: H });
check('B0. export 200', ex.status === 200, `status ${ex.status}`);
if (ex.status === 200) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await ex.arrayBuffer()));
  const NAMES = ['Chi tiết DV & Phụ tùng', 'Chi tiết Công', 'Chi tiết DV & PT (OJ)', 'Chi tiết Công (OJ)'];
  const names = wb.worksheets.map((w) => w.name);
  console.log('Sheets:', names.join(' | '));
  check('B1. sheet chính luôn có', names.includes(NAMES[0]));
  check('B2. chỉ có tên sheet chuẩn', names.every((n) => NAMES.includes(n)), names.join(','));
  const isLabor = (u) => /^cong(\s|$)|\bgio cong\b/.test(String(u ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().trim());
  const val = (c) => (c && typeof c === 'object' && 'result' in c ? c.result : c);
  let total = 0;
  for (const ws of wb.worksheets) {
    const head = ws.getRow(4).values;
    const iU = head.findIndex((h) => String(h ?? '').trim() === 'ĐVT');
    const iNo = head.findIndex((h) => String(h ?? '').trim() === 'Số phiếu DV');
    let n = 0, wrong = 0, ojWrong = 0;
    ws.eachRow((row, i) => {
      if (i <= 4) return;
      const no = String(val(row.getCell(iNo).value) ?? '');
      if (!no.startsWith('GR-') && !no.startsWith('GN-')) return; // bỏ dòng tổng
      n++;
      const labor = isLabor(val(row.getCell(iU).value));
      if (labor !== ws.name.includes('Công')) wrong++;
      if (no.startsWith('GN-') !== ws.name.includes('(OJ)')) ojWrong++;
    });
    total += n;
    console.log(`  ${ws.name}: ${n} dòng`);
    check(`B3. "${ws.name}" đúng nhóm công/không công`, wrong === 0, `${wrong} dòng sai`);
    check(`B4. "${ws.name}" đúng nhóm MAIN/OJ (theo tiền tố GR-/GN-)`, ojWrong === 0, `${ojWrong} dòng sai`);
  }
  const api = await (await fetch(`${BASE}/api/v1/greenway/cases/services?from=${FROM}&to=${TO}&page=1&pageSize=1`, { headers: H })).json().catch(() => null);
  const apiTotal = api?.total ?? api?.data?.total ?? api?.meta?.total;
  if (apiTotal != null) check('B5. tổng dòng các sheet = tổng dòng API', total === Number(apiTotal), `${total} vs ${apiTotal}`);
  else console.log(`SKIP B5: không đọc được total từ API (tổng sheet = ${total})`);
}

await db.end();
console.log(fails ? `\n${fails} FAIL` : '\nALL PASS');
process.exit(fails ? 1 : 0);
