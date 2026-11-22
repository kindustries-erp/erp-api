// Smoke thông báo thu hồi/hủy đề nghị mua Garage (chạy trên API đang chạy, không qua UI).
// Luồng: tạo → gửi duyệt → thu hồi (người duyệt nhận INFO) → gửi lại → hủy kèm lý do (người duyệt nhận WARNING).
// Cấu hình qua biến môi trường (xem erp-api/.agents/skills/erp-e2e-api-smoke/SKILL.md):
//   E2E_API_URL      (mặc định suy từ PORT trong erp-api/.env, xem e2e-ports.mjs)
//   E2E_PASSWORD     (BẮT BUỘC, mật khẩu tài khoản test; không hardcode)
//   E2E_TAO_EMAIL    (mặc định ai-test-tao@example.com)
//   E2E_ADMIN_EMAIL  (mặc định ai-test-admin@example.com)
// Chạy: bun run test:smoke:recall-cancel
import { resolveApiUrl } from './e2e-ports.mjs';

const BASE = resolveApiUrl();
const PASSWORD = process.env.E2E_PASSWORD;
const TAO_EMAIL = process.env.E2E_TAO_EMAIL ?? 'ai-test-tao@example.com';
const ADMIN_ACCOUNT_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'ai-test-admin@example.com';
if (!PASSWORD) {
  console.error('Thiếu E2E_PASSWORD. Đặt mật khẩu tài khoản test rồi chạy lại.');
  process.exit(2);
}

const V1 = `${BASE}/api/v1`;
const V2 = `${BASE}/api/v2`;
const results = [];

async function login(email) {
  const r = await fetch(`${BASE}/api/v2/auth-sessions/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const body = await r.json();
  if (r.status !== 200 && r.status !== 201) throw new Error(`login ${email} -> ${r.status}`);
  const p = body.data ?? body;
  return { token: p.accessToken, user: p.user };
}

async function call(session, method, path, body, expect) {
  const url = path.startsWith('/api/') ? `${BASE}${path}` : `${V2}${path}`;
  const r = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${session.token}`,
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
  const ok = expect === undefined ? r.status < 400 : expect.includes(r.status);
  results.push({
    step: `${method} ${path}`,
    status: r.status,
    expected: expect ? expect.join('|') : '<400',
    pass: ok,
    message: data?.message ?? '',
  });
  return { status: r.status, data, ok };
}

function check(step, pass, message = '') {
  results.push({ step, status: '-', expected: 'assert', pass, message });
}

/** Danh sách thông báo của người dùng (chuẩn list V2: { items } hoặc mảng). */
async function inboxItems(session) {
  const res = await call(session, 'GET', '/notifications-inbox?pageSize=100', undefined, [200]);
  const d = res.data;
  return Array.isArray(d) ? d : (d?.items ?? []);
}

/** Thông báo mới (so với mốc trước thao tác) có đúng tiêu đề và thuộc phiếu này. */
function newNotifications(before, after, title, requestId) {
  const seen = new Set(before.map((n) => n.id));
  return after.filter(
    (n) =>
      !seen.has(n.id) &&
      n.title === title &&
      (n.target?.id === requestId || n.extraData?.requestNo === requestNo),
  );
}

let requestNo = '';
const today = new Date().toISOString().slice(0, 10);
const tao = await login(TAO_EMAIL);
const duyet = await login(ADMIN_ACCOUNT_EMAIL);
console.log('tao user id:', tao.user.id, '| duyet user id:', duyet.user.id);

// 1. Tạo đề nghị nháp (người tạo)
const created = await call(tao, 'POST', '/procurement-requests-garage', {
  requestDate: today,
  title: `SMOKE RECALL-CANCEL ${Date.now()}`,
  lines: [{ lineType: 'GOODS', itemName: 'Smoke recall', qtyRequested: 1, estUnitPrice: 10 }],
}, [201]);
const requestId = created.data?.id;
requestNo = created.data?.requestNo ?? '';
console.log('Đề nghị tạo:', requestNo, requestId);

// 2. Gửi duyệt → người duyệt nhận "Có đề nghị chờ bạn duyệt"
const beforeSubmit = await inboxItems(duyet);
await call(tao, 'POST', `/procurement-requests-garage/${requestId}/submit`, { approverId: duyet.user.id }, [200, 201]);
const submitted = newNotifications(beforeSubmit, await inboxItems(duyet), 'Có đề nghị chờ bạn duyệt', requestId);
check('submit → người duyệt nhận thông báo chờ duyệt', submitted.length >= 1, `new=${submitted.length}`);

// 3. Thu hồi → người duyệt nhận "Đề nghị mua đã được thu hồi"
const beforeRecall = await inboxItems(duyet);
await call(tao, 'POST', `/procurement-requests-garage/${requestId}/recall`, {}, [200, 201]);
const recalled = newNotifications(beforeRecall, await inboxItems(duyet), 'Đề nghị mua đã được thu hồi', requestId);
check('recall → người duyệt nhận thông báo thu hồi', recalled.length === 1, `new=${recalled.length}`);
if (recalled[0]) {
  check('thông báo thu hồi có event RECALLED', recalled[0].extraData?.event === 'RECALLED', String(recalled[0].extraData?.event));
}

// 4. Gửi lại rồi hủy kèm lý do → người duyệt nhận "Đề nghị mua đã bị hủy" có lý do
await call(tao, 'POST', `/procurement-requests-garage/${requestId}/submit`, { approverId: duyet.user.id }, [200, 201]);
const beforeCancel = await inboxItems(duyet);
const reason = 'Hủy do thay đổi kế hoạch (smoke)';
await call(tao, 'POST', `/procurement-requests-garage/${requestId}/cancel`, { reason }, [200, 201]);
const cancelled = newNotifications(beforeCancel, await inboxItems(duyet), 'Đề nghị mua đã bị hủy', requestId);
check('cancel → người duyệt nhận thông báo hủy', cancelled.length === 1, `new=${cancelled.length}`);
if (cancelled[0]) {
  check('thông báo hủy có lý do trong nội dung', String(cancelled[0].message).includes(reason), String(cancelled[0].message).slice(0, 80));
  check('thông báo hủy có event CANCELLED', cancelled[0].extraData?.event === 'CANCELLED', String(cancelled[0].extraData?.event));
}

console.table(results.map(({ step, status, expected, pass, message }) => ({ step, status, expected, pass, message: String(message).slice(0, 80) })));
const failed = results.filter((r) => !r.pass);
console.log(`TOTAL ${results.length}, FAILED ${failed.length}`);
process.exit(failed.length ? 1 : 0);
