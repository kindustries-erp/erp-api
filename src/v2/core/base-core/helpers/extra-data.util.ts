import { BadRequestException } from '@nestjs/common';

export type ExtraData = Record<string, unknown>;

export const EXTRA_DATA_MAX_BYTES = 16 * 1024;
export const EXTRA_DATA_MAX_DEPTH = 5;
export const EXTRA_DATA_MAX_KEY_LENGTH = 64;
export const EXTRA_DATA_FORBIDDEN_KEYS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

const isPlainObject = (value: unknown): value is ExtraData =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Kiểm tra `extraData` trước khi ghi. Ném lỗi nếu không phải object,
 * quá dung lượng, quá sâu, key quá dài hoặc key nằm trong danh sách cấm.
 * Trả về lỗi dạng chuỗi để DTO validator dùng lại; `null` nghĩa là hợp lệ.
 */
export function explainExtraDataError(value: unknown): string | null {
  if (!isPlainObject(value)) {
    return 'extraData phải là object JSON';
  }
  const bytes = Buffer.byteLength(JSON.stringify(value), 'utf8');
  if (bytes > EXTRA_DATA_MAX_BYTES) {
    return `extraData vượt ${EXTRA_DATA_MAX_BYTES} byte`;
  }
  const walk = (node: unknown, depth: number): string | null => {
    if (depth > EXTRA_DATA_MAX_DEPTH) {
      return `extraData sâu quá ${EXTRA_DATA_MAX_DEPTH} cấp`;
    }
    if (!isPlainObject(node)) return null;
    for (const key of Object.keys(node)) {
      if (key.length > EXTRA_DATA_MAX_KEY_LENGTH) {
        return `key "${key.slice(0, 16)}…" vượt ${EXTRA_DATA_MAX_KEY_LENGTH} ký tự`;
      }
      if (EXTRA_DATA_FORBIDDEN_KEYS.has(key)) {
        return `key "${key}" không được phép`;
      }
      const nested = walk(node[key], depth + 1);
      if (nested) return nested;
    }
    return null;
  };
  return walk(value, 1);
}

/** Ném `BadRequestException` nếu `extraData` không hợp lệ. */
export function assertValidExtraData(
  value: unknown,
): asserts value is ExtraData {
  const error = explainExtraDataError(value);
  if (error) {
    throw new BadRequestException(error);
  }
}

/**
 * Merge cấp 1: key trong `patch` ghi đè key cũ; giá trị `null` xóa key;
 * key không có trong `patch` giữ nguyên. Không đụng vào object gốc.
 */
export function mergeExtraData(
  current: ExtraData | null | undefined,
  patch: ExtraData,
): ExtraData {
  const result: ExtraData = { ...(current ?? {}) };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete result[key];
    } else {
      result[key] = value;
    }
  }
  return result;
}
