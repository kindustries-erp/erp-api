import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ErpModuleAttributeDef } from '../entities/erp_module_attribute_def.entity';
import { ErpEntityAttributeValue } from '../entities/erp_entity_attribute_value.entity';
import { isBuiltinCode } from '../registry/module-field-registry';

const TRUE_VALUES = new Set(['true', '1']);
const FALSE_VALUES = new Set(['false', '0']);

/** Chuẩn hóa + validate 1 giá trị theo field_type. Trả về chuỗi lưu (hoặc null = xóa giá trị). */
export function normalizeCustomValue(
  def: Pick<ErpModuleAttributeDef, 'code' | 'fieldType' | 'options'>,
  raw: unknown,
): string | null {
  if (raw === undefined || raw === null) return null;
  const str = (
    typeof raw === 'object'
      ? JSON.stringify(raw)
      : String(raw as string | number | boolean)
  ).trim();
  if (str === '' || str === '[]' || str === '{}') return null;

  const fail = (msg: string): never => {
    throw new BadRequestException(`Thuộc tính "${def.code}": ${msg}`);
  };

  switch (def.fieldType) {
    case 'NUMBER':
      if (!Number.isFinite(Number(str))) fail('phải là số hợp lệ');
      return str;
    case 'DATE':
      if (Number.isNaN(Date.parse(str))) fail('phải là ngày hợp lệ');
      return str;
    case 'CHECKBOX': {
      const lower = str.toLowerCase();
      if (TRUE_VALUES.has(lower)) return 'true';
      if (FALSE_VALUES.has(lower)) return 'false';
      return fail('phải là true/false');
    }
    case 'SELECT':
      if (def.options?.length && !def.options.some((o) => o.value === str)) {
        fail('giá trị không nằm trong danh sách lựa chọn');
      }
      return str;
    default:
      return str;
  }
}

export class StrictCustomFieldsHelper {
  /**
   * Lưu thuộc tính TÙY CHỈNH (không phải built-in) cho module có registry.
   * - Chỉ nhận def global, chưa xóa, không phải system; key built-in/legacy bị bỏ qua (tương thích alias).
   * - Key lạ → 400 (không im lặng bỏ).
   * - Upsert từng def có trong payload; giá trị rỗng → xóa riêng def đó. Def không có trong payload giữ nguyên.
   */
  static async saveInTx(
    manager: EntityManager,
    entityType: string,
    entityId: string,
    customAttributes?: Record<string, unknown> | null,
  ): Promise<void> {
    if (!customAttributes || Object.keys(customAttributes).length === 0) return;

    const moduleKey = entityType.trim().toUpperCase();
    const defs = await manager.getRepository(ErpModuleAttributeDef).find({
      where: {
        isGlobal: true,
        moduleKeyGlobal: moduleKey,
        isDeleted: false,
        isSystem: false,
      },
    });

    const byId = new Map(defs.map((d) => [d.id, d]));
    const byCode = new Map(defs.map((d) => [d.code.trim().toLowerCase(), d]));

    const resolved = new Map<
      string,
      { def: ErpModuleAttributeDef; value: string | null }
    >();
    const unknownKeys: string[] = [];

    for (const [key, raw] of Object.entries(customAttributes)) {
      if (isBuiltinCode(moduleKey, key)) continue;
      const def = byId.get(key) ?? byCode.get(key.trim().toLowerCase());
      if (!def) {
        unknownKeys.push(key);
        continue;
      }
      const value = normalizeCustomValue(def, raw);
      const prev = resolved.get(def.id);
      // FE gửi cùng giá trị theo cả id lẫn code; xung đột thật thì báo lỗi.
      if (prev && prev.value !== value) {
        throw new BadRequestException(
          `Thuộc tính "${def.code}" bị gửi với hai giá trị khác nhau`,
        );
      }
      resolved.set(def.id, { def, value });
    }

    if (unknownKeys.length > 0) {
      throw new BadRequestException(
        `Thuộc tính không tồn tại: ${unknownKeys.join(', ')}`,
      );
    }
    if (resolved.size === 0) return;

    const valueRepo = manager.getRepository(ErpEntityAttributeValue);
    const existing = await valueRepo.find({
      where: { entityType: moduleKey, entityId },
    });
    const existingByDef = new Map(existing.map((v) => [v.attrDefId, v]));

    const toSave: ErpEntityAttributeValue[] = [];
    const toDeleteIds: string[] = [];

    for (const { def, value } of resolved.values()) {
      const current = existingByDef.get(def.id);
      if (value === null) {
        if (current) toDeleteIds.push(current.id);
      } else if (current) {
        if (current.valueText !== value) {
          current.valueText = value;
          toSave.push(current);
        }
      } else {
        toSave.push(
          valueRepo.create({
            entityType: moduleKey,
            entityId,
            attrDefId: def.id,
            valueText: value,
          }),
        );
      }
    }

    if (toDeleteIds.length > 0) await valueRepo.delete(toDeleteIds);
    if (toSave.length > 0) await valueRepo.save(toSave);
  }
}
