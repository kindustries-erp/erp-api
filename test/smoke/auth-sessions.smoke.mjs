// Smoke API Auth V2 (`/api/v2/auth-sessions`) trên API đang chạy, không qua UI.
// Cấu hình qua biến môi trường (xem erp-api/.agents/skills/erp-e2e-api-smoke/SKILL.md):
//   E2E_API_URL        (mặc định suy từ PORT trong erp-api/.env, xem e2e-ports.mjs)
//   E2E_ADMIN_EMAIL    (BẮT BUỘC; để chạy impersonate phải là admin@liouni.com)
//   E2E_ADMIN_PASSWORD (mặc định dùng E2E_PASSWORD)
// Tạo tài khoản test `smoke-auth-<tag>-*@example.com`; không có API xóa nên dọn bằng SQL sau khi chạy.
// Chỉ chạy trên staging/dev. KHÔNG chạy trên DB production.
// Chạy: bun run test:smoke:auth-sessions
import { resolveApiUrl } from './e2e-ports.mjs';

const BASE = resolveApiUrl();
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD =
  process.env.E2E_ADMIN_PASSWORD ?? process.env.E2E_PASSWORD;
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Thiếu E2E_ADMIN_EMAIL hoặc E2E_PASSWORD/E2E_ADMIN_PASSWORD.');
  process.exit(2);
}
const V1 = `${BASE}/api/v1`;
const A = `${BASE}/api/v2/auth-sessions`;
const U = `${BASE}/api/v2/users-management`;
const results = [];
const tag = Date.now();
const PW1 = `Smoke#${tag}a`;
const PW2 = `Smoke#${tag}b`;

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

async function call(base, token, method, path, body, expect) {
  const res = await raw(`${base}${path}`, method, token, body);
  record(
    `${method} ${base.replace(BASE, '')}${path.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, '<id>')}`,
    res.status,
    expect.join('|'),
    expect.includes(res.status),
    res.data?.message,
  );
  return res;
}

const check = (label, cond, extra = '') =>
  record(`CHECK ${label}`, '', 'true', !!cond, extra);

const login = (email, password) =>
  raw(`${A}/login`, 'POST', null, { email, password });

// ---------- A. Đăng nhập admin, hợp đồng ----------
const adminLogin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
if (adminLogin.status !== 200) {
  console.error(`Đăng nhập admin v2 thất bại: ${adminLogin.status}`);
  process.exit(2);
}
const admin = adminLogin.data.data;
const T = admin.accessToken;
check(
  'login trả camelCase {accessToken, refreshToken, expiresIn, tokenType, user, preferences}',
  admin.accessToken &&
    admin.refreshToken &&
    admin.expiresIn > 0 &&
    admin.tokenType === 'Bearer' &&
    admin.user?.id &&
    admin.preferences,
);
check(
  'login không lộ passwordHash',
  !JSON.stringify(adminLogin.data).includes('passwordHash'),
);
check(
  'login không trả snake_case kiểu v1',
  admin.access_token === undefined && admin.refresh_token === undefined,
);
await call(
  A,
  null,
  'POST',
  '/login',
  { email: ADMIN_EMAIL, password: 'sai-mat-khau' },
  [401],
);
await call(
  A,
  null,
  'POST',
  '/login',
  { email: `khong-ton-tai-${tag}@example.com`, password: 'x' },
  [401],
);
await call(
  A,
  null,
  'POST',
  '/login',
  { email: 'khong-phai-email', password: 'x' },
  [400],
);

// ---------- B. Profile và JWT dùng chung ----------
const prof = await call(A, T, 'GET', '/profile', undefined, [200]);
check(
  'profile có permissions, preferences, employee',
  Array.isArray(prof.data?.data?.permissions) &&
    prof.data?.data?.preferences &&
    'employee' in (prof.data?.data ?? {}),
);
await call(A, null, 'GET', '/profile', undefined, [401]);
const v1Profile = await raw(`${V1}/auth/profile`, 'GET', T);
check(
  'JWT v2 dùng được ở endpoint v1 (dùng chung secret/payload)',
  v1Profile.status === 200,
  String(v1Profile.status),
);
const usersList = await raw(`${U}?page=1&pageSize=1`, 'GET', T);
check(
  'JWT v2 dùng được ở /api/v2/users-management',
  usersList.status === 200,
  String(usersList.status),
);

// ---------- C. Tạo tài khoản test qua users-management ----------
const emailA = `smoke-auth-${tag}-a@example.com`;
const emailB = `smoke-auth-${tag}-b@example.com`;
const createdA = await call(
  U,
  T,
  'POST',
  '',
  { email: emailA, password: PW1 },
  [201],
);
const idA = createdA.data?.data?.id;
const createdB = await call(
  U,
  T,
  'POST',
  '',
  { email: emailB, password: PW1 },
  [201],
);
const idB = createdB.data?.data?.id;

// ---------- D. Phiên: refresh xoay vòng, phát hiện dùng lại, logout ----------
const la = (await login(emailA, PW1)).data?.data;
check('tài khoản mới đăng nhập được qua v2', !!la?.accessToken);
const detail = await raw(`${U}/${idA}`, 'GET', T);
check(
  'lastLoginAt do v2 ghi, users-management thấy ngay',
  !!detail.data?.data?.lastLoginAt,
);

const r1 = await call(
  A,
  null,
  'POST',
  '/refresh',
  { refreshToken: la.refreshToken },
  [200],
);
const tok1 = r1.data?.data;
check(
  'refresh trả token mới khác token cũ',
  tok1?.refreshToken && tok1.refreshToken !== la.refreshToken,
);
check(
  'access token mới dùng được',
  (await raw(`${A}/profile`, 'GET', tok1?.accessToken)).status === 200,
);
// dùng lại token đã xoay vòng: 401 và thu hồi toàn bộ phiên của user
await call(
  A,
  null,
  'POST',
  '/refresh',
  { refreshToken: la.refreshToken },
  [401],
);
await call(
  A,
  null,
  'POST',
  '/refresh',
  { refreshToken: tok1.refreshToken },
  [401],
);
await call(
  A,
  null,
  'POST',
  '/refresh',
  { refreshToken: 'khong-co-that' },
  [401],
);

const lb = (await login(emailA, PW1)).data?.data;
await call(
  A,
  null,
  'POST',
  '/logout',
  { refreshToken: lb.refreshToken },
  [200],
);
await call(
  A,
  null,
  'POST',
  '/refresh',
  { refreshToken: lb.refreshToken },
  [401],
);

// ---------- E. Đua refresh: hai request cùng token, chỉ một thắng ----------
const lc = (await login(emailA, PW1)).data?.data;
const race = await Promise.all([
  raw(`${A}/refresh`, 'POST', null, { refreshToken: lc.refreshToken }),
  raw(`${A}/refresh`, 'POST', null, { refreshToken: lc.refreshToken }),
]);
const codes = race.map((r) => r.status).sort();
record(
  'ĐUA refresh cùng token',
  codes.join(','),
  '200,401',
  codes[0] === 200 && codes[1] === 401,
);

// ---------- F. Đổi mật khẩu thu hồi phiên ----------
const ld = (await login(emailA, PW1)).data?.data;
await call(
  A,
  ld.accessToken,
  'POST',
  '/change-password',
  { oldPassword: 'sai', newPassword: PW2 },
  [401],
);
await call(
  A,
  ld.accessToken,
  'POST',
  '/change-password',
  { oldPassword: PW1, newPassword: 'ngan' },
  [400],
);
await call(
  A,
  ld.accessToken,
  'POST',
  '/change-password',
  { oldPassword: PW1, newPassword: PW2 },
  [200],
);
await call(
  A,
  null,
  'POST',
  '/refresh',
  { refreshToken: ld.refreshToken },
  [401],
);
check('mật khẩu cũ bị từ chối', (await login(emailA, PW1)).status === 401);
check('mật khẩu mới dùng được', (await login(emailA, PW2)).status === 200);
const v1Login = await raw(`${V1}/auth/login`, 'POST', null, {
  email: emailA,
  password: PW2,
});
check(
  'v1 login vẫn chạy với mật khẩu vừa đổi ở v2 (bản sao core_users)',
  [200, 201].includes(v1Login.status),
  String(v1Login.status),
);

// ---------- G. Hồ sơ cá nhân ----------
const le = (await login(emailA, PW2)).data?.data;
await call(A, le.accessToken, 'PATCH', '/profile', { email: emailB }, [409]);
await call(
  A,
  le.accessToken,
  'PATCH',
  '/profile',
  { fullName: 'Không có hồ sơ' },
  [400],
);
await call(A, le.accessToken, 'PATCH', '/profile', {}, [200]);

// ---------- H. Ngưng tài khoản thu hồi phiên ----------
const lf = (await login(emailB, PW1)).data?.data;
await call(U, T, 'POST', `/${idB}/deactivate`, undefined, [200, 201]);
await call(
  A,
  null,
  'POST',
  '/refresh',
  { refreshToken: lf.refreshToken },
  [401],
);
check(
  'INACTIVE không đăng nhập được',
  (await login(emailB, PW1)).status === 401,
);
await call(U, T, 'POST', `/${idB}/activate`, undefined, [200, 201]);
await call(U, T, 'POST', `/${idB}/deactivate`, undefined, [200, 201]);

// ---------- I. Đổi token v1 sang v2 một lần ----------
const v1 = await raw(`${V1}/auth/login`, 'POST', null, {
  email: emailA,
  password: PW2,
});
const v1Refresh = v1.data?.refreshToken;
check('có refresh token v1 để đổi', !!v1Refresh);
const ex = await call(
  A,
  null,
  'POST',
  '/refresh',
  { refreshToken: v1Refresh },
  [200],
);
check('token v1 đổi được sang phiên v2', !!ex.data?.data?.refreshToken);
await call(A, null, 'POST', '/refresh', { refreshToken: v1Refresh }, [401]);
const v1Again = await raw(`${V1}/auth/refresh`, 'POST', null, {
  refresh_token: v1Refresh,
});
check(
  'token v1 đã đổi không còn dùng được ở v1',
  v1Again.status === 401,
  String(v1Again.status),
);

// ---------- J. Impersonate ----------
if (ADMIN_EMAIL === 'admin@liouni.com') {
  const imp = await call(
    A,
    T,
    'POST',
    '/impersonate',
    { targetUserId: idA },
    [200],
  );
  check(
    'impersonate trả phiên của user đích',
    imp.data?.data?.user?.id === idA,
  );
  await call(A, T, 'POST', '/impersonate', { targetUserId: idB }, [401]);
}
await call(
  A,
  le.accessToken,
  'POST',
  '/impersonate',
  { targetUserId: idB },
  [401],
);
await call(
  A,
  T,
  'POST',
  '/impersonate',
  { targetUserId: 'khong-phai-uuid' },
  [400],
);

// ---------- K. V1 admin ghi qua V2 ----------
const emailC = `smoke-auth-${tag}-c@example.com`;
const v1Create = await raw(`${V1}/admin/users`, 'POST', T, {
  email: emailC,
  password: PW1,
});
// Mặc định V1 admin tắt (410, bật lại bằng ENABLE_V1_ADMIN_USERS=true): chỉ kiểm 410 rồi bỏ qua luồng ủy quyền.
const v1Disabled = v1Create.status === 410;
if (v1Disabled) {
  record(
    'POST /api/v1/admin/users đã ngừng (410)',
    v1Create.status,
    '410',
    true,
    v1Create.data?.message,
  );
} else {
  record(
    'POST /api/v1/admin/users (ủy quyền sang v2)',
    v1Create.status,
    '200|201',
    [200, 201].includes(v1Create.status),
    v1Create.data?.message,
  );
}
const idC = v1Create.data?.data?.id;
const seenByV2 = idC ? await raw(`${U}/${idC}`, 'GET', T) : { status: 0 };
if (!v1Disabled) {
  check(
    'user tạo qua v1 admin có ngay ở users_management',
    seenByV2.status === 200,
    String(seenByV2.status),
  );
  check(
    'user tạo qua v1 admin đăng nhập được ở v2',
    (await login(emailC, PW1)).status === 200,
  );
}
if (idC && !v1Disabled) {
  const lg = (await login(emailC, PW1)).data?.data;
  await raw(`${V1}/admin/users/${idC}/reset-password`, 'POST', T, {
    newPassword: PW2,
  });
  await call(
    A,
    null,
    'POST',
    '/refresh',
    { refreshToken: lg.refreshToken },
    [401],
  );
  check(
    'reset mật khẩu ở v1 admin thu hồi phiên v2',
    (await login(emailC, PW2)).status === 200,
  );
  await raw(`${V1}/admin/users/${idC}/deactivate`, 'POST', T);
}

// ---------- Báo cáo ----------
console.table(results);
const failed = results.filter((r) => !r.pass);
console.log(
  `\nSmoke auth-sessions: ${results.length - failed.length}/${results.length} PASS`,
);
console.log(
  `Dữ liệu test cần dọn: users_management/core_users email LIKE 'smoke-auth-${tag}-%' (auth_sessions tự xóa theo FK CASCADE)`,
);
process.exit(failed.length ? 1 : 0);
