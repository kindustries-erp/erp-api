// Smoke CRUD `api/v2/cases-garage` (xe NATIVE) trên API đang chạy. Chỉ chạy trên staging/dev, KHÔNG production.
// Env: E2E_API_URL (mặc định suy từ PORT), E2E_TAO_EMAIL (mặc định ai-test-admin, có quyền GARAGE DELETE; ai-test-tao nhận 403 khi xóa), E2E_PASSWORD (bắt buộc).
// Dùng chi nhánh giả `smoke-<tag>` (và `smoke-<tag>-other`) nên không đụng dữ liệu chi nhánh thật;
// cuối script xóa mềm các xe đã tạo.
import { resolveApiUrl } from './e2e-ports.mjs';

const BASE = resolveApiUrl();
const EMAIL = process.env.E2E_TAO_EMAIL ?? 'ai-test-admin@example.com';
const PASSWORD = process.env.E2E_PASSWORD;
if (!PASSWORD) {
  console.error('Thiếu E2E_PASSWORD.');
  process.exit(2);
}
const tag = Date.now();
const BR = `smoke-${tag}`;
const BR_OTHER = `smoke-${tag}-other`;
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ` :: ${detail}`}`);
};

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

async function api(method, path, branch, body) {
  const r = await fetch(`${BASE}/api/v2/cases-garage${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(branch ? { 'x-kgara-branch-id': branch } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try {
    data = await r.json();
  } catch {
    data = null;
  }
  return { status: r.status, data, d: data?.data ?? data };
}

// 1. Thiếu header chi nhánh -> 400.
check('ghi thiếu chi nhánh -> 400', (await api('POST', '', null, { licensePlate: 'X' })).status === 400);

// 2. next-code + tạo xe NATIVE kèm 2 dòng.
const nc = await api('GET', '/next-code', BR);
check('next-code 200', nc.status === 200, String(nc.status));
const created = await api('POST', '', BR, {
  licensePlate: `SMK-${tag % 100000}`,
  chassisNumber: `VIN${tag}`,
  vehicleBrandCode: 'VF',
  vehicleBrandName: 'VinFast',
  vehicleModelName: 'VF8',
  manufactureYear: 2024,
  customerName: 'Smoke khách',
  payerName: 'Smoke payer',
  services: [
    { productTypeCode: 'DV', productName: 'Công thay', quantity: 1, unitPrice: 100000, taxRate: 10 },
    { productTypeCode: 'PT', productName: 'Lọc gió', quantity: 2, unitPrice: 50000, taxRate: 10, partsCost: 60000 },
  ],
});
check('tạo xe NATIVE 201/200', [200, 201].includes(created.status), `${created.status} ${JSON.stringify(created.data)?.slice(0, 200)}`);
const id = created.d?.id;
check('origin NATIVE + có caseCode', created.d?.origin === 'NATIVE' && !!created.d?.caseCode, JSON.stringify(created.d)?.slice(0, 200));
check('response camelCase EN (không token VN)', created.d?.licensePlate && created.d?.soChungTu === undefined && created.d?.bienSoXe === undefined);
check('tổng tiền tính từ dòng (220000)', Number(created.d?.totalAmountWithTax) === 220000, String(created.d?.totalAmountWithTax));
if (!id) {
  console.log('Không có id, dừng.');
  process.exit(1);
}

// 3. Đọc: chi tiết, danh sách có origin, lọc origin.
const detail = await api('GET', `/${id}`, BR);
check('chi tiết 200 + 2 dòng', detail.status === 200 && (detail.d?.services?.length ?? 0) === 2, `${detail.status}`);
const list = await api('GET', `/?page=1&pageSize=20&origin=NATIVE`, BR);
check('list lọc origin=NATIVE có xe vừa tạo', list.status === 200 && (list.data?.items ?? []).some((x) => x.id === id), `${list.status}`);
const byCode = await api('GET', `/by-code/${encodeURIComponent(created.d.caseCode)}`, BR);
check('by-code 200', byCode.status === 200, String(byCode.status));

// 4. Cách ly chi nhánh: chi nhánh khác -> 404.
check('đọc chi nhánh khác -> 404', (await api('GET', `/${id}`, BR_OTHER)).status === 404);
check('sửa chi nhánh khác -> 404', (await api('PATCH', `/${id}`, BR_OTHER, { internalNotes: 'x' })).status === 404);
check('xóa chi nhánh khác -> 404', (await api('DELETE', `/${id}`, BR_OTHER)).status === 404);
const listOther = await api('GET', `/?page=1&pageSize=20`, BR_OTHER);
check('list chi nhánh khác không thấy xe', !(listOther.data?.items ?? []).some((x) => x.id === id));

// 5. Sửa header + dòng.
const upd = await api('PATCH', `/${id}`, BR, { customerName: 'Smoke khách 2', internalNotes: 'ghi chú smoke' });
check('PATCH header 200', upd.status === 200 && upd.d?.customerName === 'Smoke khách 2', `${upd.status}`);
const add = await api('POST', `/${id}/services`, BR, { productTypeCode: 'DV', productName: 'Thêm', quantity: 1, unitPrice: 10000, taxRate: 0 });
check('thêm dòng 200/201', [200, 201].includes(add.status), `${add.status}`);
const afterAdd = await api('GET', `/${id}`, BR);
check('tổng sau thêm dòng = 230000', Number(afterAdd.d?.totalAmountWithTax) === 230000, String(afterAdd.d?.totalAmountWithTax));
const lines = afterAdd.d?.services ?? [];
const partLine = lines.find((l) => l.productTypeCode === 'PT');
if (partLine) {
  const pc = await api('PATCH', `/${id}/services/${partLine.id}/parts-cost`, BR, { partsCost: 70000 });
  check('đổi giá vốn phụ tùng 200', pc.status === 200, `${pc.status}`);
}
const addedLine = lines.find((l) => l.productName === 'Thêm');
if (addedLine) {
  const rm = await api('DELETE', `/${id}/services/${addedLine.id}`, BR);
  check('xóa dòng 200', rm.status === 200, `${rm.status}`);
}

// 6. Trạng thái: nhảy sai -> 400/409, chuyển hợp lệ -> 200.
const bad = await api('PATCH', `/${id}/status`, BR, { status: 'NOT_A_STATUS' });
check('status không hợp lệ -> 400', bad.status === 400, `${bad.status}`);
const st = await api('PATCH', `/${id}/status`, BR, { status: 'QUOTED' });
check('INTAKE -> QUOTED 200', st.status === 200, `${st.status}`);

// 7. Validate: thiếu biển số -> 400; id không phải UUID -> 400; id lạ -> 404.
check('tạo thiếu licensePlate -> 400', (await api('POST', '', BR, { customerName: 'x' })).status === 400);
check('id không phải UUID -> 400', (await api('GET', '/abc', BR)).status === 400);
check('id lạ -> 404', (await api('GET', '/00000000-0000-0000-0000-000000000000', BR)).status === 404);

// 8. Xóa mềm rồi không đọc được.
const del = await api('DELETE', `/${id}`, BR);
check('DELETE 200', del.status === 200, `${del.status}`);
check('sau xóa đọc -> 404', (await api('GET', `/${id}`, BR)).status === 404);

// 9. Tiến độ xe NATIVE: KTV (nhân viên mẫu), công đoạn, %, bảng theo dõi. Nhân viên mẫu xóa ở cuối.
const EMP = `${BASE}/api/v2/employees`;
const authH = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const empCode = `SMK${tag % 1000000}`;
const empRes = await fetch(EMP, { method: 'POST', headers: authH, body: JSON.stringify({ employeeCode: empCode, fullName: `KTV Smoke ${tag}` }) });
const empJson = await empRes.json().catch(() => null);
const empId = empJson?.data?.id ?? empJson?.id;
check('tạo nhân viên mẫu', [200, 201].includes(empRes.status) && !!empId, `${empRes.status}`);
const nat = await api('POST', '', BR, { licensePlate: `PRG-${tag % 100000}`, customerName: 'Tiến độ smoke', requestDescription: 'Sơn cản trước' });
const natId = nat.d?.id;
check('tạo xe NATIVE cho tiến độ', !!natId, `${nat.status}`);
if (natId && empId) {
  const p1 = await api('PATCH', `/${natId}/progress`, BR, { assigneeId: empId, progressStage: 'PAINTING', progressPercent: 40, expectedCompletionAt: '2099-01-01T00:00:00.000Z' });
  check('PATCH progress 200 và ghi KTV/công đoạn/%', p1.status === 200 && p1.d?.assigneeId === empId && p1.d?.progressStage === 'PAINTING' && p1.d?.progressPercent === 40, `${p1.status} ${JSON.stringify(p1.data)?.slice(0, 200)}`);
  check('progress: % ngoài 0-100 -> 400', (await api('PATCH', `/${natId}/progress`, BR, { progressPercent: 101 })).status === 400);
  check('progress: công đoạn lạ -> 400', (await api('PATCH', `/${natId}/progress`, BR, { progressStage: 'NOPE' })).status === 400);
  check('progress: KTV không tồn tại -> 400', (await api('PATCH', `/${natId}/progress`, BR, { assigneeId: '00000000-0000-4000-8000-000000000000' })).status === 400);
  check('progress: chi nhánh khác -> 404', (await api('PATCH', `/${natId}/progress`, BR_OTHER, { progressPercent: 10 })).status === 404);
  const board = await api('GET', `/progress?status=ALL&search=PRG-${tag % 100000}`, BR);
  const row = (board.data?.items ?? []).find((x) => x.id === natId);
  check('GET /progress có xe, KTV, công đoạn, %, workSummary, isOverdue=false', board.status === 200 && row?.assigneeName === `KTV Smoke ${tag}` && row?.progressStage === 'PAINTING' && row?.progressPercent === 40 && row?.workSummary === 'Sơn cản trước' && row?.isOverdue === false, `${board.status} ${JSON.stringify(row)?.slice(0, 200)}`);
  const byStage = await api('GET', `/progress?status=ALL&stage=QC`, BR);
  check('GET /progress lọc công đoạn khác không thấy xe', byStage.status === 200 && !(byStage.data?.items ?? []).some((x) => x.id === natId));
  check('GET /progress thiếu chi nhánh -> 400', (await api('GET', '/progress', null)).status === 400);
  await api('DELETE', `/${natId}`, BR);
}
if (empId) await fetch(`${EMP}/${empId}`, { method: 'DELETE', headers: authH });

// 10. Override xe sync (cần E2E_SYNC_BRANCH = branch_external_id có xe KGARA_SYNC). Sửa rồi về giá trị KGara, trả lại nguyên trạng.
const SYNC_BR = process.env.E2E_SYNC_BRANCH;
if (!SYNC_BR) {
  console.log('SKIP override xe sync: thiếu E2E_SYNC_BRANCH');
} else {
  const sl = await api('GET', '/?page=1&pageSize=1&origin=KGARA_SYNC', SYNC_BR);
  const sid = sl.data?.items?.[0]?.id;
  check('có xe KGARA_SYNC để thử', !!sid, `${sl.status}`);
  if (sid) {
    const before = (await api('GET', `/${sid}`, SYNC_BR)).d;
    const plate0 = before?.licensePlate ?? null;
    const o1 = await api('PATCH', `/${sid}`, SYNC_BR, { licensePlate: 'SMK-OVR-1', internalNotes: 'smoke override' });
    check('SYNC: sửa biển số/ghi chú 200 và overriddenFields', o1.status === 200 && o1.d?.licensePlate === 'SMK-OVR-1' && o1.d?.overriddenFields?.includes('licensePlate'), `${o1.status} ${JSON.stringify(o1.data)?.slice(0, 200)}`);
    check('SYNC: sửa số chứng từ (định danh) -> 400', (await api('PATCH', `/${sid}`, SYNC_BR, { caseCode: 'KHONG-DUOC' })).status === 400);
    check('SYNC: sửa dòng services kèm header -> 400', (await api('PATCH', `/${sid}`, SYNC_BR, { services: [] })).status === 400);
    const pg = await api('PATCH', `/${sid}/progress`, SYNC_BR, { progressStage: 'QC', progressPercent: 90 });
    check('SYNC: PATCH progress 200', pg.status === 200 && pg.d?.progressStage === 'QC', `${pg.status}`);
    const line = (await api('GET', `/${sid}`, SYNC_BR)).d?.services?.find((l) => l.externalId);
    if (line) {
      const pc = await api('PATCH', `/${sid}/services/${line.id}/parts-cost`, SYNC_BR, { partsCost: 12345 });
      const lpc = pc.d?.services?.find((l) => l.id === line.id);
      check('SYNC: sửa giá vốn dòng sync -> overriddenFields có partsCost', pc.status === 200 && lpc?.partsCost === 12345 && lpc?.overriddenFields?.includes('partsCost'), `${pc.status}`);
      const rmL = await api('DELETE', `/${sid}/services/${line.id}`, SYNC_BR);
      check('SYNC: xóa dòng sync ẩn dòng khỏi services', rmL.status === 200 && !rmL.d?.services?.some((l) => l.id === line.id), `${rmL.status}`);
      const rvL = await api('POST', `/${sid}/services/${line.id}/revert`, SYNC_BR, {});
      const restored = rvL.d?.services?.find((l) => l.id === line.id);
      check('SYNC: revert dòng khôi phục dòng, giá vốn và bỏ override', rvL.status === 201 || rvL.status === 200 ? !!restored && restored.overriddenFields.length === 0 && restored.partsCost === (line.partsCost ?? null) : false, `${rvL.status}`);
    }
    check('revert field chưa sửa đè -> 400', (await api('POST', `/${sid}/revert`, SYNC_BR, { fields: ['customerName'] })).status === 400);
    const rv = await api('POST', `/${sid}/revert`, SYNC_BR, {});
    check('SYNC: revert header về giá trị KGara', [200, 201].includes(rv.status) && (rv.d?.licensePlate ?? null) === plate0 && !rv.d?.overriddenFields?.includes('licensePlate'), `${rv.status} ${rv.d?.licensePlate}`);
    await api('PATCH', `/${sid}`, SYNC_BR, { internalNotes: before?.internalNotes ?? null });
    await api('PATCH', `/${sid}/progress`, SYNC_BR, { progressStage: null, progressPercent: null });
  }
}

const failed = results.filter((x) => !x).length;
console.log(`TOTAL ${results.length}, FAILED ${failed}`);
process.exit(failed ? 1 : 0);
