// Smoke API PR/PO nhân bản (chạy trên API đang chạy, không qua UI).
// Cấu hình qua biến môi trường (xem erp-api/.agents/skills/erp-e2e-api-smoke/SKILL.md):
//   E2E_API_URL      (mặc định suy từ PORT trong erp-api/.env, xem e2e-ports.mjs)
//   E2E_PASSWORD     (BẮT BUỘC, mật khẩu tài khoản test; không hardcode)
//   E2E_TAO_EMAIL    (mặc định ai-test-tao@example.com)
//   E2E_DUYET_EMAIL  (mặc định ai-test-duyet@example.com)
// Chạy: bun run test:smoke:clone
import { resolveApiUrl } from './e2e-ports.mjs';
const BASE = resolveApiUrl();
const PASSWORD = process.env.E2E_PASSWORD;
const TAO_EMAIL = process.env.E2E_TAO_EMAIL ?? 'ai-test-tao@example.com';
const DUYET_EMAIL = process.env.E2E_DUYET_EMAIL ?? 'ai-test-duyet@example.com';
if (!PASSWORD) {
  console.error('Thiếu E2E_PASSWORD. Đặt mật khẩu tài khoản test rồi chạy lại.');
  process.exit(2);
}
const V1 = `${BASE}/api/v1`;
const V2 = `${BASE}/api/v2`;
const results = [];

async function login(email) {
  const r = await fetch(`${V1}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (r.status !== 201) throw new Error(`login ${email} -> ${r.status}`);
  const body = await r.json();
  return { token: body.accessToken, user: body.user };
}

async function call(s, method, path, body, expect) {
  const r = await fetch(`${V2}${path}`, {
    method,
    headers: { Authorization: `Bearer ${s.token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try { data = await r.json(); } catch { data = null; }
  const ok = expect.includes(r.status);
  results.push({ step: `${method} ${path.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, '<id>')}`, status: r.status, expected: expect.join('|'), pass: ok, message: String(data?.message ?? '').slice(0, 70) });
  return { status: r.status, data };
}

const check = (label, cond, extra = '') => results.push({ step: `CHECK ${label}`, status: '', expected: 'true', pass: !!cond, message: extra });

const today = new Date().toISOString().slice(0, 10);
const tao = await login(TAO_EMAIL);
const duyet = await login(DUYET_EMAIL);
const SUPPLIER = '02c760ca-2a7c-454b-9c52-28712653062b';
const tag = Date.now();

const prDetail = async (id) => (await call(tao, 'GET', `/procurement-requests-garage/${id}`, undefined, [200])).data;

// ---------- A. PR đã duyệt → lập PO → hủy PO → nhân bản PO ----------
const p1 = await call(tao, 'POST', '/procurement-requests-garage', {
  requestDate: today, title: `CLONE-A ${tag}`,
  lines: [{ lineType: 'GOODS', itemName: 'Lọc dầu', qtyRequested: 2, estUnitPrice: 100 }],
}, [201]);
const p1Id = p1.data.id;
await call(tao, 'POST', `/procurement-requests-garage/${p1Id}/submit`, { approverId: duyet.user.id }, [200, 201]);
await call(duyet, 'POST', `/procurement-requests-garage/${p1Id}/approve`, {}, [200, 201]);
let p1d = await prDetail(p1Id);
check('PR A approved', p1d.status === 'APPROVED', p1d.status);

const po1 = await call(tao, 'POST', '/procurement-orders-garage', {
  orderDate: today, requestId: p1Id,
  lines: p1d.lines.map((l) => ({ lineType: l.lineType, itemName: l.itemName, qtyOrdered: Number(l.qtyRequested), unitPrice: Number(l.estUnitPrice ?? 0), requestLineId: l.id })),
}, [201]);
const po1Id = po1.data.id;
await call(tao, 'PATCH', `/procurement-orders-garage/${po1Id}`, { supplierId: SUPPLIER }, [200]);
// Duyệt PO tắt: gửi duyệt đi thẳng sang APPROVED
const sub = await call(tao, 'POST', `/procurement-orders-garage/${po1Id}/submit`, {}, [200, 201]);
const po1AfterSubmit = (await call(tao, 'GET', `/procurement-orders-garage/${po1Id}`, undefined, [200])).data;
check('PO submit khi duyệt tắt -> APPROVED', po1AfterSubmit.status === 'APPROVED', po1AfterSubmit.status);

// Hủy PO → trả số đã giữ trên PR
await call(duyet, 'POST', `/procurement-orders-garage/${po1Id}/cancel`, {}, [400]);
await call(duyet, 'POST', `/procurement-orders-garage/${po1Id}/cancel`, { reason: 'Nhập nhầm' }, [200, 201]);
p1d = await prDetail(p1Id);
check('Hủy PO trả số đã giữ: PR orderingStatus = NONE', p1d.orderingStatus === 'NONE', p1d.orderingStatus);

// Nhân bản PO đã hủy → giữ liên kết PR, giữ số lại → PR FULL
const poClone = await call(tao, 'POST', `/procurement-orders-garage/${po1Id}/clone`, undefined, [201]);
const poCloneId = poClone.data?.id;
const poCloneDetail = (await call(tao, 'GET', `/procurement-orders-garage/${poCloneId}`, undefined, [200])).data;
check('PO nhân bản là DRAFT mới', poCloneDetail?.status === 'DRAFT' && poCloneId !== po1Id, poCloneDetail?.status);
check('PO nhân bản giữ requestId', poCloneDetail?.requestId === p1Id, poCloneDetail?.requestId);
p1d = await prDetail(p1Id);
check('Nhân bản PO giữ lại số trên PR: FULL', p1d.orderingStatus === 'FULL', p1d.orderingStatus);
await call(tao, 'POST', `/procurement-orders-garage/${poCloneId}/clone`, undefined, [409]);

// PO nháp đã có số: hủy lại để PR về NONE, nhân bản cũng 409 khi còn DRAFT
await call(tao, 'POST', `/procurement-orders-garage/${poCloneId}/clone`, undefined, [409]);

// ---------- B. PR bị từ chối → REJECTED → nhân bản ----------
const p2 = await call(tao, 'POST', '/procurement-requests-garage', {
  requestDate: today, title: `CLONE-B ${tag}`,
  lines: [
    { lineType: 'GOODS', itemName: 'Má phanh', qtyRequested: 3, estUnitPrice: 50 },
    { lineType: 'GOODS', itemName: 'Dầu phanh', qtyRequested: 1, estUnitPrice: 20 },
  ],
}, [201]);
const p2Id = p2.data.id;
await call(tao, 'POST', `/procurement-requests-garage/${p2Id}/submit`, { approverId: duyet.user.id }, [200, 201]);
await call(duyet, 'POST', `/procurement-requests-garage/${p2Id}/reject`, { reason: 'Thiếu báo giá' }, [200, 201]);
let p2d = await prDetail(p2Id);
check('Từ chối → REJECTED', p2d.status === 'REJECTED', p2d.status);
check('Lý do từ chối được lưu', p2d.approval?.reject?.reason === 'Thiếu báo giá', p2d.approval?.reject?.reason);
await call(duyet, 'POST', `/procurement-requests-garage/${p2Id}/approve`, {}, [409]);
await call(tao, 'POST', `/procurement-requests-garage/${p2Id}/submit`, { approverId: duyet.user.id }, [409]);
await call(tao, 'PATCH', `/procurement-requests-garage/${p2Id}`, { title: 'x' }, [409]);

const p2c = await call(tao, 'POST', `/procurement-requests-garage/${p2Id}/clone`, undefined, [201]);
const p2cId = p2c.data?.id;
const p2cd = await prDetail(p2cId);
check('Nhân bản PR: DRAFT mới', p2cd?.status === 'DRAFT' && p2cId !== p2Id, p2cd?.status);
check('Nhân bản PR: số phiếu mới', p2cd?.requestNo && p2cd.requestNo !== p2d.requestNo, `${p2d.requestNo} -> ${p2cd?.requestNo}`);
check('Nhân bản PR: copy đủ 2 dòng', (p2cd?.lines ?? []).length === 2, String((p2cd?.lines ?? []).length));
check('Nhân bản PR: không copy lý do từ chối', !p2cd?.rejectReason, String(p2cd?.rejectReason));
// Phiếu gốc vẫn REJECTED
p2d = await prDetail(p2Id);
check('Phiếu gốc giữ REJECTED sau nhân bản', p2d.status === 'REJECTED', p2d.status);
// Bản nhân bản gửi lại và được duyệt
await call(tao, 'POST', `/procurement-requests-garage/${p2cId}/submit`, { approverId: duyet.user.id }, [200, 201]);
await call(duyet, 'POST', `/procurement-requests-garage/${p2cId}/approve`, {}, [200, 201]);
check('Bản nhân bản duyệt được', (await prDetail(p2cId)).status === 'APPROVED');

// ---------- C. PR bị hủy → nhân bản ----------
const p3 = await call(tao, 'POST', '/procurement-requests-garage', {
  requestDate: today, title: `CLONE-C ${tag}`,
  lines: [{ lineType: 'GOODS', itemName: 'Ắc quy', qtyRequested: 1, estUnitPrice: 900 }],
}, [201]);
const p3Id = p3.data.id;
await call(tao, 'POST', `/procurement-requests-garage/${p3Id}/submit`, { approverId: duyet.user.id }, [200, 201]);
await call(duyet, 'POST', `/procurement-requests-garage/${p3Id}/approve`, {}, [200, 201]);
await call(duyet, 'POST', `/procurement-requests-garage/${p3Id}/cancel`, { reason: 'Không cần nữa' }, [200, 201]);
check('Hủy PR → CANCELLED', (await prDetail(p3Id)).status === 'CANCELLED');
const p3c = await call(tao, 'POST', `/procurement-requests-garage/${p3Id}/clone`, undefined, [201]);
check('Nhân bản PR đã hủy: DRAFT', (await prDetail(p3c.data?.id))?.status === 'DRAFT');

// Nháp không nhân bản được
const draftPr = await call(tao, 'POST', '/procurement-requests-garage', {
  requestDate: today, title: `CLONE-D ${tag}`,
  lines: [{ lineType: 'GOODS', itemName: 'Nháp', qtyRequested: 1, estUnitPrice: 1 }],
}, [201]);
await call(tao, 'POST', `/procurement-requests-garage/${draftPr.data.id}/clone`, undefined, [409]);

// Quyền: người duyệt không có quyền tạo? (kiểm tra thực tế)
await call(duyet, 'POST', `/procurement-requests-garage/${p2Id}/clone`, undefined, [201, 403]);

console.table(results.map((r) => ({ ...r, message: String(r.message).slice(0, 60) })));
const failed = results.filter((r) => !r.pass);
console.log(`TOTAL ${results.length}, FAILED ${failed.length}`);
console.log('IDS', JSON.stringify({ p1Id, po1Id, poCloneId, p2Id, p2cId, p3Id }));
