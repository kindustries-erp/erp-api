// Smoke ĐỌC-ONLY đối chiếu dashboard garage V1 và V2 cùng một kỳ. Không ghi DB.
// Phạm vi:
//  (1) KPI kỳ (tháng/tuần/ngày): V1 `/api/v1/greenway/dashboard/checkpoint-kpis` so với V2 `/api/v2/cases-dashboard-garage/period-kpis`.
//  (2) Giai đoạn tháng hiện tại: V1 `checkpoint-kpis.month.stages` so với V2 `period-kpis.month.stages`.
//  (3) Phễu tháng hiện tại: V1 `/api/v1/greenway/dashboard/stats` (conversionFunnelByMonth) so với V2 `/api/v2/cases-dashboard-garage/funnel`.
//  (4) Drill-down theo XE: V1 `checkpoint-cases?group_by=vehicle` và V2 `/vehicles` có số hàng (total) = số xe của thẻ cùng giai đoạn,
//      mỗi khóa xe xuất hiện đúng một hàng, và tổng `caseCount` các hàng = số lệnh (khi gọn một trang).
// Quy tắc so khớp (hướng 2):
//  - Số lệnh, tiền, doanh thu: phải bằng nhau tuyệt đối.
//  - Số xe, và số xe + tiền của giai đoạn/phễu: V2 có thể lớn hơn V1 do xe NATIVE (tạo trực tiếp trên V2).
//    Chênh lệch dương được ghi là KỲ VỌNG (NATIVE); V2 nhỏ hơn V1 hoặc tiền lệch khi số xe bằng nhau là LỖI.
// Env: E2E_API_URL (mặc định suy từ PORT), E2E_TAO_EMAIL (mặc định ai-test-duyet), E2E_PASSWORD (bắt buộc).
// Exit 0 khi không có LỖI.
import { resolveApiUrl } from './e2e-ports.mjs';

const BASE = resolveApiUrl();
const EMAIL = process.env.E2E_TAO_EMAIL ?? 'ai-test-duyet@example.com';
const PASSWORD = process.env.E2E_PASSWORD;
if (!PASSWORD) {
  console.error('Thiếu E2E_PASSWORD.');
  process.exit(2);
}

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

async function get(path) {
  const r = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await r.json().catch(() => null);
  return { status: r.status, data: body?.data ?? body };
}

// Tháng hiện tại theo giờ máy chủ (V1 và V2 dùng cùng giờ máy chủ).
const now = new Date();
const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
const monthFrom = `${ym}-01`;
const monthTo = `${ym}-${String(lastDay).padStart(2, '0')}`;

const v1 = await get('/api/v1/greenway/dashboard/checkpoint-kpis');
const v2 = await get('/api/v2/cases-dashboard-garage/period-kpis');
const v1Stats = await get(
  `/api/v1/greenway/dashboard/stats?date_from=${monthFrom}&date_to=${monthTo}`,
);
const v2Funnel = await get(
  `/api/v2/cases-dashboard-garage/funnel?date_from=${monthFrom}&date_to=${monthTo}`,
);
if (
  v1.status !== 200 ||
  v2.status !== 200 ||
  v1Stats.status !== 200 ||
  v2Funnel.status !== 200
) {
  console.error(
    `V1 kpis ${v1.status}, V2 kpis ${v2.status}, V1 stats ${v1Stats.status}, V2 funnel ${v2Funnel.status}`,
  );
  process.exit(1);
}

let failures = 0;
let expectedNative = 0;
const rows = [];
const record = (scope, label, x, y, rule) => {
  const xn = Number(x ?? 0);
  const yn = Number(y ?? 0);
  let status;
  if (xn === yn) {
    status = 'PASS';
  } else if (rule.allowNative && yn > xn) {
    status = 'KỲ VỌNG (NATIVE)';
    if (rule.kind === 'xe') expectedNative += yn - xn;
  } else {
    status = 'LỖI';
    failures++;
  }
  rows.push({ phạm_vi: scope, chỉ_số: label, V1: xn, V2: yn, kết_quả: status });
};

// (1) KPI kỳ.
for (const k of ['month', 'week', 'day']) {
  const a = v1.data[k] ?? {};
  const b = v2.data[k] ?? {};
  record(
    `kỳ ${k}`,
    'xe (stages.totalIntake)',
    a.stages?.totalIntake,
    b.totalVehicles,
    { allowNative: true, kind: 'xe' },
  );
  record(`kỳ ${k}`, 'lệnh', a.totalCases, b.totalCases, { allowNative: false });
  record(`kỳ ${k}`, 'tiền có thuế', a.totalTienCoThue, b.totalAmountWithTax, {
    allowNative: false,
  });
  record(`kỳ ${k}`, 'doanh thu', a.totalRevenue, b.revenue, {
    allowNative: false,
  });
}

// (2) Giai đoạn tháng (headline V1 so với V2 period-kpis).
const v1m = v1.data.month?.stages ?? {};
const v2m = v2.data.month?.stages ?? {};
for (const st of ['quotation', 'inProgress', 'completed', 'cancelled']) {
  const label = `giai đoạn ${st}`;
  record('giai đoạn tháng', `${label} (xe)`, v1m[st], v2m[st]?.vehicles, {
    allowNative: true,
    kind: 'xe',
  });
}

// (3) Phễu tháng: V1 conversionFunnelByMonth[ym] so với V2 funnel.overall.
const v1Funnel = v1Stats.data.conversionFunnelByMonth?.[ym];
const v2Overall = v2Funnel.data.overall;
if (!v1Funnel || !v2Overall) {
  console.error(
    `Thiếu phễu tháng ${ym}: V1 ${Boolean(v1Funnel)}, V2 ${Boolean(v2Overall)}`,
  );
  process.exit(1);
}
record(
  'phễu tháng',
  'tổng xe tiếp nhận',
  v1Funnel.totalIntake?.count,
  v2Overall.totalVehicles,
  { allowNative: true, kind: 'xe' },
);
for (const st of ['quotation', 'inProgress', 'completed', 'cancelled']) {
  const a = v1Funnel[st] ?? {};
  const b = v2Overall.stages?.[st] ?? {};
  record('phễu tháng', `${st} (xe)`, a.count, b.vehicles, {
    allowNative: true,
    kind: 'xe',
  });
  // Tiền: chỉ chấp nhận lệch dương khi số xe cũng lệch dương (phần NATIVE). Số xe bằng nhau mà tiền lệch là LỖI.
  const sameVehicles = Number(a.count ?? 0) === Number(b.vehicles ?? 0);
  record('phễu tháng', `${st} (tiền)`, a.amount, b.amount, {
    allowNative: !sameVehicles,
    kind: 'tiền',
  });
}

// (4) Drill-down theo xe: số hàng bảng phải bằng số xe trên thẻ, không đếm lại theo lệnh.
const drillRows = [];
const drillCheck = (scope, label, ok, detail) => {
  if (!ok) failures++;
  drillRows.push({
    phạm_vi: scope,
    kiểm: label,
    kết_quả: ok ? 'PASS' : 'LỖI',
    chi_tiết: detail,
  });
};
const v1Drill = async (extra) =>
  get(
    `/api/v1/greenway/dashboard/checkpoint-cases?date_from=${monthFrom}&date_to=${monthTo}&pageSize=100&group_by=vehicle&${extra}`,
  );
for (const [label, extra, expected] of [
  ['Tổng tiếp nhận', 'is_funnel=true', v1Funnel.totalIntake?.count],
  ['Báo giá', 'is_funnel=true&status=quotation', v1Funnel.quotation?.count],
  ['Đang làm', 'is_funnel=true&status=in_progress', v1Funnel.inProgress?.count],
  ['Hoàn thành', 'is_funnel=true&status=completed', v1Funnel.completed?.count],
]) {
  const r = await v1Drill(extra);
  if (r.status !== 200) {
    drillCheck(`V1 ${label}`, 'HTTP 200', false, `status ${r.status}`);
    continue;
  }
  const items = r.data.items ?? [];
  const keys = new Set(items.map((x) => x.vehicleKey));
  drillCheck(
    `V1 ${label}`,
    'total = số xe của thẻ',
    Number(r.data.total) === Number(expected ?? 0),
    `total ${r.data.total}, thẻ ${expected}`,
  );
  drillCheck(
    `V1 ${label}`,
    'mỗi xe một hàng',
    keys.size === items.length,
    `${keys.size}/${items.length}`,
  );
  if (r.data.total <= 100) {
    const cases = items.reduce((n, x) => n + x.caseCount, 0);
    const nested = items.reduce((n, x) => n + (x.cases?.length ?? 0), 0);
    drillCheck(
      `V1 ${label}`,
      'Σ caseCount = Σ lệnh lồng',
      cases === nested,
      `${cases}/${nested}`,
    );
  }
}
const v2Drill = async (extra = '') =>
  get(
    `/api/v2/cases-dashboard-garage/vehicles?date_from=${monthFrom}&date_to=${monthTo}&pageSize=100${extra}`,
  );
for (const [label, extra, expected] of [
  ['Tổng tiếp nhận', '', v2Overall.totalVehicles],
  ['Báo giá', '&stage=quotation', v2Overall.stages?.quotation?.vehicles],
  ['Hoàn thành', '&stage=completed', v2Overall.stages?.completed?.vehicles],
]) {
  const r = await v2Drill(extra);
  if (r.status !== 200) {
    drillCheck(`V2 ${label}`, 'HTTP 200', false, `status ${r.status}`);
    continue;
  }
  const items = r.data.items ?? [];
  const keys = new Set(items.map((x) => x.vehicleKey));
  drillCheck(
    `V2 ${label}`,
    'pagination.total = số xe của thẻ',
    Number(r.data.pagination?.total) === Number(expected ?? 0),
    `total ${r.data.pagination?.total}, thẻ ${expected}`,
  );
  drillCheck(
    `V2 ${label}`,
    'mỗi xe một hàng',
    keys.size === items.length,
    `${keys.size}/${items.length}`,
  );
}

console.table(rows);
console.table(drillRows);
console.log(
  `Kỳ tháng ${ym}. TOTAL ${rows.length}, LỖI ${failures}, chênh lệch xe NATIVE (kỳ vọng, cộng dồn) ${expectedNative}`,
);
process.exit(failures === 0 ? 0 : 1);
