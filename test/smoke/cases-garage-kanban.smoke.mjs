// Smoke Kanban `api/v2/cases-garage`: đổi status xe sync tự do (QUOTED -> INTAKE), revert, đổi công đoạn,
// và NATIVE vẫn bị chặn bước lùi. Chỉ chạy trên staging/dev, KHÔNG production. Luôn hoàn trạng thái cũ ở cuối.
// Env: E2E_API_URL (mặc định suy từ PORT), E2E_TAO_EMAIL, E2E_PASSWORD (bắt buộc), E2E_SYNC_BRANCH (bắt buộc, id chi nhánh ERP `branches_management` có xe KGARA_SYNC).
import { resolveApiUrl } from './e2e-ports.mjs';

const BASE = resolveApiUrl();
const EMAIL = process.env.E2E_TAO_EMAIL ?? 'ai-test-admin@example.com';
const PASSWORD = process.env.E2E_PASSWORD;
const SYNC_BR = process.env.E2E_SYNC_BRANCH;
if (!PASSWORD || !SYNC_BR) {
  console.error('Thiếu E2E_PASSWORD hoặc E2E_SYNC_BRANCH.');
  process.exit(2);
}
const tag = Date.now();
// Xe NATIVE tạo trên cùng chi nhánh ERP với xe sync.
const BR = SYNC_BR;
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
      'x-erp-branch-id': branch,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json().catch(() => null);
  return { status: r.status, d: data?.data ?? data };
}
const progressOf = async (branch, status, id) => {
  const r = await api('GET', `/progress?status=${status}&pageSize=200`, branch);
  return r.d?.items?.find((x) => x.id === id);
};
const ok = (r) => r.status === 200 || r.status === 201;

// 1. Xe sync đang QUOTED: kéo về INTAKE (v2 ghi đè), KGara giữ nguyên.
const list = await api('GET', '/progress?status=QUOTED&pageSize=1', SYNC_BR);
const target = list.d?.items?.[0];
if (!target) {
  console.log('INFO không có xe KGARA_SYNC đang QUOTED, bỏ qua phần xe sync');
} else {
  const sid = target.id;
  const before = (await api('GET', `/${sid}`, SYNC_BR)).d;
  try {
    const mv = await api('PATCH', `/${sid}/status`, SYNC_BR, {
      status: 'INTAKE',
    });
    check(
      'SYNC: QUOTED -> INTAKE được phép',
      ok(mv),
      `${mv.status} ${JSON.stringify(mv.d)?.slice(0, 160)}`,
    );
    const after = await progressOf(SYNC_BR, 'INTAKE', sid);
    check(
      'SYNC: /progress?status=INTAKE có xe, đánh dấu ghi đè status',
      !!after && after.overriddenFields?.includes('status'),
      JSON.stringify(after)?.slice(0, 160),
    );
    const detail = (await api('GET', `/${sid}`, SYNC_BR)).d;
    check(
      'SYNC: kgaraStatusCode không đổi',
      detail?.kgaraStatusCode === before?.kgaraStatusCode,
      `${detail?.kgaraStatusCode} vs ${before?.kgaraStatusCode}`,
    );

    const rv = await api('POST', `/${sid}/revert`, SYNC_BR, {
      fields: ['status'],
    });
    check('SYNC: revert status', ok(rv), `${rv.status}`);
    const back = await progressOf(SYNC_BR, 'QUOTED', sid);
    check(
      'SYNC: về QUOTED và gỡ ghi đè',
      !!back && !back.overriddenFields?.includes('status'),
      JSON.stringify(back)?.slice(0, 160),
    );
  } finally {
    const cur = (await api('GET', `/${sid}`, SYNC_BR)).d;
    if (cur?.status !== before?.status)
      await api('POST', `/${sid}/revert`, SYNC_BR, { fields: ['status'] });
  }
}

// 2. Xe NATIVE: bước lùi ngoài bảng chuyển bị chặn; công đoạn đổi được.
const created = await api('POST', '', BR, {
  licensePlate: `KBN-${tag % 100000}`,
  vehicleBrandCode: 'VF',
  vehicleBrandName: 'VinFast',
  vehicleModelName: 'VF8',
  customerName: 'Smoke kanban',
  payerName: 'Smoke payer',
  services: [
    {
      productTypeCode: 'DV',
      productName: 'Công',
      quantity: 1,
      unitPrice: 100000,
      taxRate: 10,
    },
  ],
});
const nid = created.d?.id;
check('tạo xe NATIVE', ok(created) && !!nid, `${created.status}`);
if (nid) {
  const q = await api('PATCH', `/${nid}/status`, BR, { status: 'QUOTED' });
  const back = await api('PATCH', `/${nid}/status`, BR, { status: 'INTAKE' });
  check(
    'NATIVE: QUOTED -> INTAKE bị chặn 400',
    ok(q) && back.status === 400,
    `${q.status}/${back.status}`,
  );
  const run = await api('PATCH', `/${nid}/status`, BR, {
    status: 'IN_PROGRESS',
  });
  const st = await api('PATCH', `/${nid}/progress`, BR, {
    progressStage: 'PAINTING',
  });
  check(
    'NATIVE: đổi công đoạn PAINTING',
    ok(run) && ok(st),
    `${run.status}/${st.status}`,
  );
  const row = await progressOf(BR, 'IN_PROGRESS', nid);
  check(
    'NATIVE: /progress phản ánh công đoạn',
    row?.progressStage === 'PAINTING',
    JSON.stringify(row)?.slice(0, 160),
  );
  await api('DELETE', `/${nid}`, BR);
}

const failed = results.filter((x) => !x).length;
console.log(`TOTAL ${results.length}, FAILED ${failed}`);
process.exit(failed ? 1 : 0);
