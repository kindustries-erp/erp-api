import { BadRequestException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { ErpModuleCategory } from '@/module-config/entities/erp_module_category.entity';
import type { OverrideMap } from './case-override.helper';

/** Tài khoản KGara thứ hai (chi nhánh GN): mọi xe của tài khoản này là xe ngoài (OJ). */
export const OJ_ACCOUNT_KEY = 'OJ';
export const OJ_CLASSIFICATION = 'OJ';
const GARAGE_CASE_MODULE = 'GARAGE_CASE';
const LOCKED_KEYS = [
  'classification',
  'categoryId',
  'classificationManuallyCleared',
] as const;

export const isOjAccount = (accountKey?: string | null): boolean =>
  accountKey === OJ_ACCOUNT_KEY;

/** Danh mục phân loại `OJ` của vụ việc garage; chưa có danh mục thì null (vẫn khóa theo mã). */
export async function findOjCategoryId(
  m: EntityManager,
): Promise<string | null> {
  const cat = await m.findOne(ErpModuleCategory, {
    where: {
      moduleKey: GARAGE_CASE_MODULE,
      code: OJ_CLASSIFICATION,
      isDeleted: false,
    },
  });
  return cat?.id ?? null;
}

/** Giá trị phân loại bắt buộc của xe tài khoản OJ. */
export function ojClassificationFields(ojCategoryId: string | null) {
  return {
    classification: OJ_CLASSIFICATION,
    classificationManuallyCleared: false,
    // Chưa có danh mục OJ thì xóa danh mục cũ, để `COALESCE(category.code, classification)` ra OJ.
    categoryId: ojCategoryId,
  };
}

/** Bỏ dấu override phân loại để lần chiếu sau luôn ghi lại OJ. */
export function withoutOjOverrides(overrides: OverrideMap): OverrideMap {
  const out = { ...overrides };
  for (const k of LOCKED_KEYS) delete out[k];
  return out;
}

/**
 * Chặn sửa phân loại của xe tài khoản OJ sang loại khác. Gửi lại đúng OJ (hoặc danh mục OJ) thì cho qua.
 */
export function assertOjClassificationEdit(
  accountKey: string | null | undefined,
  patch: Record<string, unknown>,
  ojCategoryId: string | null,
): void {
  if (!isOjAccount(accountKey)) return;
  const badClass =
    patch.classification !== undefined &&
    patch.classification !== OJ_CLASSIFICATION;
  // Danh mục chỉ được là danh mục OJ; chưa có danh mục OJ thì chỉ được để trống.
  const badCategory =
    patch.categoryId !== undefined && patch.categoryId !== ojCategoryId;
  const cleared = patch.classificationManuallyCleared === true;
  if (badClass || badCategory || cleared) {
    throw new BadRequestException(
      'Xe tài khoản OJ luôn có phân loại OJ, không đổi được.',
    );
  }
}
