// Đọc PORT API từ erp-api/.env (chỉ đọc PORT, không đọc secret khác).
// Quy tắc PORT API ↔ Web: xem erp-api/.agents/skills/erp-e2e-api-smoke/SKILL.md (mục 2).
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const API_ENV_FILE = resolve(dirname(fileURLToPath(import.meta.url)), '../../.env');

// Web port đi kèm theo PORT API (dùng chung với erp-web/e2e).
export const WEB_PORT_BY_API_PORT = { 10001: 5171, 10002: 5172, 10003: 5173 };

export function readApiPort() {
  let text;
  try {
    text = readFileSync(API_ENV_FILE, 'utf8');
  } catch {
    throw new Error(`Không đọc được ${API_ENV_FILE}. Đặt E2E_API_URL để chạy.`);
  }
  const m = text.match(/^PORT=(\d+)/m);
  if (!m) throw new Error('Thiếu PORT trong erp-api/.env. Đặt E2E_API_URL để chạy.');
  return m[1];
}

// Trả về E2E_API_URL: biến môi trường nếu có, nếu không suy từ PORT trong .env.
export function resolveApiUrl() {
  if (process.env.E2E_API_URL) return process.env.E2E_API_URL;
  return `http://localhost:${readApiPort()}`;
}
