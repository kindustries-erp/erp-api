// Smoke cầu nối V1 → V2 (LegacyFileRegistrar): file ghi bằng route V1 phải xuất hiện ở V2 (origin LEGACY),
// gỡ liên kết/xóa ở V1 phải xóa mềm dòng V2. Dùng E2E_EMAIL/E2E_PASSWORD của admin (SEED_ADMIN_* trong .env).
// Ghi thật lên R2 và DB: chỉ staging/dev. Tự dọn: xóa attachment V1 và dòng V2 test.
// Chạy: bun run test:smoke:file-attachments-legacy
import { resolveApiUrl } from './e2e-ports.mjs';

const BASE = resolveApiUrl();
const { E2E_EMAIL: EMAIL, E2E_PASSWORD: PASSWORD } = process.env;
if (!EMAIL || !PASSWORD) {
  console.error('Thiếu E2E_EMAIL hoặc E2E_PASSWORD.');
  process.exit(2);
}
let failed = 0;
const check = (name, pass, detail = '') => {
  if (!pass) failed++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + String(detail).slice(0, 120) : ''}`);
};
const j = async (res) => {
  try { return await res.json(); } catch { return null; }
};
const login = await fetch(`${BASE}/api/v2/auth-sessions/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
const token = (await j(login))?.data?.accessToken;
if (!token) { console.error('Đăng nhập thất bại'); process.exit(2); }
const H = { Authorization: `Bearer ${token}` };
const call = async (method, path, body) => {
  const res = await fetch(`${BASE}${path}`, { method, headers: { ...H, ...(body && !(body instanceof FormData) ? { 'content-type': 'application/json' } : {}) }, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await j(res) };
};

const NAME = `smoke-legacy-${Date.now()}.pdf`;
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
const inv = (await call('GET', '/api/v2/invoices?pageSize=1')).data.items[0];
const v2List = async () =>
  (await call('GET', `/api/v2/invoices/${inv.id}/attachments`)).data.items;
let attachment = null;
try {
  const form = new FormData();
  form.append('files', new Blob([PDF], { type: 'application/pdf' }), NAME);
  form.append('documentType', 'KHAC');
  const up = await call('POST', `/api/v1/erp-invoices/${inv.id}/pdfs`, form);
  attachment = up.data?.attachments?.[0] ?? up.data?.data?.attachments?.[0];
  check('A1 V1 upload thành công', up.status < 300 && attachment?.id, up.status);

  const row = (await v2List()).find((i) => i.fileName === NAME);
  check('A2 V2 thấy file ngay sau khi V1 upload', Boolean(row));
  check('A3 dòng V2 có origin LEGACY, category KHAC, không lộ file_key', row?.origin === 'LEGACY' && row?.category === 'KHAC' && !('fileKey' in row), `${row?.origin}/${row?.category}`);
  check('A4 dòng V2 lưu dung lượng thật', Number(row?.fileSize) === PDF.length, row?.fileSize);

  const again = await call('POST', `/api/v1/erp-invoices/${inv.id}/attachments/link`, { attachmentId: attachment.id });
  const copies = (await v2List()).filter((i) => i.fileName === NAME);
  check('B1 link lại cùng file không tạo dòng trùng (idempotent)', again.status < 300 && copies.length === 1, copies.length);

  const un = await call('DELETE', `/api/v1/erp-invoices/${inv.id}/attachments/${attachment.id}`);
  check('C1 V1 gỡ liên kết thành công', un.status < 300, un.status);
  check('C2 V2 không còn hiện file sau khi V1 gỡ', !(await v2List()).some((i) => i.fileName === NAME));
  const del = await call('GET', `/api/v2/file-attachments?deleted=only&search=${encodeURIComponent(NAME)}`);
  check('C3 dòng V2 là xóa mềm (còn ở bộ lọc Đã xóa)', del.data.items.some((i) => i.fileName === NAME));
  for (const i of del.data.items.filter((x) => x.fileName === NAME)) {
    await call('DELETE', `/api/v2/file-attachments/${i.id}/permanent`);
  }
} finally {
  if (attachment?.id) await call('DELETE', `/api/v1/erp-attachments/${attachment.id}`);
}
console.log(failed ? `\n${failed} FAIL` : '\nTất cả PASS');
process.exit(failed ? 1 : 0);
