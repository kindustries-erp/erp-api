// Smoke API PR/PO garage (chạy trên API đang chạy, không qua UI).
// Cấu hình qua biến môi trường (xem erp-api/.agents/skills/erp-e2e-api-smoke/SKILL.md):
//   E2E_API_URL      (mặc định http://localhost:10003)
//   E2E_PASSWORD     (BẮT BUỘC, mật khẩu tài khoản test; không hardcode)
//   E2E_TAO_EMAIL    (mặc định ai-test-tao@example.com)
//   E2E_DUYET_EMAIL  (mặc định ai-test-duyet@example.com)
// Chạy: bun run test:smoke:procurement
const BASE = process.env.E2E_API_URL ?? 'http://localhost:10003';
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
  const body = await r.json();
  if (r.status !== 201) throw new Error(`login ${email} -> ${r.status}`);
  return { token: body.accessToken, user: body.user };
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

const today = new Date().toISOString().slice(0, 10);
const tao = await login(TAO_EMAIL);
const duyet = await login(DUYET_EMAIL);
console.log('tao user id:', tao.user.id, '| duyet user id:', duyet.user.id);

// 1. Tạo PR (người tạo)
const prRes = await call(tao, 'POST', '/procurement-requests-garage', {
  requestDate: today,
  title: `SMOKE PR ${Date.now()}`,
  lines: [
    { lineType: 'GOODS', itemName: 'Smoke item A', qtyRequested: 2, estUnitPrice: 100 },
    { lineType: 'GOODS', itemName: 'Smoke item B', qtyRequested: 3, estUnitPrice: 50 },
  ],
}, [201]);
const prId = prRes.data?.id;
const prDetail = async () => (await call(tao, 'GET', `/procurement-requests-garage/${prId}`, undefined, [200])).data;
let pr = await prDetail();
console.log('PR created:', pr?.requestNo, pr?.status, 'lines:', pr?.lines?.length);

// 2. Gửi duyệt
await call(tao, 'POST', `/procurement-requests-garage/${prId}/submit`, { approverId: duyet.user.id }, [200, 201]);
pr = await prDetail();
console.log('after submit:', pr.status);

// 3. Người duyệt duyệt
await call(duyet, 'POST', `/procurement-requests-garage/${prId}/approve`, {}, [200, 201]);
pr = await prDetail();
console.log('after approve:', pr.status, 'orderingStatus:', pr.orderingStatus);

// 4. Người tạo không được duyệt PR (không phải approver)
await call(tao, 'POST', `/procurement-requests-garage/${prId}/approve`, {}, [403, 400]);

// 5. Lập PO từ PR: lấy draft
const draft = await call(tao, 'GET', `/procurement-requests-garage/${prId}/po-draft`, undefined, [200]);
console.log('po-draft keys:', draft.data ? Object.keys(draft.data) : null);
const reqLines = pr.lines ?? [];
const poLines = reqLines.map((l) => ({
  lineType: l.lineType,
  itemName: l.itemName,
  qtyOrdered: Number(l.qtyRequested),
  unitPrice: Number(l.estUnitPrice ?? 0),
  requestLineId: l.id,
}));
const poRes = await call(tao, 'POST', '/procurement-orders-garage', {
  orderDate: today,
  requestId: prId,
  lines: poLines,
}, [201]);
const poId = poRes.data?.id;
console.log('PO created:', poRes.data?.orderNo, poRes.data?.status);

pr = await prDetail();
console.log('PR after PO (full lines):', pr.orderingStatus);

// 6. Lập PO thứ 2 khi PR đã FULL → phải bị chặn
await call(tao, 'POST', '/procurement-orders-garage', {
  orderDate: today,
  requestId: prId,
  lines: poLines.slice(0, 1),
}, [400, 409, 422]);

// 7. PO: gửi duyệt → duyệt → phát hành → đóng (PO bắt buộc có NCC trước khi gửi duyệt)
await call(tao, 'POST', `/procurement-orders-garage/${poId}/submit`, {}, [400]);
await call(tao, 'PATCH', `/procurement-orders-garage/${poId}`, { supplierId: '02c760ca-2a7c-454b-9c52-28712653062b' }, [200]);
await call(tao, 'POST', `/procurement-orders-garage/${poId}/submit`, {}, [200, 201]);
// Khóa duyệt tắt: submit đã sang APPROVED nên approve trả 409.
await call(duyet, 'POST', `/procurement-orders-garage/${poId}/approve`, {}, [200, 201, 409]);
await call(duyet, 'POST', `/procurement-orders-garage/${poId}/issue`, {}, [200, 201]);
// 7b. Nhận hàng garage (PO đang ISSUED): GR gắn PO → post → cancel (orchestrator procurement-flow-garage).
// Kiểm sổ tồn garage_stock_* thực tế bằng SQL ở bước riêng (script không đọc DB).
const poIssued = (await call(tao, 'GET', `/procurement-orders-garage/${poId}`, undefined, [200])).data;
const poLinesNow = poIssued?.lines ?? [];
const grRes = await call(tao, 'POST', '/api/v1/garage-goods-receipts', {
  receiptDate: today,
  supplierId: poIssued?.supplierId,
  supplierName: poIssued?.supplierName ?? 'Smoke NCC',
  branchId: poIssued?.branchId ?? undefined,
  garageProcurementOrderId: poId,
  status: 'DRAFT',
  lines: poLinesNow.map((l) => ({
    itemCode: `SMOKE-${String(l.itemName).replace(/\s+/g, '-').toUpperCase()}`,
    itemName: l.itemName,
    unit: 'Cái',
    qtyReceived: Number(l.qtyOrdered),
    unitCost: Number(l.unitPrice ?? 0),
    procurementOrderLineId: l.id,
  })),
}, [201]);
// API v1 bọc phản hồi trong { message, data }
const unwrap = (res) => res.data?.data ?? res.data;
const grId = unwrap(grRes)?.id;
console.log('GR created:', unwrap(grRes)?.receiptNo, unwrap(grRes)?.status);
const grPost = await call(tao, 'POST', `/api/v1/garage-goods-receipts/${grId}/post`, {}, [200, 201]);
console.log('GR after post:', unwrap(grPost)?.status);
const poAfterPost = (await call(tao, 'GET', `/procurement-orders-garage/${poId}`, undefined, [200])).data;
console.log('PO fulfillment after post:', poAfterPost?.fulfillmentStatus);
await call(tao, 'POST', `/api/v1/garage-goods-receipts/${grId}/post`, {}, [400]);
const grCancel = await call(tao, 'POST', `/api/v1/garage-goods-receipts/${grId}/cancel`, {}, [200, 201]);
console.log('GR after cancel:', unwrap(grCancel)?.status);
const poAfterCancel = (await call(tao, 'GET', `/procurement-orders-garage/${poId}`, undefined, [200])).data;
console.log('PO fulfillment after cancel:', poAfterCancel?.fulfillmentStatus);
console.log('GR_ID', grId, 'PO_ID', poId);

// close cần lý do
await call(duyet, 'POST', `/procurement-orders-garage/${poId}/close`, {}, [400]);
await call(duyet, 'POST', `/procurement-orders-garage/${poId}/close`, { reason: 'Smoke close' }, [200, 201]);
const poDetail = (await call(tao, 'GET', `/procurement-orders-garage/${poId}`, undefined, [200])).data;
console.log('PO final status:', poDetail?.status);

// 8. PR bị từ chối: tạo PR2 → gửi → từ chối (cần lý do)
const pr2Res = await call(tao, 'POST', '/procurement-requests-garage', {
  requestDate: today,
  title: `SMOKE PR REJECT ${Date.now()}`,
  lines: [{ lineType: 'GOODS', itemName: 'Smoke rej', qtyRequested: 1, estUnitPrice: 10 }],
}, [201]);
const pr2Id = pr2Res.data?.id;
await call(tao, 'POST', `/procurement-requests-garage/${pr2Id}/submit`, { approverId: duyet.user.id }, [200, 201]);
await call(duyet, 'POST', `/procurement-requests-garage/${pr2Id}/reject`, {}, [400]);
await call(duyet, 'POST', `/procurement-requests-garage/${pr2Id}/reject`, { reason: 'Smoke reject' }, [200, 201]);
const pr2 = (await call(tao, 'GET', `/procurement-requests-garage/${pr2Id}`, undefined, [200])).data;
console.log('PR2 after reject:', pr2?.status);
// Sau từ chối PR đang ở DRAFT (không còn trạng thái REJECTED): không duyệt được khi chưa gửi lại
await call(duyet, 'POST', `/procurement-requests-garage/${pr2Id}/approve`, {}, [409]);
// REJECTED là trạng thái cuối: gửi lại bị chặn (409)
await call(tao, 'POST', `/procurement-requests-garage/${pr2Id}/submit`, { approverId: duyet.user.id }, [409]);

// 9. PR nháp: sửa được; PR đang chờ duyệt / đã duyệt: không sửa
await call(tao, 'PATCH', `/procurement-requests-garage/${pr2Id}`, { title: 'x' }, [409]);
await call(tao, 'PATCH', `/procurement-requests-garage/${prId}`, { title: 'approved, should fail' }, [409]);

// 10. Hủy PR đã duyệt (cần lý do)
const pr3Res = await call(tao, 'POST', '/procurement-requests-garage', {
  requestDate: today,
  title: `SMOKE PR CANCEL ${Date.now()}`,
  lines: [{ lineType: 'GOODS', itemName: 'Smoke cancel', qtyRequested: 1, estUnitPrice: 10 }],
}, [201]);
const pr3Id = pr3Res.data?.id;
await call(tao, 'POST', `/procurement-requests-garage/${pr3Id}/submit`, { approverId: duyet.user.id }, [200, 201]);
await call(duyet, 'POST', `/procurement-requests-garage/${pr3Id}/approve`, {}, [200, 201]);
await call(duyet, 'POST', `/procurement-requests-garage/${pr3Id}/cancel`, {}, [400]);
await call(duyet, 'POST', `/procurement-requests-garage/${pr3Id}/cancel`, { reason: 'Smoke cancel' }, [200, 201]);
const pr3 = (await call(tao, 'GET', `/procurement-requests-garage/${pr3Id}`, undefined, [200])).data;
console.log('PR3 after cancel:', pr3?.status);

// 11. Danh sách
await call(tao, 'GET', '/procurement-requests-garage?page=1', undefined, [200]);
await call(duyet, 'GET', '/procurement-orders-garage?page=1', undefined, [200]);
await call(duyet, 'GET', `/procurement-requests-garage/${prId}/approval-events`, undefined, [200]);

console.table(results.map(({ step, status, expected, pass, message }) => ({ step, status, expected, pass, message: String(message).slice(0, 80) })));
const failed = results.filter((r) => !r.pass);
console.log(`TOTAL ${results.length}, FAILED ${failed.length}`);
