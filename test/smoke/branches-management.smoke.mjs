// Smoke API Branches V2 (`/api/v2/branches`, bảng `branches_management`) trên API đang chạy, không qua UI.
// Cấu hình qua biến môi trường (xem erp-api/.agents/skills/erp-e2e-api-smoke/SKILL.md):
//   E2E_API_URL        (mặc định suy từ PORT trong erp-api/.env, xem e2e-ports.mjs)
//   E2E_ADMIN_EMAIL    (BẮT BUỘC; cần quyền tạo/xóa nhân viên cho bước 409)
//   E2E_ADMIN_PASSWORD (mặc định dùng E2E_PASSWORD)
// Tạo chi nhánh `SMB<tag>` và nhân viên `SMBE<tag>`; cuối bài chi nhánh được xóa mềm, nhân viên xóa mềm.
// Chỉ chạy trên staging/dev. KHÔNG chạy trên DB production.
// Chạy: bun run test:smoke:branches
import { resolveApiUrl } from './e2e-ports.mjs';

const BASE = resolveApiUrl();
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD =
  process.env.E2E_ADMIN_PASSWORD ?? process.env.E2E_PASSWORD;
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Thiếu E2E_ADMIN_EMAIL hoặc E2E_PASSWORD/E2E_ADMIN_PASSWORD.');
  process.exit(2);
}
const B = `${BASE}/api/v2/branches`;
const EMP = `${BASE}/api/v2/employees`;
const results = [];
const tag = Date.now();
const CODE = `SMB${tag}`;

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

const check = (label, cond) => record(`CHECK ${label}`, '', 'true', !!cond);

const loginRes = await raw(`${BASE}/api/v2/auth-sessions/login`, 'POST', null, {
  email: ADMIN_EMAIL,
  password: ADMIN_PASSWORD,
});
if (loginRes.status !== 200) {
  console.error(`Đăng nhập admin thất bại: ${loginRes.status}`);
  process.exit(2);
}
const T = loginRes.data.data.accessToken;

// ---------- A. Đọc và hợp đồng ----------
await call(B, null, 'GET', '', undefined, [401]);
const list = await call(
  B,
  T,
  'GET',
  '?page=1&pageSize=50&sort=code',
  undefined,
  [200],
);
check(
  'list có items + pagination, không key phẳng total',
  Array.isArray(list.data?.items) &&
    list.data?.pagination?.total >= 0 &&
    list.data?.total === undefined,
);
check(
  'item có đủ field hợp đồng',
  list.data?.items?.every(
    (i) =>
      i.id &&
      i.code &&
      'address' in i &&
      'isActive' in i &&
      i.extraData &&
      i.createdAt,
  ),
);

// ---------- B. Tạo, sửa, validate ----------
await call(B, T, 'POST', '', { name: 'thiếu code' }, [400]);
const created = await call(
  B,
  T,
  'POST',
  '',
  { code: CODE, name: `Smoke Branch ${tag}`, is_active: true },
  [201],
);
const id = created.data?.data?.id;
check('tạo trả id và code', !!id && created.data?.data?.code === CODE);
if (!id) {
  console.table(results);
  process.exit(1);
}
await call(B, T, 'POST', '', { code: CODE, name: 'trùng mã' }, [409, 500]);
const patched = await call(
  B,
  T,
  'PATCH',
  `/${id}`,
  { name: 'Smoke Renamed' },
  [200],
);
check('PATCH đổi tên', patched.data?.data?.name === 'Smoke Renamed');

// ---------- C. Xóa mềm bị chặn khi còn tham chiếu ----------
const emp = await call(
  EMP,
  T,
  'POST',
  '',
  {
    employeeCode: `SMBE${tag}`,
    fullName: `Smoke Branch Employee ${tag}`,
    branchId: id,
  },
  [201],
);
const empId = emp.data?.data?.id;
check('tạo nhân viên gắn chi nhánh', !!empId);
const blocked = await call(B, T, 'DELETE', `/${id}`, undefined, [409]);
check(
  '409 báo employees_management',
  blocked.data?.references?.some((r) => r.table === 'employees_management'),
);
const stillThere = await call(B, T, 'GET', `?search=${CODE}`, undefined, [200]);
check(
  'chi nhánh vẫn còn sau 409',
  stillThere.data?.items?.some((i) => i.id === id),
);

// ---------- D. Gỡ tham chiếu, xóa mềm, dùng lại mã ----------
if (empId) await call(EMP, T, 'DELETE', `/${empId}`, undefined, [200]);
await call(B, T, 'DELETE', `/${id}`, undefined, [200]);
const gone = await call(B, T, 'GET', `?search=${CODE}`, undefined, [200]);
check(
  'xóa mềm: list không còn chi nhánh',
  !gone.data?.items?.some((i) => i.id === id),
);
await call(B, T, 'DELETE', `/${id}`, undefined, [404]);
const patchGone = await call(B, T, 'PATCH', `/${id}`, { name: 'x' }, [200]);
check('PATCH bản đã xóa mềm trả data null', patchGone.data?.data === null);
const reuse = await call(
  B,
  T,
  'POST',
  '',
  { code: CODE, name: 'Dùng lại mã' },
  [201],
);
await call(B, T, 'DELETE', `/${reuse.data?.data?.id}`, undefined, [200]);

// ---------- Báo cáo ----------
console.table(results);
const failed = results.filter((r) => !r.pass);
console.log(
  `\nSmoke branches: ${results.length - failed.length}/${results.length} PASS`,
);
console.log(`Dữ liệu test đã xóa mềm: chi nhánh ${CODE}, nhân viên SMBE${tag}`);
process.exitCode = failed.length ? 1 : 0;
