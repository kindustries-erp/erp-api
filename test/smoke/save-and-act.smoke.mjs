// Smoke API orchestration "lưu rồi hành động một request": PR save-and-submit, PO save-and-confirm,
// phiếu nhập save-and-post và hoàn nhập. Chạy trên API đang chạy (xem erp-e2e-api-smoke/SKILL.md).
//   E2E_API_URL (mặc định http://localhost:10003), E2E_PASSWORD (BẮT BUỘC),
//   E2E_TAO_EMAIL, E2E_DUYET_EMAIL (mặc định ai-test-tao / ai-test-duyet @example.com)
// Chạy: bun run test:smoke:save-and-act
const BASE = process.env.E2E_API_URL ?? 'http://localhost:10003';
const PASSWORD = process.env.E2E_PASSWORD;
const TAO_EMAIL = process.env.E2E_TAO_EMAIL ?? 'ai-test-tao@example.com';
const DUYET_EMAIL = process.env.E2E_DUYET_EMAIL ?? 'ai-test-duyet@example.com';
if (!PASSWORD) {
  console.error('Thiếu E2E_PASSWORD. Đặt mật khẩu tài khoản test rồi chạy lại.');
  process.exit(2);
}
const results = [];
const tag = `SMOKE-SAA-${Date.now()}`;
const today = new Date().toISOString().slice(0, 10);

async function login(email) {
  const r = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const body = await r.json();
  if (r.status !== 201) throw new Error(`login ${email} -> ${r.status}`);
  return { token: body.accessToken, user: body.user };
}

async function call(session, method, path, body, expect) {
  const url = path.startsWith('/api/') ? `${BASE}${path}` : `${BASE}/api/v2${path}`;
  const r = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try { data = await r.json(); } catch { data = null; }
  const pass = expect.includes(r.status);
  results.push({ step: `${method} ${path}`, status: r.status, expected: expect.join('|'), pass, message: String(data?.message ?? '').slice(0, 80) });
  return { status: r.status, data };
}

function check(name, cond) {
  results.push({ step: name, status: '-', expected: 'true', pass: Boolean(cond), message: '' });
}

const unwrap = (res) => res.data?.data ?? res.data;
const tao = await login(TAO_EMAIL);
const duyet = await login(DUYET_EMAIL);
const prLine = { lineType: 'GOODS', itemName: `${tag} item`, qtyRequested: 3, estUnitPrice: 100 };

// 1. PR save-and-submit lỗi (thiếu người duyệt khi khóa duyệt bật) phải rollback, không để lại nháp
const badPr = await call(tao, 'POST', '/procurement-requests-garage/save-and-submit',
  { requestDate: today, title: `${tag} PR-BAD`, lines: [prLine] }, [200, 201, 400, 409, 422]);
const badPrList = await call(tao, 'GET', `/procurement-requests-garage?search=${encodeURIComponent(`${tag} PR-BAD`)}&page=1`, undefined, [200]);
const badPrFound = (badPrList.data?.items ?? []).length;
if (badPr.status >= 400) check('PR lỗi gửi duyệt: không còn PR nháp mồ côi', badPrFound === 0);
else console.log('Khóa duyệt PR đang tắt: save-and-submit không cần approverId (bỏ qua kiểm rollback)');

// 2. PR save-and-submit thành công: một request, PR ở trạng thái đã gửi
const prRes = await call(tao, 'POST', '/procurement-requests-garage/save-and-submit',
  { requestDate: today, title: `${tag} PR`, lines: [prLine], approverId: duyet.user.id }, [200, 201]);
const prId = unwrap(prRes)?.id;
let pr = (await call(tao, 'GET', `/procurement-requests-garage/${prId}`, undefined, [200])).data;
check('PR save-and-submit: không còn DRAFT', pr?.status && pr.status !== 'DRAFT');
console.log('PR sau save-and-submit:', pr?.requestNo, pr?.status);
await call(duyet, 'POST', `/procurement-requests-garage/${prId}/approve`, {}, [200, 201]);
pr = (await call(tao, 'GET', `/procurement-requests-garage/${prId}`, undefined, [200])).data;
const reqLine = pr.lines[0];
const poLine = { lineType: reqLine.lineType, itemCode: `${tag}-SKU`, itemName: reqLine.itemName, qtyOrdered: 3, unitPrice: 100, requestLineId: reqLine.id };

// 3. PO save-and-confirm lỗi (thiếu NCC) phải rollback: PR không bị giữ số lượng, không có PO nháp
const badPo = await call(tao, 'POST', '/procurement-orders-garage/save-and-confirm',
  { orderDate: today, requestId: prId, lines: [poLine] }, [400, 409, 422]);
pr = (await call(tao, 'GET', `/procurement-requests-garage/${prId}`, undefined, [200])).data;
check('PO lỗi: PR không bị giữ số lượng (orderingStatus NONE)', pr?.orderingStatus === 'NONE');
console.log('PO lỗi trả:', badPo.status, '| PR orderingStatus:', pr?.orderingStatus);

// 4. PO save-and-confirm thành công với NCC gõ tự do (khóa duyệt PO tắt thì ghi nhận luôn)
const poRes = await call(tao, 'POST', '/procurement-orders-garage/save-and-confirm',
  { orderDate: today, requestId: prId, supplierName: `${tag} NCC`, lines: [poLine] }, [200, 201]);
const po = unwrap(poRes);
const poId = po?.id;
check('PO save-and-confirm: không còn DRAFT', po?.status && po.status !== 'DRAFT');
console.log('PO sau save-and-confirm:', po?.orderNo, po?.status);
pr = (await call(tao, 'GET', `/procurement-requests-garage/${prId}`, undefined, [200])).data;
check('PR được đặt đủ sau PO (orderingStatus FULL)', pr?.orderingStatus === 'FULL');

// 5. Phát hành PO, phiếu nhập save-and-post (nhập kho một bước)
if (po?.status === 'APPROVED') await call(duyet, 'POST', `/procurement-orders-garage/${poId}/issue`, {}, [200, 201]);
const poNow = (await call(tao, 'GET', `/procurement-orders-garage/${poId}`, undefined, [200])).data;
const grBody = {
  receiptDate: today,
  supplierName: poNow?.supplierName ?? `${tag} NCC`,
  supplierId: poNow?.supplierId ?? undefined,
  branchId: poNow?.branchId ?? undefined,
  garageProcurementOrderId: poId,
  lines: poNow.lines.map((l) => ({
    itemCode: l.itemCode ?? `${tag}-SKU`, itemName: l.itemName, unit: 'Cái',
    qtyReceived: Number(l.qtyOrdered), unitCost: Number(l.unitPrice ?? 0), procurementOrderLineId: l.id,
  })),
};
const grRes = await call(tao, 'POST', '/api/v2/garage-goods-receipts/save-and-post', grBody, [200, 201]);
const gr = unwrap(grRes);
check('Phiếu nhập save-and-post: POSTED', gr?.status === 'POSTED');
check('Phiếu đã nhập kho: reversible=true khi hàng chưa dùng', gr?.reversible === true);
const poAfter = (await call(tao, 'GET', `/procurement-orders-garage/${poId}`, undefined, [200])).data;
check('PO nhận đủ sau nhập kho (fulfillmentStatus FULL)', poAfter?.fulfillmentStatus === 'FULL');

// 6. Phiếu nhập save-and-post lỗi (dòng sai) không để lại phiếu nháp
const badGrNo = `${tag}-GR-BAD`;
const badGr = await call(tao, 'POST', '/api/v2/garage-goods-receipts/save-and-post',
  { ...grBody, receiptNo: badGrNo, lines: grBody.lines.map((l) => ({ ...l, qtyReceived: l.qtyReceived + 100 })) }, [400, 409, 422]);
const badGrList = await call(tao, 'GET', `/api/v2/garage-goods-receipts?search=${encodeURIComponent(badGrNo)}&page=1`, undefined, [200]);
check('Phiếu nhập lỗi: không còn phiếu nháp mồ côi', (badGrList.data?.items ?? []).length === 0);
console.log('Phiếu nhập lỗi trả:', badGr.status);

// 7. Hoàn nhập khi hàng chưa dùng: được, phiếu CANCELLED, PO về chưa nhận
const cancel = await call(tao, 'POST', `/api/v2/garage-goods-receipts/${gr?.id}/cancel`, {}, [200, 201]);
check('Hoàn nhập: CANCELLED', unwrap(cancel)?.status === 'CANCELLED');
const poBack = (await call(tao, 'GET', `/procurement-orders-garage/${poId}`, undefined, [200])).data;
check('Sau hoàn nhập: PO về NONE', poBack?.fulfillmentStatus === 'NONE');
// Ca "đã xuất/điều chỉnh sau phiếu thì chặn hoàn nhập" được kiểm ở spec đơn vị (cần chứng từ xuất kho riêng).

await call(duyet, 'POST', `/procurement-orders-garage/${poId}/close`, { reason: 'Smoke close' }, [200, 201]);
console.log('Dữ liệu tạo mới gắn tag:', tag, '(không tự dọn)');
console.table(results);
const failed = results.filter((r) => !r.pass);
console.log(`TOTAL ${results.length}, FAILED ${failed.length}`);
process.exit(failed.length ? 1 : 0);
