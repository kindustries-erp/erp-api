import { BadRequestException } from '@nestjs/common';

/**
 * Parse tham số JSON của query string. Sai định dạng thì ném 400, không bỏ qua im lặng
 * (v1 nuốt lỗi và trả toàn bộ dữ liệu). Giá trị rỗng trả `undefined`.
 */
export function parseStrictJsonParam<T extends object>(
  raw: unknown,
  paramName: string,
): T | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw === 'object') return raw as T;
  if (typeof raw !== 'string') {
    throw new BadRequestException(`Tham số ${paramName} không hợp lệ`);
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      throw new Error('not an object');
    }
    return parsed as T;
  } catch {
    throw new BadRequestException(
      `Tham số ${paramName} phải là JSON object hợp lệ`,
    );
  }
}
