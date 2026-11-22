import { BadRequestException } from '@nestjs/common';
import { CaseOrigin } from '../entities/case-garage.enums';
import { CASE_OVERRIDABLE_KEYS } from './case-override.keys';

/** Field v2-native (không có nguồn KGara) mà xe sync cũng sửa trực tiếp. */
const V2_NATIVE_KEYS: ReadonlySet<string> = new Set(['extraData']);

/**
 * Xe NATIVE sửa mọi field. Xe KGARA_SYNC sửa được mọi field có thể override (ghi vào cột hiệu lực và
 * `overrides`); định danh/nguồn, tiền suy ra từ công nợ và `services` bị 400 (dùng endpoint dòng).
 */
export function assertHeaderPatchAllowed(
  origin: CaseOrigin,
  patch: Record<string, unknown>,
): void {
  if (origin !== CaseOrigin.KGARA_SYNC) return;
  const bad = Object.keys(patch).filter(
    (k) =>
      patch[k] !== undefined &&
      !CASE_OVERRIDABLE_KEYS.has(k) &&
      !V2_NATIVE_KEYS.has(k),
  );
  if (bad.length) {
    throw new BadRequestException(
      `Xe đồng bộ từ KGara không sửa được: ${bad.join(', ')} (định danh/nguồn, tiền công nợ hoặc dòng hạng mục: dùng endpoint dòng).`,
    );
  }
}
