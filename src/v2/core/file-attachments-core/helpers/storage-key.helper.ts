import { randomUUID } from 'crypto';
import { sanitizeFileName } from './sanitize-filename.helper';

/**
 * Sinh khóa R2 do server quyết định: `files/{ownerType}/{yyyy}/{mm}/{uuid}_{tênAnToàn}`.
 * Client không bao giờ được chọn khóa.
 */
export function buildStorageKey(
  ownerType: string,
  fileName: string,
  now: Date = new Date(),
  uuid: string = randomUUID(),
): string {
  const owner = ownerType.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (!owner) {
    throw new Error('ownerType không hợp lệ để sinh khóa lưu trữ');
  }
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `files/${owner}/${yyyy}/${mm}/${uuid}_${sanitizeFileName(fileName)}`;
}
