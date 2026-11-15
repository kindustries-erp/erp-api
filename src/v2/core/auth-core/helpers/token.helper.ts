import { createHash, randomBytes } from 'crypto';
import { DEFAULT_ACCESS_TOKEN_SECONDS } from '../constants/auth.constants';

/** SHA-256 của refresh token thô. Chỉ lưu hash, không bao giờ lưu token thô. */
export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/** Refresh token ngẫu nhiên 48 byte (96 ký tự hex). */
export function generateRefreshToken(): string {
  return randomBytes(48).toString('hex');
}

const UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

/** Đổi '8h', '30d', '3600' sang giây; sai định dạng thì dùng mặc định 8 giờ. */
export function parseExpiresInSeconds(expiresIn: string): number {
  const match = /^(\d+)(s|m|h|d)?$/.exec(expiresIn);
  if (!match) return DEFAULT_ACCESS_TOKEN_SECONDS;
  return parseInt(match[1], 10) * (UNIT_SECONDS[match[2] ?? 's'] ?? 1);
}
