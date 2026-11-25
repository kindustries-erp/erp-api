// Smoke phạm vi chi nhánh ERP của Garage V2 (header `x-erp-branch-id` không bắt buộc) và lọc phân loại OJ.
// Kiểm: không header = mọi chi nhánh; header lọc đúng chi nhánh; xe khác chi nhánh → 404; header sai UUID → 400;
// board/danh sách lọc `classification=OJ`; tạo xe NATIVE khi không chọn và khi có chọn chi nhánh;
// công nợ và thu chi V2 đọc được khi không gửi header. Chỉ chạy trên staging/dev, KHÔNG production.
// Xe NATIVE tạo ra được bỏ khỏi bảng và xóa mềm ở cuối.
// Env: E2E_API_URL (mặc định suy từ PORT), E2E_TAO_EMAIL, E2E_PASSWORD (bắt buộc),
//   E2E_ERP_BRANCH_IDS (bắt buộc, 2 id `branches_management` có xe, cách nhau dấu phẩy, ví dụ GR,GN),
//   E2E_OJ_BRANCH_ID (tùy chọn: chi nhánh mà mọi xe là OJ, ví dụ GN của tài khoản KGara OJ).
import { resolveApiUrl } from './e2e-ports.mjs';

const BASE = resolveApiUrl();
const EMAIL = process.env.E2E_TAO_EMAIL ?? 'ai-test-admin@example.com';
const PASSWORD = process.env.E2E_PASSWORD;
const BRANCHES = (process.env.E2E_ERP_BRANCH_IDS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const OJ_BRANCH = process.env.E2E_OJ_BRANCH_ID;
if (!PASSWORD || BRANCHES.length < 2) {
  console.error('Thiếu E2E_PASSWORD hoặc E2E_ERP_BRANCH_IDS (cần 2 chi nhánh).');
  process.exit(2);
}
const [BR_A, BR_B] = BRANCHES;
const tag = Date.now();
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

async function call(method, path, { branch, body } = {}) {
  const r = await fetch(`${BASE}/api/v2${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(branch ? { 'x-erp-branch-id': branch } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json().catch(() => null);
  return { status: r.status, d: data?.data ?? data };
}
const ok = (r) => r.status === 200 || r.status === 201;
const total = (r) => r.d?.pagination?.total;
const listTotal = async (query, branch) =>
  total(await call('GET', `/cases-garage?pageSize=1${query}`, { branch }));
const progressTotal = async (query, branch) =>
  total(
    await call('GET', `/cases-garage/progress?status=ALL&pageSize=1${query}`, {
      branch,
    }),
  );
const onBoard = async (id, query = '', branch) =>
  !!(
    await call('GET', `/cases-garage/workshop/board?pageSize=200${query}`, {
      branch,
    })
  ).d?.items?.some((x) => x.id === id);

// 1. Danh sách: không header = tổng các chi nhánh; có header thì chỉ chi nhánh đó.
const all = await listTotal('');
const a = await listTotal('', BR_A);
const b = await listTotal('', BR_B);
check('danh sách không header trả mọi chi nhánh (>= A + B)', all >= a + b && a > 0 && b > 0, `${all} / ${a} / ${b}`);
check('header lọc đúng chi nhánh (A < tổng, B < tổng)', a < all && b < all, `${all} / ${a} / ${b}`);

const bad = await call('GET', '/cases-garage?pageSize=1', { branch: 'khong-phai-uuid' });
check('header sai UUID → 400', bad.status === 400, `${bad.status}`);

// 2. Chi tiết: xe chi nhánh A đọc qua header B → 404; không header → 200.
const firstA = (await call('GET', '/cases-garage?pageSize=1', { branch: BR_A })).d?.items?.[0];
if (firstA) {
  const own = await call('GET', `/cases-garage/${firstA.id}`, { branch: BR_A });
  const other = await call('GET', `/cases-garage/${firstA.id}`, { branch: BR_B });
  const none = await call('GET', `/cases-garage/${firstA.id}`);
  check('chi tiết đúng chi nhánh → 200', own.status === 200, `${own.status}`);
  check('chi tiết khác chi nhánh → 404', other.status === 404, `${other.status}`);
  check('chi tiết không header → 200', none.status === 200, `${none.status}`);
} else {
  check('chi nhánh A có xe để kiểm chi tiết', false, 'không có xe');
}

// 3. Lọc phân loại OJ trên danh sách tiến độ.
const ojAll = await progressTotal('&classification=OJ');
const ojA = await progressTotal('&classification=OJ', BR_A);
const ojB = await progressTotal('&classification=OJ', BR_B);
check('tiến độ classification=OJ: không header = tổng A + B', ojAll >= ojA + ojB && ojAll > 0, `${ojAll} / ${ojA} / ${ojB}`);
if (OJ_BRANCH) {
  const ojBranchAll = await progressTotal('', OJ_BRANCH);
  const ojBranchOj = await progressTotal('&classification=OJ', OJ_BRANCH);
  check('chi nhánh tài khoản OJ: mọi xe là OJ', ojBranchAll > 0 && ojBranchAll === ojBranchOj, `${ojBranchAll} / ${ojBranchOj}`);
}

// 4. Tạo xe NATIVE không chi nhánh → branchId null; đưa lên board, lọc OJ.
const createdIds = [];
const created = await call('POST', '/cases-garage', {
  body: {
    licensePlate: `BRS-${tag % 100000}`,
    vehicleBrandName: 'VinFast',
    customerName: 'Smoke branch scope',
  },
});
const id = created.d?.id;
if (id) createdIds.push(id);
check('tạo xe NATIVE không chọn chi nhánh', ok(created) && !!id, short(created));
check('xe không chi nhánh có branchId null', created.d?.branchId === null, short(created.d?.branchId));

if (id) {
  const tr = await call('POST', '/cases-garage/workshop/track', { body: { caseId: id } });
  check('đưa xe vào bảng không header', ok(tr), short(tr));
  check('board không header thấy xe', await onBoard(id));
  check('board header chi nhánh A không thấy xe NULL chi nhánh', !(await onBoard(id, '', BR_A)));
  check('board classification=OJ chưa thấy xe (chưa phân loại)', !(await onBoard(id, '&classification=OJ')));
  const up = await call('PATCH', `/cases-garage/${id}`, { body: { classification: 'OJ' } });
  check('đặt phân loại OJ', ok(up), short(up));
  check('board classification=OJ thấy xe sau khi phân loại OJ', await onBoard(id, '&classification=OJ'));
  const un = await call('DELETE', `/cases-garage/workshop/track/${id}`);
  check('bỏ xe khỏi bảng', ok(un), short(un));
}

// 5. Tạo xe NATIVE có chọn chi nhánh A → branchId = A; header B không sửa được.
const withBranch = await call('POST', '/cases-garage', {
  branch: BR_A,
  body: { licensePlate: `BRA-${tag % 100000}`, customerName: 'Smoke branch scope A' },
});
const idA = withBranch.d?.id;
if (idA) createdIds.push(idA);
check('tạo xe NATIVE có chi nhánh A → branchId = A', ok(withBranch) && withBranch.d?.branchId === BR_A, short(withBranch.d?.branchId));
if (idA) {
  const otherEdit = await call('PATCH', `/cases-garage/${idA}`, {
    branch: BR_B,
    body: { customerName: 'không được sửa' },
  });
  check('sửa xe chi nhánh A bằng header B → 404', otherEdit.status === 404, `${otherEdit.status}`);
}

// 6. Công nợ và thu chi V2 không cần header.
for (const path of [
  '/debts-garage/customers?pageSize=1',
  '/debts-garage/analytics',
  '/debts-garage/ledger?pageSize=1',
  '/cashflow-vouchers-garage?pageSize=1',
]) {
  const r = await call('GET', path);
  check(`GET ${path.split('?')[0]} không header → 200`, r.status === 200, `${r.status} ${short(r.d)}`);
}

// Dọn: xóa mềm xe đã tạo.
for (const cid of createdIds) {
  const del = await call('DELETE', `/cases-garage/${cid}`);
  check(`xóa mềm xe smoke ${cid.slice(0, 8)}`, ok(del), short(del));
}

const failed = results.filter((x) => !x).length;
console.log(`\nTOTAL ${results.length}, FAILED ${failed}`);
process.exit(failed ? 1 : 0);
