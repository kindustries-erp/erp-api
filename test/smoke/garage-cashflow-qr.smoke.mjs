// Smoke lưu thông tin thanh toán QR của phiếu thu chi garage V1 (`api/v1/greenway/cashflow-vouchers`, KINDU-2096).
// Chỉ chạy trên staging/dev, KHÔNG production. Env: E2E_API_URL (mặc định suy từ PORT),
// E2E_TAO_EMAIL (mặc định ai-test-admin), E2E_PASSWORD (bắt buộc). Cuối script xóa phiếu đã tạo.
import { resolveApiUrl } from './e2e-ports.mjs';

const BASE = resolveApiUrl();
const EMAIL = process.env.E2E_TAO_EMAIL ?? 'ai-test-admin@example.com';
const PASSWORD = process.env.E2E_PASSWORD;
if (!PASSWORD) {
  console.error('Thiếu E2E_PASSWORD.');
  process.exit(2);
}
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

async function api(method, path, body) {
  const r = await fetch(`${BASE}/api/v1/greenway/cashflow-vouchers${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
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
  return { status: r.status, d: data?.data ?? data };
}

const QR = {
  qrBankBin: '970418',
  qrBankCode: 'BIDV',
  qrAccountNumber: '1240000123456',
  qrAccountName: 'SMOKE QR',
  qrTransferContent: `SMOKE QR ${Date.now() % 100000}`,
};
const sameQr = (v, exp) =>
  Object.entries(exp).every(([k, val]) => (v?.[k] ?? null) === val);

let id = null;
try {
  // 1. Tạo phiếu thu kèm thông tin thanh toán: response trả lại đủ field qr*.
  const created = await api('POST', '', {
    voucherType: 'RECEIPT',
    amount: 1000,
    transDate: new Date().toISOString().slice(0, 10),
    note: 'SMOKE garage-cashflow-qr',
    ...QR,
  });
  id = created.d?.id ?? null;
  check(
    'POST tạo phiếu thu có QR -> 201',
    created.status === 201 && Boolean(id),
    `status=${created.status} ${JSON.stringify(created.d)?.slice(0, 200)}`,
  );
  check(
    'POST response có đủ field qr*',
    sameQr(created.d, QR),
    JSON.stringify(created.d),
  );
  const code = created.d?.voucherCode;

  // 2. Cập nhật một phần: field không gửi giữ nguyên, chuỗi rỗng thành null.
  const upd = await api('PUT', `/${id}`, {
    qrAccountNumber: '999888777',
    qrTransferContent: '',
  });
  const expUpd = {
    ...QR,
    qrAccountNumber: '999888777',
    qrTransferContent: null,
  };
  check('PUT cập nhật QR -> 200', upd.status === 200, `status=${upd.status}`);
  check(
    'PUT giữ field không gửi, rỗng thành null',
    sameQr(upd.d, expUpd),
    JSON.stringify(upd.d),
  );

  // 3. Validate: BIN sai và số TK có ký tự lạ -> 400.
  const badBin = await api('PUT', `/${id}`, { qrBankBin: '12AB' });
  check(
    'PUT qrBankBin sai -> 400',
    badBin.status === 400,
    `status=${badBin.status}`,
  );
  const badAcc = await api('PUT', `/${id}`, { qrAccountNumber: '12-34 56' });
  check(
    'PUT qrAccountNumber sai -> 400',
    badAcc.status === 400,
    `status=${badAcc.status}`,
  );

  // 3b. Khoảng trắng hai đầu được cắt trước validate (không 400).
  const padded = await api('PUT', `/${id}`, { qrBankBin: ' 970418 ' });
  check(
    'PUT qrBankBin có khoảng trắng -> 200, lưu đã cắt',
    padded.status === 200 && padded.d?.qrBankBin === '970418',
    `status=${padded.status} ${padded.d?.qrBankBin}`,
  );

  // 4. Đọc lại qua list (không có GET :id): giá trị đã lưu DB.
  const filters = encodeURIComponent(JSON.stringify({ voucherCode: [code] }));
  const list = await api(
    'GET',
    `?tab=all&pageSize=5&column_filters=${filters}`,
  );
  const rows =
    list.d?.data ?? list.d?.items ?? (Array.isArray(list.d) ? list.d : []);
  const row = rows.find((r) => r.id === id);
  check(
    'LIST tìm thấy phiếu',
    list.status === 200 && Boolean(row),
    `status=${list.status} rows=${rows.length}`,
  );
  check('LIST trả QR đã lưu', sameQr(row, expUpd), JSON.stringify(row));

  // 5. Xóa thông tin thanh toán bằng null.
  const clr = await api('PUT', `/${id}`, {
    qrBankBin: null,
    qrAccountNumber: null,
  });
  check(
    'PUT null xóa QR',
    clr.status === 200 &&
      clr.d?.qrBankBin === null &&
      clr.d?.qrAccountNumber === null,
    `status=${clr.status} ${JSON.stringify(clr.d)}`,
  );
} finally {
  if (id) {
    const del = await api('DELETE', `/${id}`);
    check(
      'DELETE dọn phiếu smoke',
      del.status === 200 || del.status === 204,
      `status=${del.status}`,
    );
  }
}

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} PASS`);
process.exit(failed ? 1 : 0);
