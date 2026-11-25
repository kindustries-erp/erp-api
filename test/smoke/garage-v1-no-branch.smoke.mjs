// Smoke Garage V1 không còn phụ thuộc chi nhánh KGara ở luồng đọc, báo cáo, công nợ.
// Kiểm: không gửi header vẫn 200 và trả toàn bộ phiếu; gửi header cũ (`x-greenway-branch-id`)
// không đổi kết quả; lọc phân loại OJ chạy được; 3 endpoint gọi thẳng KGara vẫn đòi header.
// Chỉ đọc, không ghi DB. Không chạy production.
// Env: E2E_API_URL (mặc định suy từ PORT), E2E_TAO_EMAIL, E2E_PASSWORD (bắt buộc),
//   E2E_KGARA_BRANCH_ID (tùy chọn: externalId chi nhánh KGara để thử header cũ),
//   E2E_V1_EXPECTED_CASES (tùy chọn: tổng phiếu kỳ vọng, đối chiếu với SQL).
import { resolveApiUrl } from './e2e-ports.mjs';

const BASE = resolveApiUrl();
const EMAIL = process.env.E2E_TAO_EMAIL ?? 'ai-test-admin@example.com';
const PASSWORD = process.env.E2E_PASSWORD;
const KGARA_BRANCH = process.env.E2E_KGARA_BRANCH_ID;
const EXPECTED = process.env.E2E_V1_EXPECTED_CASES
  ? Number(process.env.E2E_V1_EXPECTED_CASES)
  : undefined;
if (!PASSWORD) {
  console.error('Thiếu E2E_PASSWORD.');
  process.exit(2);
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ` :: ${detail}`}`);
};
const short = (v) => JSON.stringify(v)?.slice(0, 200);

const login = await fetch(`${BASE}/api/v2/auth-sessions/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
if (login.status !== 200 && login.status !== 201) {
  console.error(`login -> ${login.status}`);
  process.exit(1);
}
const token = (await login.json()).data?.accessToken;

async function get(path, branch) {
  const r = await fetch(`${BASE}/api/v1/greenway${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...(branch ? { 'x-greenway-branch-id': branch } : {}),
    },
  });
  const data = await r.json().catch(() => null);
  return { status: r.status, d: data };
}
const totalOf = (r) => r.d?.pagination?.total ?? r.d?.total;

// 1. Danh sách phiếu
const all = await get('/cases?page=1&pageSize=1');
check(
  'cases không header → 200',
  all.status === 200,
  `${all.status} ${short(all.d)}`,
);
const allTotal = totalOf(all);
check('cases không header có phiếu', allTotal > 0, short(all.d?.pagination));
console.log(`  tổng phiếu (không header) = ${allTotal}`);
if (EXPECTED !== undefined) {
  check(`tổng phiếu = ${EXPECTED} (SQL)`, allTotal === EXPECTED, `${allTotal}`);
}

if (KGARA_BRANCH) {
  const withHeader = await get('/cases?page=1&pageSize=1', KGARA_BRANCH);
  check(
    'header KGara cũ không còn thu hẹp danh sách',
    totalOf(withHeader) === allTotal,
    `${totalOf(withHeader)} vs ${allTotal}`,
  );
}

const oj = await get(
  `/cases?page=1&pageSize=1&filtersStr=${encodeURIComponent(JSON.stringify({ classification: ['OJ'] }))}`,
);
check('lọc phân loại OJ → 200', oj.status === 200, `${oj.status}`);
console.log(`  phiếu OJ = ${totalOf(oj)}`);
check(
  'phiếu OJ ≤ tổng phiếu',
  totalOf(oj) >= 0 && totalOf(oj) <= allTotal,
  `${totalOf(oj)}`,
);

// 2. Các endpoint đọc khác: không header vẫn 200
const reads = [
  '/cases/column-options?column=classification&page=1&pageSize=20',
  '/cases/services?page=1&pageSize=1',
  '/cases/services/column-options?column=serviceType&page=1&pageSize=20',
  '/cases/gross-profit-report',
  '/cases/customers-debt?page=1&pageSize=1',
  '/cases/customers-debt/column-options?column=licensePlate&page=1&pageSize=20',
  '/payables/suppliers-debt?page=1&pageSize=1',
  '/payables/suppliers-debt/column-options?column=supplierName&page=1&pageSize=20',
  '/receivables',
  '/payables',
];
for (const path of reads) {
  const r = await get(path);
  check(
    `GET ${path.split('?')[0]} không header → 200`,
    r.status === 200,
    `${r.status} ${short(r.d)}`,
  );
}

// 3. Endpoint gọi thẳng KGara vẫn cần chi nhánh KGara
const dash = await get('/dashboard');
check(
  'dashboard (gọi thẳng KGara) không header → báo thiếu chi nhánh',
  dash.status === 200 && dash.d?.success === false,
  short(dash.d),
);

const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} PASS`);
process.exit(failed ? 1 : 0);
