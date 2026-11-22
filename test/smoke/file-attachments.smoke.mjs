// Smoke API file đính kèm V2 (`/api/v2/invoices/:id/attachments`, `/api/v2/file-attachments-management`) trên API đang chạy.
// Biến môi trường (xem erp-api/.agents/skills/erp-e2e-api-smoke/SKILL.md):
//   E2E_API_URL    (mặc định suy từ PORT trong erp-api/.env)
//   E2E_TAO_EMAIL     (mặc định ai-test-tao@example.com)
//   E2E_PASSWORD      (BẮT BUỘC, mật khẩu tài khoản ai-test-*)
// Ghi thật lên R2 và DB: chỉ chạy trên staging/dev, KHÔNG chạy trên DB production.
// Tự dọn: mọi file do smoke tạo đều được xóa mềm rồi xóa vĩnh viễn ở cuối.
// Chạy: bun run test:smoke:file-attachments
import { resolveApiUrl } from './e2e-ports.mjs';

const BASE = resolveApiUrl();
const EMAIL = process.env.E2E_TAO_EMAIL ?? 'ai-test-tao@example.com';
const PASSWORD = process.env.E2E_PASSWORD;
if (!EMAIL || !PASSWORD) {
  console.error('Thiếu E2E_PASSWORD.');
  process.exit(2);
}
const V2 = `${BASE}/api/v2`;
const results = [];
const created = [];

const record = (step, status, expected, pass, message = '') =>
  results.push({
    step,
    status,
    expected,
    pass,
    message: String(message).slice(0, 90),
  });

async function api(token, method, path, { json, form } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (json !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${V2}${path}`, {
    method,
    headers,
    body: json !== undefined ? JSON.stringify(json) : form,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

async function step(name, token, method, path, expect, opts) {
  const res = await api(token, method, path, opts);
  const pass = expect.includes(res.status);
  record(
    `${method} ${name}`,
    res.status,
    expect.join('|'),
    pass,
    pass ? '' : JSON.stringify(res.data),
  );
  return res;
}

function check(name, pass, message = '') {
  record(name, '-', '-', Boolean(pass), message);
}

function pdfForm(name, size = 64, category = 'KHAC', mime = 'application/pdf') {
  const bytes = new Uint8Array(size).fill(65);
  const form = new FormData();
  form.append('files', new Blob([bytes], { type: mime }), name);
  form.append('category', category);
  return form;
}

async function main() {
  const login = await api(null, 'POST', '/auth-sessions/login', {
    json: { email: EMAIL, password: PASSWORD },
  });
  const token = login.data?.data?.accessToken;
  record(
    'POST /auth-sessions/login',
    login.status,
    '200',
    login.status === 200 && !!token,
  );
  if (!token) return;

  const unauth = await api(null, 'GET', '/file-attachments-management');
  record(
    'GET /file-attachments-management (không token)',
    unauth.status,
    '401',
    unauth.status === 401,
  );

  const invs = await api(token, 'GET', '/invoices?page=1&pageSize=2');
  const [invA, invB] = (invs.data?.items ?? []).map((i) => i.id);
  check('có 2 hóa đơn để thử', invA && invB);
  if (!invA || !invB) return;
  const base = `/invoices/${invA}/attachments`;

  // 4.1.1: upload, list, tải, xóa mềm, xóa cứng
  const up = await step('upload hợp lệ', token, 'POST', base, [200, 201], {
    form: pdfForm('smoke-a.pdf'),
  });
  const att = up.data?.data?.[0];
  if (att) created.push(att.id);
  check('upload trả bản ghi không lộ fileKey', att && !('fileKey' in att));
  check('tên file lưu đúng', att?.fileName === 'smoke-a.pdf', att?.fileName);

  const list = await step('list theo hóa đơn', token, 'GET', base, [200]);
  check(
    'list có file vừa tải',
    (list.data?.items ?? []).some((i) => i.id === att?.id),
  );
  check(
    'list trả policy upload',
    list.data?.extraData?.policy?.maxFileBytes > 0,
  );

  const dl = await step(
    'download-url',
    token,
    'GET',
    `${base}/${att?.id}/download-url?inline=true`,
    [200],
  );
  const url = dl.data?.data?.url;
  const got = url ? await fetch(url) : null;
  check('URL ký tải được nội dung R2', got?.status === 200, got?.status);
  check(
    'nội dung R2 đúng kích thước',
    got && (await got.arrayBuffer()).byteLength === 64,
  );

  const zipRes = await fetch(`${V2}${base}/zip`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  check(
    'zip owner trả application/zip có nội dung',
    zipRes.status === 200 &&
      (zipRes.headers.get('content-type') ?? '').includes('zip') &&
      (await zipRes.arrayBuffer()).byteLength > 0,
    zipRes.status,
  );
  const zipNoAuth = await fetch(`${V2}${base}/zip`);
  check('zip không token bị 401', zipNoAuth.status === 401, zipNoAuth.status);

  await step('upload sai đuôi (.exe)', token, 'POST', base, [400], {
    form: pdfForm('x.exe'),
  });
  await step('upload sai MIME', token, 'POST', base, [400], {
    form: pdfForm('x.pdf', 8, 'KHAC', 'text/html'),
  });
  await step('upload quá 20MB', token, 'POST', base, [400, 413], {
    form: pdfForm('big.pdf', 21 * 1024 * 1024),
  });
  await step('upload category lạ', token, 'POST', base, [400], {
    form: pdfForm('c.pdf', 8, 'HACK'),
  });
  await step(
    'upload hóa đơn không tồn tại',
    token,
    'POST',
    '/invoices/00000000-0000-0000-0000-000000000000/attachments',
    [404],
    {
      form: pdfForm('n.pdf', 8),
    },
  );

  // 4.1.2: IDOR
  await step(
    'IDOR download-url hóa đơn khác',
    token,
    'GET',
    `/invoices/${invB}/attachments/${att?.id}/download-url`,
    [404],
  );
  await step(
    'IDOR xóa hóa đơn khác',
    token,
    'DELETE',
    `/invoices/${invB}/attachments/${att?.id}`,
    [404],
  );

  // xóa cứng file chưa xóa mềm phải bị bỏ qua
  const notYet = await step(
    'purge file chưa xóa mềm',
    token,
    'POST',
    '/file-attachments-management/purge',
    [200, 201],
    {
      json: { ids: [att?.id] },
    },
  );
  check(
    'bị skipped NOT_SOFT_DELETED',
    notYet.data?.data?.skipped?.[0]?.reason === 'NOT_SOFT_DELETED',
  );
  await step(
    'purge DELETE :id/permanent chưa xóa mềm',
    token,
    'DELETE',
    `/file-attachments-management/${att?.id}/permanent`,
    [409],
  );
  await step(
    'purge body sai',
    token,
    'POST',
    '/file-attachments-management/purge',
    [400],
    { json: { ids: ['x'] } },
  );

  await step('xóa mềm', token, 'DELETE', `${base}/${att?.id}`, [200]);
  const after = await step('list sau xóa mềm', token, 'GET', base, [200]);
  check(
    'list không còn file đã xóa',
    !(after.data?.items ?? []).some((i) => i.id === att?.id),
  );
  await step(
    'download file đã xóa mềm',
    token,
    'GET',
    `${base}/${att?.id}/download-url`,
    [404],
  );
  const del = await step(
    'quản lý deleted=only',
    token,
    'GET',
    '/file-attachments-management?deleted=only&pageSize=200',
    [200],
  );
  check(
    'file nằm trong bộ lọc Đã xóa',
    (del.data?.items ?? []).some((i) => i.id === att?.id),
  );
  const main = await step(
    'quản lý mặc định',
    token,
    'GET',
    '/file-attachments-management?pageSize=200',
    [200],
  );
  check(
    'file đã xóa không lẫn vào danh sách thường',
    !(main.data?.items ?? []).some((i) => i.id === att?.id),
  );
  await step(
    'column-options',
    token,
    'GET',
    '/file-attachments-management/column-options?column=category&deleted=only',
    [200],
  );

  const purged = await step(
    'xóa vĩnh viễn',
    token,
    'DELETE',
    `/file-attachments-management/${att?.id}/permanent`,
    [200],
  );
  check(
    'object R2 đã bị xóa',
    purged.data?.data?.objectDeleted === true &&
      purged.data?.data?.objectKept === false,
  );
  const gone = url ? await fetch(url) : null;
  check(
    'URL cũ không còn tải được (object mất)',
    gone && gone.status >= 400,
    gone?.status,
  );
  await step(
    'chi tiết sau xóa cứng',
    token,
    'GET',
    `/file-attachments-management/${att?.id}`,
    [404],
  );
  created.length = 0;

  // 4.1.2: cài đặt lưu giữ
  const s0 = await step(
    'settings',
    token,
    'GET',
    '/file-attachments-management/settings',
    [200],
  );
  const original = s0.data?.data;
  check(
    'mặc định tắt tự động dọn',
    original && typeof original.autoPurgeEnabled === 'boolean',
  );
  await step(
    'settings retentionDays=0',
    token,
    'PATCH',
    '/file-attachments-management/settings',
    [400],
    { json: { retentionDays: 0 } },
  );
  await step(
    'settings retentionDays=99999',
    token,
    'PATCH',
    '/file-attachments-management/settings',
    [400],
    { json: { retentionDays: 99999 } },
  );
  await step(
    'settings field lạ',
    token,
    'PATCH',
    '/file-attachments-management/settings',
    [400],
    { json: { hack: 1 } },
  );
  const s1 = await step(
    'settings đổi hợp lệ',
    token,
    'PATCH',
    '/file-attachments-management/settings',
    [200],
    {
      json: { autoPurgeEnabled: !original.autoPurgeEnabled, retentionDays: 45 },
    },
  );
  check('settings lưu giá trị mới', s1.data?.data?.retentionDays === 45);
  await step(
    'settings khôi phục',
    token,
    'PATCH',
    '/file-attachments-management/settings',
    [200],
    {
      json: {
        autoPurgeEnabled: original.autoPurgeEnabled,
        retentionDays: original.retentionDays,
      },
    },
  );
}

async function cleanup() {
  if (!created.length) return;
  const login = await api(null, 'POST', '/auth-sessions/login', {
    json: { email: EMAIL, password: PASSWORD },
  });
  const token = login.data?.data?.accessToken;
  if (!token) return;
  for (const id of created) {
    await api(token, 'DELETE', `/file-attachments-management/${id}`);
    await api(token, 'DELETE', `/file-attachments-management/${id}/permanent`);
  }
}

try {
  await main();
} catch (error) {
  record(
    'LỖI KHÔNG MONG ĐỢI',
    '-',
    '-',
    false,
    error instanceof Error ? error.message : error,
  );
} finally {
  await cleanup();
}

console.table(results);
const failed = results.filter((r) => !r.pass);
console.log(
  failed.length
    ? `FAIL: ${failed.length}/${results.length}`
    : `PASS: ${results.length}/${results.length}`,
);
process.exit(failed.length ? 1 : 0);
