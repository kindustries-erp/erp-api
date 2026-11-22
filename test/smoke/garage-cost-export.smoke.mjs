// Smoke giá vốn phụ tùng garage (KINDU-1386/1392): sau `POST sync/gross-profit`, Excel xuất + V2 partsCost
// phải > 0 và KHÔNG đổi sau khi mở drawer (sync-parity). CHỈ chạy staging/dev; ghi DB staging qua sync.
// Env: E2E_API_URL (mặc định suy từ PORT), E2E_PASSWORD (bắt buộc, đọc từ .env nếu shell chưa có),
//      SMOKE_FROM / SMOKE_TO (mặc định 2026-10-01..2026-10-31), SMOKE_CODES (danh sách mã, phẩy ngăn cách).
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveApiUrl } from './e2e-ports.mjs';

const ENV = resolve(dirname(fileURLToPath(import.meta.url)), '../../.env');
const envText = readFileSync(ENV, 'utf8');
const envVar = (k) =>
  envText
    .match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]
    ?.trim()
    .replace(/^["']|["']$/g, '');

const dbName =
  (envVar('DATABASE_URL') ?? '').split('?')[0].split('/').pop() ?? '';
if (!dbName || /prod/i.test(dbName)) {
  console.error(`Từ chối chạy: DB "${dbName}" không phải staging/dev.`);
  process.exit(2);
}
console.log(`DB: ${dbName}`);

const BASE = resolveApiUrl();
const PASSWORD = process.env.E2E_PASSWORD ?? envVar('E2E_PASSWORD');
if (!PASSWORD) {
  console.error('Thiếu E2E_PASSWORD.');
  process.exit(2);
}
const FROM = process.env.SMOKE_FROM ?? '2026-10-01';
const TO = process.env.SMOKE_TO ?? '2026-11-30';
const CODES = (
  process.env.SMOKE_CODES ?? 'GR-PDV2610-0048,GR-PDV2610-0054,GR-PDV2610-0055'
).split(',');

let fails = 0;
const check = (name, ok, detail = '') => {
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ` :: ${detail}`}`);
};

const login = await fetch(`${BASE}/api/v2/auth-sessions/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'ai-test-admin@example.com',
    password: PASSWORD,
  }),
});
if (![200, 201].includes(login.status)) {
  console.error(`login -> ${login.status}`);
  process.exit(1);
}
const token = (await login.json()).data?.accessToken;
const auth = { Authorization: `Bearer ${token}` };

const br = await (
  await fetch(`${BASE}/api/v1/greenway/branches`, { headers: auth })
).json();
const branch = (br.data ?? br)?.[0];
// Mọi API (V1, V2, sync) dùng externalId của chi nhánh trong header.
const H1 = { ...auth, 'x-kgara-branch-id': branch?.externalId };
const H = { ...auth, 'x-kgara-branch-id': branch?.externalId };
const getJson = async (p, h = H) =>
  (await fetch(`${BASE}${p}`, { headers: h })).json().catch(() => null);

const num = (v) => Number(v ?? 0);
const rows = (b) =>
  b?.data?.items ?? b?.items ?? b?.data?.rows ?? b?.data ?? [];

async function exportCosts(code) {
  const r = await fetch(
    `${BASE}/api/v1/greenway/cases/services/export/excel?from=${FROM}&to=${TO}&q=${encodeURIComponent(code)}`,
    { headers: H1 },
  );
  if (r.status !== 200) return { status: r.status, total: null };
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await r.arrayBuffer()));
  let total = 0;
  const val = (c) =>
    c && typeof c === 'object' && 'result' in c ? c.result : c;
  for (const ws of wb.worksheets) {
    let headRow = 0;
    let head = [];
    for (let i = 1; i <= Math.min(ws.rowCount, 10) && !headRow; i++) {
      const v = ws.getRow(i).values;
      if (v.some((h) => String(h ?? '').trim() === 'Tổng vốn')) {
        headRow = i;
        head = v;
      }
    }
    if (!headRow) continue;
    const iTotal = head.findIndex((h) => String(h ?? '').trim() === 'Tổng vốn');
    const iUnit = head.findIndex(
      (h) => String(h ?? '').trim() === 'Đơn giá vốn',
    );
    const iQty = head.findIndex((h) => String(h ?? '').trim() === 'Số lượng');
    ws.eachRow((row, n) => {
      if (n <= headRow) return;
      const t = num(val(row.getCell(iTotal).value));
      total +=
        t ||
        num(val(row.getCell(iUnit).value)) *
          (num(val(row.getCell(iQty).value)) || 1);
    });
  }
  return { status: 200, total };
}

async function snapshot(code) {
  const v2 = rows(
    await getJson(
      `/api/v2/cases-garage/services?search=${encodeURIComponent(code)}&date_from=${FROM}&date_to=${TO}&pageSize=200`,
    ),
  );
  const v1 = rows(
    await getJson(
      `/api/v1/greenway/cases/services?q=${encodeURIComponent(code)}&from=${FROM}&to=${TO}&pageSize=200`,
      H1,
    ),
  );
  const sum = (list, ...keys) =>
    list.reduce(
      (s, r) => s + num(keys.map((k) => r[k]).find((v) => v != null)),
      0,
    );
  return {
    v2PartsCost: sum(v2, 'partsCost'),
    v1PartsCost: sum(v1, 'giaVonPhuTung', 'gia_von_phu_tung'),
    exportTotal: (await exportCosts(code)).total,
  };
}

const before = {};
for (const c of CODES) before[c] = await snapshot(c);
console.log('TRƯỚC sync', JSON.stringify(before));

const sync = await fetch(`${BASE}/api/v1/greenway/sync/gross-profit`, {
  method: 'POST',
  headers: { ...H, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from: FROM,
    to: TO,
    account: process.env.SMOKE_ACCOUNT ?? 'MAIN',
  }),
});
const syncBody = await sync.json().catch(() => null);
console.log('SYNC', sync.status, JSON.stringify(syncBody?.data ?? syncBody));
check(
  'sync/gross-profit 2xx và success',
  sync.status < 300 && (syncBody?.data ?? syncBody)?.success !== false,
  JSON.stringify(syncBody),
);
check(
  'sync không lỗi làm giàu',
  num((syncBody?.data ?? syncBody)?.failed) === 0,
  JSON.stringify(syncBody),
);

const after = {};
for (const c of CODES) after[c] = await snapshot(c);
console.log('SAU sync (chưa mở drawer)', JSON.stringify(after));

for (const c of CODES) {
  check(
    `${c}: export > 0 sau sync`,
    (after[c].exportTotal ?? 0) > 0,
    JSON.stringify(after[c]),
  );
  check(
    `${c}: V2 partsCost > 0 sau sync`,
    after[c].v2PartsCost > 0,
    JSON.stringify(after[c]),
  );
  check(
    `${c}: V1 = V2`,
    after[c].v1PartsCost === after[c].v2PartsCost,
    JSON.stringify(after[c]),
  );
}

// AC-8: mở drawer rồi chụp lại, số phải không đổi.
for (const c of CODES)
  await getJson(`/api/v1/greenway/cases/by-code/${encodeURIComponent(c)}`);
for (const c of CODES) {
  const s = await snapshot(c);
  check(
    `${c}: parity trước/sau mở drawer`,
    JSON.stringify(s) === JSON.stringify(after[c]),
    `${JSON.stringify(after[c])} -> ${JSON.stringify(s)}`,
  );
}

// AC-4: sync lại chi tiết phiếu không reset giá vốn.
for (const c of CODES) {
  const d = await getJson(
    `/api/v1/greenway/cases/by-code/${encodeURIComponent(c)}`,
  );
  const id = d?.data?.id ?? d?.id;
  if (!id) continue;
  await fetch(`${BASE}/api/v1/greenway/sync/cases/${id}/detail`, {
    method: 'POST',
    headers: H,
  });
  const s = await snapshot(c);
  check(
    `${c}: giá vốn > 0 sau sync lại chi tiết`,
    s.v2PartsCost > 0 && (s.exportTotal ?? 0) > 0,
    JSON.stringify(s),
  );
}

console.log(fails ? `FAIL (${fails})` : 'ALL PASS');
process.exit(fails ? 1 : 0);
