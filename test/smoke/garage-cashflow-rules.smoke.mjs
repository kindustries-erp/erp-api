// Smoke luật phiếu thu chi garage theo loại phiếu, đồng bộ V1 <-> V2 và lọc quá hạn.
// Chỉ chạy trên staging/dev, KHÔNG production. Env: E2E_API_URL (mặc định suy từ PORT),
// E2E_TAO_EMAIL (mặc định ai-test-admin), E2E_PASSWORD (bắt buộc).
// Phiếu thử không gắn phiếu dịch vụ nên không đụng công nợ thật; cuối script xóa phiếu đã tạo.
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
if (!login.ok) {
  console.error(`login -> ${login.status}`);
  process.exit(1);
}
const token = (await login.json()).data?.accessToken;

async function call(prefix, method, path, body) {
  const r = await fetch(`${BASE}${prefix}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json().catch(() => null);
  return {
    status: r.status,
    ok: r.ok,
    body: data,
    d: data?.data ?? data,
    message: JSON.stringify(data?.message ?? data?.error ?? ''),
  };
}
const v1 = (...args) => call('/api/v1/greenway/cashflow-vouchers', ...args);
const v2 = (...args) => call('/api/v2/cashflow-vouchers-garage', ...args);

const day = (offset) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(
    new Date(Date.now() - offset * 86_400_000),
  );
const TAG = `SMOKE-RULES-${Date.now() % 1_000_000}`;
const created = [];

async function expect400(name, request, fragment) {
  const r = await request;
  if (r.ok && r.d?.id) created.push(r.d.id);
  check(
    name,
    r.status === 400 && r.message.includes(fragment),
    `${r.status} ${r.message}`,
  );
}
async function expectOk(name, request) {
  const r = await request;
  check(name, r.ok, `${r.status} ${r.message}`);
  return r;
}

/** Tìm phiếu theo mã trên danh sách V1, kèm bộ lọc cột nếu có. */
async function v1Find(tab, code, filters = {}) {
  const query = new URLSearchParams({
    tab,
    pageSize: '5',
    column_filters: JSON.stringify({ voucherCode: [code], ...filters }),
  });
  const r = await v1('GET', `?${query}`);
  const rows = r.body?.data?.data ?? r.body?.data ?? [];
  return Array.isArray(rows) ? rows.find((x) => x.voucherCode === code) : null;
}

const base = (patch) => ({
  amount: 1000,
  transDate: day(0),
  note: TAG,
  ...patch,
});
const receipt = (patch) =>
  base({
    voucherType: 'RECEIPT',
    paymentMethod: 'Tiền mặt',
    paymentContent: '2. Tất toán',
    ...patch,
  });
const payment = (patch) =>
  base({
    voucherType: 'PAYMENT',
    paymentMethod: 'Chuyển khoản khác',
    paymentContent: '9. Phụ tùng / vật tư',
    ...patch,
  });

try {
  // ---------- V1: luật chặn ----------
  await expect400(
    'V1 R1 số tiền 0',
    v1('POST', '', receipt({ amount: 0, paymentStatus: 'PAID' })),
    'lớn hơn 0',
  );
  await expect400(
    'V1 R2 đã thu thiếu phương thức',
    v1('POST', '', receipt({ paymentStatus: 'PAID', paymentMethod: '' })),
    'phương thức',
  );
  await expect400(
    'V1 R3 phiếu chi chọn BH thanh toán',
    v1(
      'POST',
      '',
      payment({ paymentStatus: 'PAID', paymentContent: '3. BH thanh toán' }),
    ),
    'không dùng cho phiếu chi',
  );
  await expect400(
    'V1 R4 KH thanh toán thiếu phiếu dịch vụ và lý do',
    v1(
      'POST',
      '',
      receipt({
        paymentStatus: 'PAID',
        paymentContent: '1. KH thanh toán',
        note: '',
      }),
    ),
    'cần gắn phiếu dịch vụ',
  );

  // ---------- V1 -> V2 ----------
  const a = await expectOk(
    'V1 tạo phiếu chi Chuyển khoản khác',
    v1('POST', '', payment({ paymentStatus: 'PENDING' })),
  );
  if (a.ok) {
    const id = a.d.id;
    const code = a.d.voucherCode;
    created.push(id);
    check('V1 R5 phiếu chi không tự điền đối tác', !a.d.partnerName);
    let mirror = await v2('GET', `/${id}`);
    check(
      'V1→V2 khớp trạng thái, phương thức, nội dung',
      mirror.d?.status === 'PENDING' &&
        mirror.d?.paymentMethod === 'Chuyển khoản khác' &&
        mirror.d?.paymentContent === '9. Phụ tùng / vật tư',
      `${mirror.status} ${JSON.stringify(mirror.d)?.slice(0, 300)}`,
    );
    await expectOk(
      'V1 thêm đối tác',
      v1('PUT', `/${id}`, { partnerName: 'SMOKE NCC' }),
    );
    const cleared = await expectOk(
      'V1 xóa đối tác bằng null',
      v1('PUT', `/${id}`, { partnerName: null }),
    );
    check('V1 đối tác đã trống', !cleared.d?.partnerName);
    mirror = await v2('GET', `/${id}`);
    check('V1→V2 đối tác cũng trống', !mirror.d?.partnerName);
    await expect400(
      'V1 sửa sang nội dung sai loại',
      v1('PUT', `/${id}`, { paymentContent: '1. KH thanh toán' }),
      'không dùng cho phiếu chi',
    );
    await expectOk(
      'V1 chuyển Đã chi',
      v1('PUT', `/${id}`, { paymentStatus: 'PAID' }),
    );
    const listed = await v1Find('vouchers', code, {
      paymentMethod: ['Chuyển khoản khác'],
    });
    check('V1 lọc được theo Chuyển khoản khác', !!listed);
  }

  // ---------- V2: luật chặn ----------
  const v2Body = (body) => {
    const { paymentStatus, ...rest } = body;
    return { ...rest, status: paymentStatus };
  };
  await expect400(
    'V2 R2 đã chi thiếu nội dung',
    v2(
      'POST',
      '',
      v2Body(payment({ paymentStatus: 'PAID', paymentContent: '' })),
    ),
    'nội dung',
  );
  await expect400(
    'V2 R3 phiếu thu chọn HHBH',
    v2(
      'POST',
      '',
      v2Body(receipt({ paymentStatus: 'PAID', paymentContent: '4. HHBH' })),
    ),
    'không dùng cho phiếu thu',
  );

  // ---------- V2 -> V1 và lọc quá hạn ----------
  const b = await expectOk(
    'V2 tạo dự thu quá hạn 100 ngày',
    v2(
      'POST',
      '',
      v2Body(
        receipt({
          paymentStatus: 'EXPECTED',
          paymentMethod: undefined,
          paymentContent: 'Dự thu hoàn tất phiếu dịch vụ',
          transDate: day(100),
        }),
      ),
    ),
  );
  if (b.ok) {
    const id = b.d.id;
    const code = b.d.voucherCode;
    created.push(id);

    check(
      'V1 lọc quá hạn: thuộc nhóm trên 90 ngày',
      !!(await v1Find('forecast', code, { overdueDays: ['D90_PLUS'] })),
    );
    check(
      'V1 lọc quá hạn: không thuộc nhóm 1-30',
      !(await v1Find('forecast', code, { overdueDays: ['D1_30'] })),
    );
    for (const [bucket, expected] of [
      ['D90_PLUS', true],
      ['D31_90', false],
    ]) {
      const r = await v2('GET', `?overdueBucket=${bucket}&pageSize=100`);
      const rows = r.d?.items ?? [];
      check(
        `V2 overdueBucket=${bucket} ${expected ? 'có' : 'không có'} phiếu thử`,
        r.ok && rows.some((x) => x.id === id) === expected,
        `${r.status} ${r.message} rows=${rows.length}`,
      );
    }

    await expect400(
      'V2 xác nhận đã thu khi chưa chọn lại nội dung',
      v2('POST', `/${id}/status`, { status: 'PAID' }),
      'phương thức',
    );
    await expectOk(
      'V2 chọn phương thức và nội dung',
      v2('PATCH', `/${id}`, {
        paymentMethod: 'Chuyển khoản',
        paymentContent: '2. Tất toán',
      }),
    );
    await expectOk(
      'V2 xác nhận đã thu',
      v2('POST', `/${id}/status`, { status: 'PAID' }),
    );
    const mirrored = await v1Find('vouchers', code);
    check(
      'V2→V1 khớp trạng thái, phương thức, nội dung',
      mirrored?.paymentStatus === 'PAID' &&
        mirrored?.paymentMethod === 'Chuyển khoản' &&
        mirrored?.paymentContent === '2. Tất toán',
      JSON.stringify(mirrored)?.slice(0, 300),
    );
  }
} finally {
  for (const id of created) {
    const r = await v1('DELETE', `/${id}`);
    console.log(`cleanup ${id} -> ${r.status}`);
  }
  console.log(`CREATED_IDS=${created.join(',')}`);
}

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} PASS`);
process.exit(failed ? 1 : 0);
