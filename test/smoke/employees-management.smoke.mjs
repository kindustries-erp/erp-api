// Smoke API Employees V2 (chạy trên API đang chạy, không qua UI).
// Cấu hình qua biến môi trường (xem erp-api/.agents/skills/erp-e2e-api-smoke/SKILL.md):
//   E2E_API_URL        (mặc định suy từ PORT trong erp-api/.env, xem e2e-ports.mjs)
//   E2E_ADMIN_EMAIL    (BẮT BUỘC, tài khoản có quyền employees:read/create/update/delete)
//   E2E_ADMIN_PASSWORD (mặc định dùng E2E_PASSWORD)
// Tạo dữ liệu test có mã `SME<tag>`; xóa mềm cuối bài, CCCD test cũng được xóa theo.
// KHÔNG chạy trên DB production.
// Chạy: bun run test:smoke:employees
import { resolveApiUrl } from './e2e-ports.mjs';

const BASE = resolveApiUrl();
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD =
  process.env.E2E_ADMIN_PASSWORD ?? process.env.E2E_PASSWORD;
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Thiếu E2E_ADMIN_EMAIL hoặc E2E_PASSWORD/E2E_ADMIN_PASSWORD.');
  process.exit(2);
}
const V2 = `${BASE}/api/v2/employees`;
const results = [];
const tag = Date.now();
const CODE = `SME${tag}`;
// CCCD không được là chuỗi con của mã `SME<tag>`, để kiểm tra search không dò theo CCCD.
const NATIONAL_ID = `0${String(tag).split('').reverse().join('')}`.slice(0, 12);

async function raw(url, method, token, body) {
  const r = await fetch(url, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try {
    data = await r.json();
  } catch {
    data = null;
  }
  return { status: r.status, data };
}

const record = (step, status, expected, pass, message = '') =>
  results.push({
    step,
    status,
    expected,
    pass,
    message: String(message).slice(0, 80),
  });

async function call(token, method, path, body, expect) {
  const res = await raw(`${V2}${path}`, method, token, body);
  record(
    `${method} ${path.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, '<id>') || '/'}`,
    res.status,
    expect.join('|'),
    expect.includes(res.status),
    res.data?.message,
  );
  return res;
}

const check = (label, cond) => record(`CHECK ${label}`, '', 'true', !!cond);

const loginRes = await raw(`${BASE}/api/v1/auth/login`, 'POST', null, {
  email: ADMIN_EMAIL,
  password: ADMIN_PASSWORD,
});
if (loginRes.status !== 201) {
  console.error(`Đăng nhập admin thất bại: ${loginRes.status}`);
  process.exit(2);
}
const T = loginRes.data.accessToken;

// ---------- A. Đọc và hợp đồng ----------
const list = await call(T, 'GET', '?page=1&pageSize=5', undefined, [200]);
check(
  'list có items, pagination, không key phẳng total',
  Array.isArray(list.data?.items) &&
    list.data?.pagination?.total >= 0 &&
    list.data?.total === undefined,
);
await call(T, 'GET', '?column_filters={bad', undefined, [400]);
await call(T, 'GET', '/column-options?column=status', undefined, [200]);
await call(T, 'GET', '/not-a-uuid', undefined, [400]);
await call(null, 'GET', '', undefined, [401]);
const next = await call(T, 'GET', '/next-code', undefined, [200]);
check('next-code có nextCode', typeof next.data?.nextCode === 'string');

// ---------- B. Tạo, validate ----------
const birth = '1990-04-30T17:00:00.000Z'; // 01/05/1990 giờ VN
const created = await call(
  T,
  'POST',
  '',
  {
    employeeCode: CODE,
    fullName: `Smoke Employee ${tag}`,
    jobTitle: 'Kỹ thuật viên',
    department: 'Xưởng',
    birthDate: birth,
    nationalId: NATIONAL_ID,
  },
  [201],
);
const id = created.data?.data?.id;
check('tạo trả id', !!id);
check(
  'CCCD chỉ trả bản che',
  created.data?.data?.nationalIdMasked &&
    !JSON.stringify(created.data).includes(NATIONAL_ID),
);
check('birthDate giữ nguyên mốc ISO', created.data?.data?.birthDate === birth);
await call(T, 'POST', '', { employeeCode: CODE, fullName: 'Trùng mã' }, [409]);
await call(
  T,
  'POST',
  '',
  { fullName: 'Trùng CCCD', nationalId: NATIONAL_ID },
  [409],
);
await call(T, 'POST', '', { fullName: 'CCCD sai', nationalId: '123' }, [400]);
await call(
  T,
  'POST',
  '',
  {
    fullName: 'Chi nhánh lạ',
    branchId: '00000000-0000-4000-8000-000000000000',
  },
  [400],
);
await call(
  T,
  'POST',
  '',
  { fullName: 'Sinh tương lai', birthDate: '2999-01-01T00:00:00.000Z' },
  [400],
);

// ---------- C. Đọc lại, CCCD đầy đủ, lọc ----------
const got = await call(T, 'GET', `/${id}`, undefined, [200]);
check('GET :id đúng mã', got.data?.data?.employeeCode === CODE);
const nid = await call(T, 'GET', `/${id}/national-id`, undefined, [200]);
check(
  'national-id trả đầy đủ cho người có quyền sửa',
  nid.data?.data?.nationalId === NATIONAL_ID,
);
const found = await call(T, 'GET', `?search=${CODE}`, undefined, [200]);
check(
  'search theo mã tìm thấy',
  found.data?.items?.some((e) => e.id === id),
);
const byNid = await call(T, 'GET', `?search=${NATIONAL_ID}`, undefined, [200]);
check(
  'search không dò được theo CCCD',
  !byNid.data?.items?.some((e) => e.id === id),
);

// ---------- D. Sửa, xóa giá trị bằng null, trạng thái ----------
const upd = await call(
  T,
  'PATCH',
  `/${id}`,
  { jobTitle: null, department: 'Kho', extraData: { smoke: tag } },
  [200],
);
check('null xóa chức danh', upd.data?.data?.jobTitle == null);
check('extraData được merge', upd.data?.data?.extraData?.smoke === tag);
const off = await call(
  T,
  'POST',
  `/${id}/status`,
  { status: 'INACTIVE' },
  [200, 201],
);
check('nghỉ việc tự điền leaveDate', !!off.data?.data?.leaveDate);
const on = await call(
  T,
  'POST',
  `/${id}/status`,
  { status: 'ACTIVE' },
  [200, 201],
);
check('đi làm lại xóa leaveDate', on.data?.data?.leaveDate == null);
await call(T, 'POST', `/${id}/status`, { status: 'LAC' }, [400]);

// ---------- E. Xóa mềm, dùng lại mã ----------
await call(T, 'DELETE', `/${id}`, undefined, [200]);
await call(T, 'GET', `/${id}`, undefined, [404]);
const reuse = await call(
  T,
  'POST',
  '',
  { employeeCode: CODE, fullName: 'Dùng lại mã' },
  [201],
);
await call(T, 'DELETE', `/${reuse.data?.data?.id}`, undefined, [200]);

// ---------- Báo cáo ----------
console.table(results);
const failed = results.filter((r) => !r.pass);
console.log(
  `\nSmoke employees: ${results.length - failed.length}/${results.length} PASS`,
);
console.log(`Dữ liệu test đã xóa mềm: mã ${CODE}, CCCD ${NATIONAL_ID}`);
process.exitCode = failed.length ? 1 : 0;
