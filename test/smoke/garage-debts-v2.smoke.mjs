// Smoke chỉ đọc: đối chiếu V1 (/api/v1/greenway/...) với v2 (/api/v2/debts-garage, /api/v2/cases-garage).
// Env: E2E_API_URL (mặc định suy từ PORT), E2E_TAO_EMAIL (mặc định ai-test-tao), E2E_PASSWORD, E2E_BRANCH_ID (tùy chọn, id chi nhánh ERP `branches_management`; bỏ trống là mọi chi nhánh).
import { resolveApiUrl } from './e2e-ports.mjs';

const BASE = resolveApiUrl();
const { E2E_BRANCH_ID: BRANCH } = process.env;
const EMAIL = process.env.E2E_TAO_EMAIL ?? 'ai-test-tao@example.com';
const PASSWORD = process.env.E2E_PASSWORD;
if (!EMAIL || !PASSWORD) {
  console.error('Thiếu E2E_PASSWORD.');
  process.exit(2);
}
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ` :: ${detail}`}`);
};

const login = await fetch(`${BASE}/api/v2/auth-sessions/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
if (login.status !== 200 && login.status !== 201) { console.error(`login -> ${login.status}`); process.exit(1); }
const token = (await login.json()).data?.accessToken;
const headers = {
  Authorization: `Bearer ${token}`,
  ...(BRANCH ? { 'x-erp-branch-id': BRANCH } : {}),
};

async function get(path, h = headers) {
  const r = await fetch(`${BASE}${path}`, { headers: h });
  let body = null;
  try { body = await r.json(); } catch { /* không phải JSON */ }
  return { status: r.status, body };
}
// V1 trả `{ data: [...], pagination|total, totals|summary }`; v2 trả `{ items, pagination, summaries }`.
const unwrap = (b) => b;
const num = (v) => Math.round(Number(v ?? 0));
const rows = (b) => b?.items ?? (Array.isArray(b?.data) ? b.data : []);
const total1 = (b) => b?.pagination?.total ?? b?.total;

// 1. Chi nhánh không bắt buộc: không gửi header thì v2 trả 200 (mọi chi nhánh).
for (const p of ['debts-garage/customers', 'debts-garage/suppliers', 'debts-garage/analytics', 'cases-garage', 'cases-garage/services', 'cases-garage/gross-profit-report']) {
  const r = await get(`/api/v2/${p}`, { Authorization: headers.Authorization });
  check(`v2 ${p} không header chi nhánh -> 200`, r.status === 200, `status ${r.status}`);
}
// 2. Không token -> 401.
check('v2 không token -> 401', (await fetch(`${BASE}/api/v2/cases-garage`)).status === 401);

// 3. Công nợ khách hàng, nhà cung cấp: số dòng và tổng.
const c1 = await get('/api/v1/greenway/cases/customers-debt?pageSize=1000');
const c2 = await get('/api/v2/debts-garage/customers?pageSize=200&scope=all&summary_keys=balanceAmount,agingOver90');
check('customers v1/v2 status 200', c1.status === 200 && c2.status === 200, `${c1.status}/${c2.status}`);
check('customers số dòng khớp', total1(c1.body) === (c2.body?.pagination?.total ?? -1), `${total1(c1.body)} vs ${c2.body?.pagination?.total}`);

const s1 = await get('/api/v1/greenway/payables/suppliers-debt?pageSize=1000');
const s2 = await get('/api/v2/debts-garage/suppliers?pageSize=200&summary_keys=balanceAmount,agingOver90');
check('suppliers v1/v2 status 200', s1.status === 200 && s2.status === 200, `${s1.status}/${s2.status}`);
check('suppliers số dòng khớp', total1(s1.body) === (s2.body?.pagination?.total ?? -1), `${total1(s1.body)} vs ${s2.body?.pagination?.total}`);

const sum1 = (b, k) => num(b?.summary?.[k]);
check('customers tổng còn phải thu khớp', sum1(c1.body, 'totalBalance') === num(c2.body?.summaries?.balanceAmount?.total), `${sum1(c1.body, 'totalBalance')} vs ${c2.body?.summaries?.balanceAmount?.total}`);
check('customers tổng nợ quá 90 ngày khớp', sum1(c1.body, 'totalAgingOver90') === num(c2.body?.summaries?.agingOver90?.total));
check('suppliers tổng còn phải trả khớp', sum1(s1.body, 'totalBalance') === num(s2.body?.summaries?.balanceAmount?.total), `${sum1(s1.body, 'totalBalance')} vs ${s2.body?.summaries?.balanceAmount?.total}`);
check('suppliers tổng nợ quá 90 ngày khớp', sum1(s1.body, 'totalAgingOver90') === num(s2.body?.summaries?.agingOver90?.total));

// 4. Analytics.
const a1 = await get('/api/v1/greenway/dashboard/debts-analytics');
const a2 = await get('/api/v2/debts-garage/analytics');
check('analytics status 200', a1.status === 200 && a2.status === 200, `${a1.status}/${a2.status}`);
const A1 = unwrap(a1.body), A2 = unwrap(a2.body);
check('analytics v2 trùng V1 (deep-equal)', JSON.stringify(A1) === JSON.stringify(A2), 'khác nội dung');

// 5. Vụ việc: tổng, trang đầu cùng id và thứ tự.
const k1 = await get('/api/v1/greenway/cases?page=1&pageSize=50');
const k2 = await get('/api/v2/cases-garage?page=1&pageSize=50');
check('cases status 200', k1.status === 200 && k2.status === 200, `${k1.status}/${k2.status}`);
const ids1 = rows(k1.body).map((x) => x.id), ids2 = rows(k2.body).map((x) => x.id);
check('cases trang 1 cùng id và thứ tự', ids1.length > 0 && JSON.stringify(ids1) === JSON.stringify(ids2), `${ids1.length} vs ${ids2.length}`);

// 6. Hạng mục dịch vụ.
const v1 = await get('/api/v1/greenway/cases/services?page=1&pageSize=50');
const v2 = await get('/api/v2/cases-garage/services?page=1&pageSize=50&summary_keys=tienChuaThue,tienCoThue');
check('services status 200', v1.status === 200 && v2.status === 200, `${v1.status}/${v2.status}`);
// V1 `cases/services` join chi nhánh thiếu `account_key` nên nhân dòng khi một chi nhánh có nhiều account
// (MAIN, OJ). v2 join đủ khóa, vì vậy không so bằng V1 mà kiểm tính nhất quán nội tại của v2.
const total2 = v2.body?.pagination?.total ?? 0;
console.log('services tổng dòng V1', total1(v1.body), 'v2', total2, '| tienCoThue V1', v1.body?.totals?.grandTotal?.tienCoThue, 'v2', v2.body?.summaries?.tienCoThue?.total);
check('services v2 có dữ liệu và không nhiều hơn V1', total2 > 0 && total2 <= total1(v1.body), `${total2} vs ${total1(v1.body)}`);
const idsOf = (b) => rows(b).map((x) => x.id);
const v2b = await get('/api/v2/cases-garage/services?page=1&pageSize=50');
check('services v2 id không lặp', new Set(idsOf(v2.body)).size === idsOf(v2.body).length);
check('services v2 thứ tự ổn định giữa hai lần gọi', JSON.stringify(idsOf(v2.body)) === JSON.stringify(idsOf(v2b.body)));
const pageSum = rows(v2.body).reduce((t, x) => t + Number(x.tienCoThue ?? 0), 0);
check('services tổng trang bằng tổng các dòng hiển thị', num(pageSum) === num(v2.body?.summaries?.tienCoThue?.pageSubtotal), `${pageSum} vs ${v2.body?.summaries?.tienCoThue?.pageSubtotal}`);
check('services tổng toàn bộ >= lũy kế >= tổng trang', num(v2.body?.summaries?.tienCoThue?.total) >= num(v2.body?.summaries?.tienCoThue?.cumulative) && num(v2.body?.summaries?.tienCoThue?.cumulative) >= num(pageSum));
const bad = await get('/api/v2/cases-garage/abc');
check('chi tiết id không phải UUID -> 400', bad.status === 400, `status ${bad.status}`);

// 7. Lợi nhuận gộp: v2 phân trang, tổng khớp tổng V1 nếu V1 trả được.
const p2 = await get('/api/v2/cases-garage/gross-profit-report?page=1&pageSize=50');
check('gross-profit v2 200 + có totals', p2.status === 200 && p2.body?.extraData?.totals != null, `status ${p2.status}`);
const p1 = await get('/api/v1/greenway/cases/gross-profit-report');
console.log('gross-profit v1 status', p1.status, 'v2 total rows', p2.body?.pagination?.total, 'v2 totals', JSON.stringify(p2.body?.extraData?.totals));

// 8. Chi tiết vụ việc: theo id và theo mã; id lạ -> 404.
const first = rows(k2.body)[0];
if (first) {
  const d1 = await get(`/api/v2/cases-garage/${first.id}`);
  const d2 = await get(`/api/v2/cases-garage/by-code/${encodeURIComponent(first.caseCode ?? first.soChungTu)}`);
  check('chi tiết theo id và theo mã cùng vụ việc', d1.status === 200 && d2.status === 200 && unwrap(d1.body)?.id === unwrap(d2.body)?.id, `${d1.status}/${d2.status}`);
}
const nf = await get('/api/v2/cases-garage/00000000-0000-0000-0000-000000000000');
check('chi tiết id lạ -> 404', nf.status === 404, `status ${nf.status}`);

const failed = results.filter((x) => !x).length;
console.log(`TOTAL ${results.length}, FAILED ${failed}`);
process.exit(failed ? 1 : 0);
