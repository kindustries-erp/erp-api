// Smoke link-override (PR garage: branchId + branchName), chạy trên API đang chạy.
// Biến môi trường: E2E_API_URL (suy từ PORT), E2E_PASSWORD (bắt buộc), E2E_TAO_EMAIL.
// Chạy: bun run test:smoke:link-override
import { resolveApiUrl } from './e2e-ports.mjs';
const BASE = resolveApiUrl();
const PASSWORD = process.env.E2E_PASSWORD;
const TAO_EMAIL = process.env.E2E_TAO_EMAIL ?? 'ai-test-tao@example.com';
if (!PASSWORD) {
  console.error('Thiếu E2E_PASSWORD. Đặt mật khẩu tài khoản test rồi chạy lại.');
  process.exit(2);
}
const V2 = `${BASE}/api/v2`;
const results = [];
const unwrap = (d) => d?.data ?? d;

const login = await fetch(`${V2}/auth-sessions/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: TAO_EMAIL, password: PASSWORD }),
});
if (![200, 201].includes(login.status)) throw new Error(`login -> ${login.status}`);
const token = unwrap(await login.json()).accessToken;

async function call(method, path, body, expect) {
  const r = await fetch(`${V2}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try { data = await r.json(); } catch { data = null; }
  results.push({
    step: `${method} ${path.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, '<id>')}`,
    status: r.status, expected: expect.join('|'), pass: expect.includes(r.status),
    message: String(data?.message ?? '').slice(0, 60),
  });
  return { status: r.status, data: unwrap(data) };
}
const check = (label, cond, extra = '') =>
  results.push({ step: `CHECK ${label}`, status: '', expected: 'true', pass: !!cond, message: String(extra).slice(0, 60) });

const tag = `LNK-${Date.now().toString(36)}`;
const today = new Date().toISOString().slice(0, 10);

const list = await call('GET', '/branches?page=1&pageSize=5', undefined, [200]);
const branch = (list.data?.items ?? []).find((b) => b.isActive !== false);
if (!branch) throw new Error('Không có chi nhánh để smoke');
const sourceName = branch.name;
const edited = `${sourceName} (sửa ${tag})`;

const created = await call('POST', '/procurement-requests-garage', {
  requestDate: today, title: tag, branchId: branch.id,
  lines: [{ lineType: 'GOODS', itemName: 'Smoke', qtyRequested: 1, estUnitPrice: 1 }],
}, [201]);
const id = created.data?.id;
const get = async () => (await call('GET', `/procurement-requests-garage/${id}`, undefined, [200])).data;

let pr = await get();
check('Tạo: branchName = tên chi nhánh', pr.branchName === sourceName, pr.branchName);
check('Tạo: snapshot.branchName = tên chi nhánh', pr.sourceSnapshot?.branchName === sourceName);
check('Tạo: chưa có field đã chỉnh', (pr.overriddenFields ?? []).length === 0);

await call('PATCH', `/procurement-requests-garage/${id}`, { branchName: edited }, [200]);
pr = await get();
check('Sửa tên: branchName đổi', pr.branchName === edited);
check('Sửa tên: overriddenFields có branchName', (pr.overriddenFields ?? []).includes('branchName'));
check('Sửa tên: snapshot vẫn là tên gốc', pr.sourceSnapshot?.branchName === sourceName);
// Không có GET /branches/:id: đọc lại qua danh sách (tìm theo id), phải còn nguyên tên gốc.
const after = await call('GET', '/branches?page=1&pageSize=200', undefined, [200]);
const branchAfter = (after.data?.items ?? []).find((b) => b.id === branch.id);
check('Chi nhánh gốc KHÔNG đổi tên', branchAfter?.name === sourceName, branchAfter?.name);

await call('POST', `/procurement-requests-garage/${id}/links/branchName/revert`, undefined, [200, 201]);
pr = await get();
check('Revert: branchName về tên gốc', pr.branchName === sourceName);
check('Revert: hết cờ đã chỉnh', !(pr.overriddenFields ?? []).includes('branchName'));

await call('PATCH', `/procurement-requests-garage/${id}`, { branchName: edited }, [200]);
await call('POST', `/procurement-requests-garage/${id}/links/branchName/refresh`, undefined, [200, 201]);
pr = await get();
check('Refresh: branchName theo nguồn', pr.branchName === sourceName);
check('Refresh: hết cờ đã chỉnh', !(pr.overriddenFields ?? []).includes('branchName'));

await call('PATCH', `/procurement-requests-garage/${id}`, { branchId: '00000000-0000-4000-8000-000000000000' }, [404]);
await call('POST', `/procurement-requests-garage/${id}/links/title/revert`, undefined, [400, 404]);

console.table(results);
const failed = results.filter((r) => !r.pass);
console.log(`TOTAL ${results.length}, FAILED ${failed.length}`);
console.log('IDS', JSON.stringify({ id, branchId: branch.id, tag }));
process.exit(failed.length ? 1 : 0);
