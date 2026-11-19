import { BadRequestException, ConflictException } from '@nestjs/common';
import { CaseOrigin } from '../entities/case-garage.enums';
import { CASE_ERP_LOCAL_FIELDS } from './kgara-case.field-map';

/** Field của dòng hạng mục mà xe KGARA_SYNC được sửa (giống V1 `lines-cost`). */
export const SERVICE_ERP_LOCAL_FIELDS: readonly string[] = ['partsCost'];

/** Key điều khiển không phải dữ liệu nghiệp vụ, luôn bị bỏ khỏi so sánh. */
const IGNORE = new Set(['services']);

function forbidden(keys: string[], allowed: readonly string[]): string[] {
  return keys.filter((k) => !IGNORE.has(k) && !allowed.includes(k));
}

/** Xe SYNC chỉ nhận nhóm ERP-local; field khác bị 400. Xe NATIVE sửa mọi field. */
export function assertHeaderPatchAllowed(
  origin: CaseOrigin,
  patch: Record<string, unknown>,
): void {
  if (origin !== CaseOrigin.KGARA_SYNC) return;
  const keys = Object.keys(patch).filter((k) => patch[k] !== undefined);
  if (patch.services !== undefined) keys.push('services');
  const bad = forbidden(keys, CASE_ERP_LOCAL_FIELDS).concat(
    keys.includes('services') ? ['services'] : [],
  );
  if (bad.length) {
    throw new BadRequestException(
      `Xe đồng bộ từ KGara chỉ được sửa: ${CASE_ERP_LOCAL_FIELDS.join(', ')}. Không sửa được: ${[...new Set(bad)].join(', ')}.`,
    );
  }
}

export function assertStructureEditable(origin: CaseOrigin): void {
  if (origin === CaseOrigin.KGARA_SYNC) {
    throw new BadRequestException(
      'Xe đồng bộ từ KGara không thêm/xóa/sửa dòng hạng mục ngoài giá vốn phụ tùng.',
    );
  }
}

export function assertDeletable(origin: CaseOrigin): void {
  if (origin === CaseOrigin.KGARA_SYNC) {
    throw new ConflictException(
      'Xe đồng bộ từ KGara không xóa được ở v2; xóa bên KGara để đồng bộ.',
    );
  }
}

export function assertStatusEditable(origin: CaseOrigin): void {
  if (origin === CaseOrigin.KGARA_SYNC) {
    throw new BadRequestException(
      'Trạng thái xe đồng bộ từ KGara do KGara quyết định.',
    );
  }
}
