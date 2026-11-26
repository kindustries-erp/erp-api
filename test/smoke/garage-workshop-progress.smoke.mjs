// Smoke trang tiến độ xưởng `api/v2/cases-garage` (quyền garage_workshop): board, nhật ký công đoạn/ghi chú,
// sửa tay giờ, đổi status cha đóng công đoạn mở; đưa xe vào/bỏ khỏi bảng (giữ trạng thái, đổi trạng thái,
// tạo xe mới). Xe KGara đổi trạng thái (ghi đè) phủ ở unit spec vì chi nhánh giả không có xe sync. Chỉ chạy trên staging/dev, KHÔNG production.
// Dùng xe NATIVE (chi nhánh ERP theo E2E_ERP_BRANCH_ID, bỏ trống là không chi nhánh), xóa mềm ở cuối.
// Env: E2E_API_URL (mặc định suy từ PORT), E2E_TAO_EMAIL, E2E_PASSWORD (bắt buộc), E2E_ERP_BRANCH_ID (tùy chọn, id `branches_management`).
import { resolveApiUrl } from './e2e-ports.mjs';

const BASE = resolveApiUrl();
const EMAIL = process.env.E2E_TAO_EMAIL ?? 'ai-test-admin@example.com';
const PASSWORD = process.env.E2E_PASSWORD;
if (!PASSWORD) {
  console.error('Thiếu E2E_PASSWORD.');
  process.exit(2);
}
const tag = Date.now();
const BR = process.env.E2E_ERP_BRANCH_ID;
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ` :: ${detail}`}`);
};
const short = (v) => JSON.stringify(v)?.slice(0, 200);

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
  const r = await fetch(`${BASE}/api/v2/cases-garage${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(BR ? { 'x-erp-branch-id': BR } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json().catch(() => null);
  return { status: r.status, d: data?.data ?? data };
}
const ok = (r) => r.status === 200 || r.status === 201;
const boardRow = async (id) =>
  (await api('GET', '/workshop/board?pageSize=200')).d?.items?.find(
    (x) => x.id === id,
  );
const minutesAgo = (m) => new Date(Date.now() - m * 60_000).toISOString();

const created = await api('POST', '', {
  licensePlate: `WSP-${tag % 100000}`,
  vehicleBrandCode: 'VF',
  vehicleBrandName: 'VinFast',
  vehicleModelName: 'VF8',
  customerName: 'Smoke workshop',
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
const id = created.d?.id;
check('tạo xe NATIVE (INTAKE)', ok(created) && !!id, `${created.status}`);

if (id) {
  try {
    check('xe mới tạo chưa có trên bảng', !(await boardRow(id)), '');

    const cand = await api(
      'GET',
      `/workshop/candidates?search=${encodeURIComponent(`wsp ${tag % 100000}`)}`,
    );
    const c0 = cand.d?.items?.find((x) => x.id === id);
    check(
      'candidates: tìm theo biển số không dấu gạch, onBoard=false',
      ok(cand) && c0?.onBoard === false && c0?.status === 'INTAKE',
      short(cand),
    );

    const tr = await api('POST', '/workshop/track', { caseId: id });
    check(
      'track giữ trạng thái: không đổi status',
      ok(tr) && tr.d?.statusChanged === false && tr.d?.status === 'INTAKE',
      short(tr),
    );

    const row0 = await boardRow(id);
    check(
      'board: có xe INTAKE, chưa có công đoạn, origin NATIVE',
      row0?.status === 'INTAKE' &&
        row0?.stageStartedAt === null &&
        row0?.origin === 'NATIVE',
      short(row0),
    );

    const workers = await api('GET', '/workshop/workers?search=a');
    check(
      'workshop/workers trả danh sách nhân viên',
      ok(workers) && Array.isArray(workers.d?.items ?? workers.d),
      short(workers),
    );

    const s1 = await api('POST', `/${id}/progress-logs`, {
      kind: 'STAGE',
      stage: 'AWAITING_INSPECTION',
      startedAt: minutesAgo(30),
    });
    check('ghi STAGE AWAITING_INSPECTION (giờ sửa tay)', ok(s1), short(s1));

    const wrong = await api('POST', `/${id}/progress-logs`, {
      kind: 'STAGE',
      stage: 'REPAIRING',
    });
    check(
      'STAGE không thuộc INTAKE -> 400',
      wrong.status === 400,
      `${wrong.status}`,
    );

    const future = await api('POST', `/${id}/progress-logs`, {
      kind: 'STAGE',
      stage: 'INSPECTED',
      startedAt: new Date(Date.now() + 3_600_000).toISOString(),
    });
    check('giờ tương lai -> 400', future.status === 400, `${future.status}`);

    const note = await api('POST', `/${id}/progress-logs`, {
      kind: 'NOTE',
      note: 'Khách báo kêu gầm',
      workerName: 'Thợ smoke',
    });
    check(
      'ghi NOTE có người làm nhập tay',
      ok(note) && note.d?.workerName === 'Thợ smoke',
      short(note),
    );

    const s2 = await api('POST', `/${id}/progress-logs`, {
      kind: 'STAGE',
      stage: 'INSPECTED',
      startedAt: minutesAgo(10),
    });
    check('ghi STAGE INSPECTED', ok(s2), short(s2));

    const tl = (await api('GET', `/${id}/progress-logs`)).d?.items ?? [];
    const first = tl.find((x) => x.id === s1.d?.id);
    check(
      'timeline: 3 dòng, công đoạn đầu đã đóng ~20 phút',
      tl.length === 3 &&
        !!first?.endedAt &&
        first.durationMinutes >= 19 &&
        first.durationMinutes <= 21,
      short(tl.map((x) => [x.kind, x.stage, x.durationMinutes])),
    );

    const row1 = await boardRow(id);
    check(
      'board: công đoạn mở INSPECTED, đã trôi ~10 phút, ghi chú mới nhất',
      row1?.progressStage === 'INSPECTED' &&
        row1?.stageElapsedMinutes >= 9 &&
        row1?.stageElapsedMinutes <= 11 &&
        row1?.lastNote === 'Khách báo kêu gầm',
      short(row1),
    );

    const edit = await api('PATCH', `/progress-logs/${s1.d?.id}`, {
      startedAt: minutesAgo(40),
    });
    check(
      'sửa tay giờ bắt đầu công đoạn đã đóng',
      ok(edit) && edit.d?.durationMinutes >= 29,
      short(edit),
    );
    const badEnd = await api('PATCH', `/progress-logs/${s1.d?.id}`, {
      endedAt: minutesAgo(50),
    });
    check(
      'giờ kết thúc trước giờ bắt đầu -> 400',
      badEnd.status === 400,
      `${badEnd.status}`,
    );
    const reopen = await api('PATCH', `/progress-logs/${s1.d?.id}`, {
      endedAt: null,
    });
    check(
      'endedAt null (mở lại công đoạn đã đóng) -> 400',
      reopen.status === 400,
      `${reopen.status}`,
    );
    const overlap = await api('PATCH', `/progress-logs/${s1.d?.id}`, {
      endedAt: minutesAgo(5),
    });
    check(
      'giờ kết thúc chồng lên công đoạn sau -> 400',
      overlap.status === 400,
      `${overlap.status}`,
    );

    const del = await api('DELETE', `/progress-logs/${note.d?.id}`);
    const tl2 = (await api('GET', `/${id}/progress-logs`)).d?.items ?? [];
    check(
      'xóa mềm ghi chú, timeline còn 2 dòng',
      ok(del) && tl2.length === 2,
      `${del.status} ${tl2.length}`,
    );

    const mv = await api('PATCH', `/${id}/status`, { status: 'QUOTED' });
    const tl3 = (await api('GET', `/${id}/progress-logs`)).d?.items ?? [];
    const row2 = await boardRow(id);
    check(
      'đổi status cha QUOTED: đóng công đoạn mở, bỏ status nhỏ cũ',
      ok(mv) &&
        tl3.every((x) => x.endedAt !== null) &&
        row2?.status === 'QUOTED' &&
        row2?.progressStage === null &&
        row2?.stageStartedAt === null,
      short({ s: mv.status, row2, tl3 }),
    );

    const pg = await api('PATCH', `/${id}/progress`, {
      progressStage: 'AWAITING_APPROVAL',
    });
    const tl4 = (await api('GET', `/${id}/progress-logs`)).d?.items ?? [];
    check(
      'PATCH progress đổi công đoạn: mở dòng STAGE mới trong nhật ký',
      ok(pg) &&
        tl4.length === 3 &&
        tl4.some((x) => x.stage === 'AWAITING_APPROVAL' && x.endedAt === null),
      short({ s: pg.status, tl4 }),
    );

    const bad = await api('POST', '/workshop/track', {
      caseId: id,
      status: 'INTAKE',
    });
    check(
      'track NATIVE QUOTED → INTAKE (sai bảng chuyển) -> 400',
      bad.status === 400,
      `${bad.status}`,
    );

    const tr2 = await api('POST', '/workshop/track', {
      caseId: id,
      status: 'IN_PROGRESS',
    });
    const row3 = await boardRow(id);
    check(
      'track đổi trạng thái: QUOTED → IN_PROGRESS, giữ mốc đưa vào bảng',
      ok(tr2) &&
        tr2.d?.statusChanged === true &&
        row3?.status === 'IN_PROGRESS' &&
        row3?.workshopTrackedAt === tr.d?.workshopTrackedAt,
      short({ tr2, row3 }),
    );

    const un = await api('DELETE', `/workshop/track/${id}`);
    const cand2 = await api(
      'GET',
      `/workshop/candidates?search=${encodeURIComponent(created.d?.caseCode ?? '')}`,
    );
    check(
      'bỏ khỏi bảng: không còn trên board, candidates onBoard=false, nhật ký còn',
      ok(un) &&
        !(await boardRow(id)) &&
        cand2.d?.items?.find((x) => x.id === id)?.onBoard === false &&
        ((await api('GET', `/${id}/progress-logs`)).d?.items ?? []).length ===
          3,
      short({ un, cand2 }),
    );
  } finally {
    await api('DELETE', `/${id}`);
  }
}

// Xe chưa có trong hệ thống: tạo NATIVE rồi đưa vào bảng.
const newPlate = `wsn ${tag % 100000}`;
const tn = await api('POST', '/workshop/track-new', {
  licensePlate: newPlate,
  customerName: 'Smoke mới',
});
const newId = tn.d?.caseId;
try {
  const rowN = newId ? await boardRow(newId) : null;
  check(
    'track-new: tạo xe INTAKE, biển số viết hoa, có trên bảng',
    ok(tn) &&
      tn.d?.created === true &&
      tn.d?.licensePlate === newPlate.toUpperCase() &&
      rowN?.status === 'INTAKE' &&
      !!rowN?.receivedAt,
    short({ tn, rowN }),
  );
  const dup = await api('POST', '/workshop/track-new', {
    licensePlate: `WSN-${tag % 100000}`,
  });
  check(
    'track-new trùng biển số xe đang mở -> 409',
    dup.status === 409,
    short(dup),
  );
  const tnIp = await api('POST', '/workshop/track-new', {
    licensePlate: `WSQ-${tag % 100000}`,
    status: 'IN_PROGRESS',
  });
  check(
    'track-new vào thẳng IN_PROGRESS',
    ok(tnIp) &&
      tnIp.d?.status === 'IN_PROGRESS' &&
      tnIp.d?.statusChanged === true,
    short(tnIp),
  );
  if (tnIp.d?.caseId) await api('DELETE', `/${tnIp.d.caseId}`);
  const tnBad = await api('POST', '/workshop/track-new', {
    licensePlate: ' -- ',
  });
  check(
    'track-new biển số không có chữ/số -> 400',
    tnBad.status === 400,
    short(tnBad),
  );
} finally {
  if (newId) await api('DELETE', `/${newId}`);
}

const failed = results.filter((x) => !x).length;
console.log(`TOTAL ${results.length}, FAILED ${failed}`);
process.exit(failed ? 1 : 0);
