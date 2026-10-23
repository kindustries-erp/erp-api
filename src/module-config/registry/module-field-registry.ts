import type { ModuleAttributeFieldType } from '../entities/erp_module_attribute_def.entity';

/**
 * Registry các field "mặc định" (built-in) của từng module.
 * Built-in do code sở hữu, lưu ở cột typed của bảng thực thể (nguồn sự thật duy nhất),
 * KHÔNG lưu trong EAV. Thuộc tính tùy chỉnh (custom) mới đi qua EAV.
 */
export interface BuiltinFieldDef {
  /** Khóa field trong response/payload (camelCase). */
  key: string;
  /** Tên cột trên bảng thực thể. */
  column: string;
  fieldType: ModuleAttributeFieldType;
  /** i18n key (namespace của FE module). */
  labelKey: string;
}

export interface ModuleFieldRegistryEntry {
  moduleKey: string;
  builtin: readonly BuiltinFieldDef[];
}

/** Semantic key của category GARAGE_CASE (code-owned, code admin đổi tự do). */
export const GARAGE_CASE_SEMANTIC = {
  GENERAL: 'GENERAL',
  INTERNAL: 'INTERNAL',
  OJ: 'OJ',
  OTHER: 'OTHER',
} as const;

export const MODULE_FIELD_REGISTRY: Readonly<
  Record<string, ModuleFieldRegistryEntry>
> = {
  GARAGE_CASE: {
    moduleKey: 'GARAGE_CASE',
    builtin: [
      {
        key: 'categoryId',
        column: 'category_id',
        fieldType: 'SELECT',
        labelKey: 'cases.drawer.classification',
      },
      {
        key: 'excludeFromReports',
        column: 'exclude_from_reports',
        fieldType: 'CHECKBOX',
        labelKey: 'cases.drawer.excludeFromReports',
      },
      {
        key: 'excludeFromDebt',
        column: 'exclude_from_debt',
        fieldType: 'CHECKBOX',
        labelKey: 'cases.drawer.excludeFromDebt',
      },
    ],
  },
};

export function getModuleFieldRegistry(
  moduleKey: string,
): ModuleFieldRegistryEntry | undefined {
  return MODULE_FIELD_REGISTRY[moduleKey];
}

/** True nếu `code` là field built-in của module (theo key hoặc tên cột), không phải custom. */
export function isBuiltinCode(moduleKey: string, code: string): boolean {
  const entry = MODULE_FIELD_REGISTRY[moduleKey];
  if (!entry) return false;
  return entry.builtin.some((f) => f.key === code || f.column === code);
}
