// Smoke luồng LEGACY (V1 → sổ nợ v2): phiếu thu V1 ghi bên trả KH, số tiền vượt nợ của khách trên vụ có bảo hiểm.
// Kỳ vọng: dòng CUSTOMER về 0, phần vượt trừ vào dòng INSURER, tổng số dư sổ nợ = V1 `tienConPhaiThanhToan`;
// xóa phiếu thì số dư hoàn lại như trước. Chỉ chạy trên staging/demo, KHÔNG production.
// Env: E2E_API_URL (mặc định suy từ PORT), E2E_PASSWORD (bắt buộc), E2E_TAO_EMAIL (mặc định ai-test-admin),
//   E2E_CASE_ID (bắt buộc: vụ đã kết thúc, có dòng CUSTOMER > 0 và INSURER > E2E_RECEIPT_EXTRA),
//   E2E_RECEIPT_EXTRA (phần vượt nợ khách, mặc định 100000). Cuối script xóa phiếu đã tạo.
import { resolveApiUrl } from './e2e-ports.mjs';

const BASE = resolveApiUrl();
const EMAIL = process.env.E2E_TAO_EMAIL ?? 'ai-test-admin@example.com';
const PASSWORD = process.env.E2E_PASSWORD;
const CASE_ID = process.env.E2E_CASE_ID;
const EXTRA = Number(process.env.E2E_RECEIPT_EXTRA ?? 100000);
if (!PASSWORD || !CASE_ID) {
  console.error('Thiếu E2E_PASSWORD hoặc E2E_CASE_ID.');
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

async function call(method, path, body) {
  const r = await fetch(`${BASE}${path}`, {
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

const num = (v) => Math.round(Number(v ?? 0));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Số dư sổ nợ phải thu của vụ, theo bên nợ, và số còn thu của V1. */
async function snapshot() {
  const led = await call(
    'GET',
    `/api/v2/debts-garage/ledger?caseId=${CASE_ID}&direction=RECEIVABLE&pageSize=50`,
  );
  const items = led.d?.items ?? led.d ?? [];
  const by = (p) =>
    items
      .filter((i) => i.partyType === p)
      .reduce((s, i) => s + num(i.balanceAmount), 0);
  const v1 = await call('GET', `/api/v1/greenway/cases/${CASE_ID}`);
  return {
    status: `${led.status}/${v1.status}`,
    cus: by('CUSTOMER'),
    ins: by('INSURER'),
    total: items.reduce((s, i) => s + num(i.balanceAmount), 0),
    v1: num(v1.d?.tienConPhaiThanhToan),
  };
}

/** Projector V1 → v2 chạy sau commit: chờ tới khi sổ nợ đạt điều kiện (tối đa ~15 giây). */
async function waitFor(pred) {
  let s = await snapshot();
  for (let i = 0; i < 15 && !pred(s); i += 1) {
    await sleep(1000);
    s = await snapshot();
  }
  return s;
}

const before = await snapshot();
console.log('Trước:', JSON.stringify(before));
check('đọc sổ nợ và vụ V1 -> 200', before.status === '200/200', before.status);
check(
  'trước smoke: sổ nợ = V1',
  before.total === before.v1,
  `${before.total} vs ${before.v1}`,
);
if (!(before.cus > 0 && before.ins > EXTRA)) {
  console.error(
    `Vụ không phù hợp: CUSTOMER ${before.cus}, INSURER ${before.ins}, cần INSURER > ${EXTRA}.`,
  );
  process.exit(2);
}

const amount = before.cus + EXTRA;
let id = null;
try {
  const created = await call('POST', '/api/v1/greenway/cashflow-vouchers', {
    voucherType: 'RECEIPT',
    amount,
    transDate: new Date().toISOString().slice(0, 10),
    paymentStatus: 'PAID',
    payerType: 'KH',
    caseId: CASE_ID,
    note: 'SMOKE garage-debts-legacy-split',
  });
  id = created.d?.id ?? null;
  check(
    'V1 tạo phiếu thu KH gắn vụ -> 201',
    created.status === 201 && Boolean(id),
    `status=${created.status}`,
  );

  const after = await waitFor((s) => s.total === before.total - amount);
  console.log('Sau thu:', JSON.stringify(after));
  check('dòng CUSTOMER về 0', after.cus === 0, `${after.cus}`);
  check(
    'phần vượt trừ vào dòng INSURER',
    after.ins === before.ins - EXTRA,
    `${after.ins} vs ${before.ins - EXTRA}`,
  );
  check(
    'V1 giảm đúng số thu',
    after.v1 === before.v1 - amount,
    `${after.v1} vs ${before.v1 - amount}`,
  );
  check(
    'sau thu: sổ nợ = V1',
    after.total === after.v1,
    `${after.total} vs ${after.v1}`,
  );
} finally {
  if (id) {
    const del = await call(
      'DELETE',
      `/api/v1/greenway/cashflow-vouchers/${id}`,
    );
    check(
      'V1 xóa phiếu -> 200',
      del.status === 200 || del.status === 204,
      `status=${del.status}`,
    );
    const back = await waitFor((s) => s.total === before.total);
    console.log('Sau xóa:', JSON.stringify(back));
    check(
      'xóa phiếu: CUSTOMER hoàn lại',
      back.cus === before.cus,
      `${back.cus} vs ${before.cus}`,
    );
    check(
      'xóa phiếu: INSURER hoàn lại',
      back.ins === before.ins,
      `${back.ins} vs ${before.ins}`,
    );
    check(
      'xóa phiếu: sổ nợ = V1',
      back.total === back.v1,
      `${back.total} vs ${back.v1}`,
    );
  }
}

const failed = results.filter((r) => !r).length;
console.log(`TOTAL ${results.length}, FAILED ${failed}`);
process.exit(failed ? 1 : 0);
