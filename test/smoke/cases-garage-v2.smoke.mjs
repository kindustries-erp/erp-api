// Smoke CRUD `api/v2/cases-garage` (xe NATIVE) trên API đang chạy. Chỉ chạy trên staging/dev, KHÔNG production.
// Env: E2E_API_URL (mặc định suy từ PORT), E2E_TAO_EMAIL (mặc định ai-test-duyet, có quyền GARAGE DELETE; ai-test-tao nhận 403 khi xóa), E2E_PASSWORD (bắt buộc).
// Dùng chi nhánh giả `smoke-<tag>` (và `smoke-<tag>-other`) nên không đụng dữ liệu chi nhánh thật;
// cuối script xóa mềm các xe đã tạo.
import { resolveApiUrl } from './e2e-ports.mjs';

const BASE = resolveApiUrl();
const EMAIL = process.env.E2E_TAO_EMAIL ?? 'ai-test-duyet@example.com';
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

const failed = results.filter((x) => !x).length;
console.log(`TOTAL ${results.length}, FAILED ${failed}`);
process.exit(failed ? 1 : 0);
