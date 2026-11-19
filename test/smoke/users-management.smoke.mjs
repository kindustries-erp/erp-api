// Smoke API Users V2 (chạy trên API đang chạy, không qua UI).
// Cấu hình qua biến môi trường (xem erp-api/.agents/skills/erp-e2e-api-smoke/SKILL.md):
//   E2E_API_URL        (mặc định suy từ PORT trong erp-api/.env, xem e2e-ports.mjs)
//   E2E_TAO_EMAIL     (mặc định ai-test-tao@example.com; tài khoản người tạo)
//   E2E_PASSWORD      (BẮT BUỘC, mật khẩu tài khoản ai-test-*)
// Tạo dữ liệu test có tiền tố `smoke-users-` (email) và `SMK` (mã nhân viên); không có API xóa,
// nên dọn bằng SQL sau khi chạy. KHÔNG chạy trên DB production.
// Chạy: bun run test:smoke:users
import { resolveApiUrl } from './e2e-ports.mjs';

const BASE = resolveApiUrl();
const ADMIN_EMAIL = process.env.E2E_TAO_EMAIL ?? 'ai-test-tao@example.com';
const ADMIN_PASSWORD =
  process.env.E2E_PASSWORD;
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Thiếu E2E_PASSWORD.');
  process.exit(2);
}
const V1 = `${BASE}/api/v1`;
const V2 = `${BASE}/api/v2/users-management`;
const results = [];
const tag = Date.now();
const PASSWORD_A = `Smoke#${tag}a`;
const PASSWORD_A2 = `Smoke#${tag}b`;

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

const check = (label, cond, extra = '') =>
  record(`CHECK ${label}`, '', 'true', !!cond, extra);

async function login(email, password) {
  const res = await raw(`${BASE}/api/v2/auth-sessions/login`, 'POST', null, { email, password });
  return {
    status: res.status,
    token: res.data?.data?.accessToken,
    user: res.data?.data?.user,
  };
}

const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
if (admin.status !== 201) {
  console.error(`Đăng nhập admin thất bại: ${admin.status}`);
  process.exit(2);
}
const T = admin.token;

// ---------- A. Đọc, lọc, hợp đồng ----------
const list = await call(T, 'GET', '?page=1&pageSize=5', undefined, [200]);
check(
  'list có items và pagination (không key phẳng total)',
  Array.isArray(list.data?.items) &&
    list.data?.pagination?.total >= 0 &&
    list.data?.total === undefined,
);
check(
  'list không lộ passwordHash',
  !JSON.stringify(list.data).includes('passwordHash'),
);
await call(T, 'GET', '?column_filters={bad', undefined, [400]);
await call(T, 'GET', '/column-options?column=status', undefined, [200]);
await call(T, 'GET', '/not-a-uuid', undefined, [400]);
await call(null, 'GET', '', undefined, [401]);

// ---------- B. Tạo tài khoản, kiểm tra DTO ----------
const emailA = `smoke-users-${tag}-a@example.com`;
const emailB = `smoke-users-${tag}-b@example.com`;
const created = await call(
  T,
  'POST',
  '',
  { email: emailA.toUpperCase(), password: PASSWORD_A },
  [201],
);
const idA = created.data?.data?.id;
check('email được chuẩn hóa chữ thường', created.data?.data?.email === emailA);
check(
  'create không trả passwordHash',
  !JSON.stringify(created.data).includes('passwordHash'),
);
await call(T, 'POST', '', { email: emailA, password: PASSWORD_A }, [409]);
await call(
  T,
  'POST',
  '',
  { email: 'khong-phai-email', password: PASSWORD_A },
  [400],
);
await call(
  T,
  'POST',
  '',
  { email: `smoke-users-${tag}-x@example.com`, password: 'ngan' },
  [400],
);
const createdB = await call(
  T,
  'POST',
  '',
  { email: emailB, password: PASSWORD_A },
  [201],
);
const idB = createdB.data?.data?.id;

// ---------- C. Đồng bộ với auth v1 (core_users) ----------
const loginA = await login(emailA, PASSWORD_A);
check(
  'tài khoản v2 đăng nhập được qua auth v1 (đã sync core_users)',
  loginA.status === 201,
  String(loginA.status),
);
await call(
  T,
  'POST',
  `/${idA}/reset-password`,
  { newPassword: PASSWORD_A2 },
  [200, 201],
);
check(
  'mật khẩu cũ bị từ chối sau reset',
  (await login(emailA, PASSWORD_A)).status === 401,
);
check(
  'mật khẩu mới đăng nhập được',
  (await login(emailA, PASSWORD_A2)).status === 201,
);

// ---------- C2. v1 đổi dữ liệu trên core_users, v2 KHÔNG được ghi đè bằng giá trị cũ ----------
const PASSWORD_A3 = `Smoke#${tag}c`;
const loginA2 = await login(emailA, PASSWORD_A2);
const before = await call(T, 'GET', `/${idA}`, undefined, [200]);
check(
  'v2 thấy mốc đăng nhập do v1 ghi (lastLoginAt)',
  !!before.data?.data?.lastLoginAt,
);
const chg = await raw(`${V1}/auth/change-password`, 'POST', loginA2.token, {
  oldPassword: PASSWORD_A2,
  newPassword: PASSWORD_A3,
});
record(
  'POST /api/v1/auth/change-password (v1 tự đổi mật khẩu)',
  chg.status,
  '200|201',
  [200, 201].includes(chg.status),
  chg.data?.message,
);
await call(T, 'PATCH', `/${idA}`, { extraData: { smoke: tag } }, [200]);
check(
  'sau khi v2 sửa user, mật khẩu v1 vừa đổi vẫn dùng được (không bị ghi đè)',
  (await login(emailA, PASSWORD_A3)).status === 201,
);
check(
  'mật khẩu cũ vẫn bị từ chối',
  (await login(emailA, PASSWORD_A2)).status === 401,
);
const after = await call(T, 'GET', `/${idA}`, undefined, [200]);
check('v2 giữ lastLoginAt sau khi sửa', !!after.data?.data?.lastLoginAt);
check('extraData được merge', after.data?.data?.extraData?.smoke === tag);

// ---------- D. Liên kết nhân viên và đua request ----------
const emp = await raw(`${BASE}/api/v2/employees`, 'POST', T, {
  employeeCode: `SMK${tag}`,
  fullName: `Smoke User ${tag}`,
});
const empId = emp.data?.id ?? emp.data?.data?.id;
record(
  'POST /api/v2/employees (tạo nhân viên test)',
  emp.status,
  '200|201',
  [200, 201].includes(emp.status) && !!empId,
  emp.data?.message,
);
if (empId) {
  const [r1, r2] = await Promise.all([
    raw(`${V2}/${idA}/link-employee`, 'POST', T, { employeeId: empId }),
    raw(`${V2}/${idB}/link-employee`, 'POST', T, { employeeId: empId }),
  ]);
  const codes = [r1.status, r2.status].sort();
  record(
    'ĐUA: hai user cùng liên kết một nhân viên',
    codes.join(','),
    '201,409 (hoặc 200,409)',
    codes[1] === 409 && [200, 201].includes(codes[0]),
  );
  const winner = [200, 201].includes(r1.status) ? idA : idB;
  const detail = await call(T, 'GET', `/${winner}`, undefined, [200]);
  check(
    'người thắng có employee gắn đúng',
    detail.data?.data?.employeeId === empId,
  );
  await call(T, 'POST', `/${winner}/unlink-employee`, undefined, [200, 201]);
}

// ---------- E. Trạng thái ----------
await call(T, 'POST', `/${admin.user.id}/deactivate`, undefined, [400]);
await call(T, 'POST', `/${idA}/deactivate`, undefined, [200, 201]);
check(
  'tài khoản INACTIVE không đăng nhập được',
  (await login(emailA, PASSWORD_A3)).status !== 201,
);
await call(T, 'POST', `/${idA}/activate`, undefined, [200, 201]);
await call(T, 'POST', `/${idB}/deactivate`, undefined, [200, 201]);

// ---------- Báo cáo ----------
console.table(results);
const failed = results.filter((r) => !r.pass);
console.log(
  `\nSmoke users-management: ${results.length - failed.length}/${results.length} PASS`,
);
console.log(
  `Dữ liệu test cần dọn: email LIKE 'smoke-users-${tag}-%', mã nhân viên SMK${tag}`,
);
process.exitCode = failed.length ? 1 : 0;
