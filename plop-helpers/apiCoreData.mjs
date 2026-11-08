import { toKebab, toPascal, toSnake } from './apiV2Data.mjs';

/** Hai kiểu lõi: `engine` (Engine service, như goods-receipts/invoices) và `abstract-services` (như procurement-orders). */
export const API_CORE_STYLES = ['engine', 'abstract-services'];

const FAMILY_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const ENTITY_PATTERN = /^[A-Za-z][A-Za-z0-9]*$/;

/**
 * Chuẩn hóa đầu vào của generator `api-core`.
 * Ném lỗi khi đầu vào sai để plop dừng trước khi ghi file nào.
 */
export function buildApiCoreData(answers) {
  const input = String(answers.familyInput ?? '').trim();
  const entity = String(answers.entityInput ?? '').trim();
  const style = String(answers.styleInput ?? '').trim();

  // Quy ước: thư mục lõi luôn kết thúc `-core`. Người dùng gõ có hay không đều được;
  // phần `base` (không hậu tố) dùng để đặt tên class và tên file service như trước.
  const base = input.replace(/-core$/, '');
  const family = `${base}-core`;

  if (!FAMILY_PATTERN.test(base)) {
    throw new Error(`Tên họ không hợp lệ: "${input}" (kebab-case, ví dụ: customer-claims hoặc customer-claims-core)`);
  }
  if (!ENTITY_PATTERN.test(entity)) {
    throw new Error(`Tên entity không hợp lệ: "${entity}" (PascalCase, ví dụ: CustomerClaim)`);
  }
  if (!API_CORE_STYLES.includes(style)) {
    throw new Error(`Style không hợp lệ: "${style}". Chọn một trong: ${API_CORE_STYLES.join(', ')}`);
  }

  const familyPascal = toPascal(base);
  const entityKebab = toKebab(entity);
  const serviceFile =
    style === 'engine' ? `base-${base}-engine.service` : `abstract-${entityKebab}-command.service`;
  const serviceClass =
    style === 'engine' ? `Base${familyPascal}EngineService` : `Abstract${entity}CommandService`;

  return {
    family,
    base,
    familyPascal,
    entity,
    entityKebab,
    style,
    coreDir: `src/v2/core/${family}`,
    baseEntity: `Base${entity}Entity`,
    baseCreateDto: `BaseCreate${entity}Dto`,
    baseContract: `Base${entity}Contract`,
    serviceClass,
    serviceFile,
    // Lớp abstract không thể đăng ký làm provider của Nest: kiểu abstract-services
    // không đăng ký gì, module mỏng sẽ kế thừa lớp abstract bằng lớp con cụ thể.
    moduleProviders: style === 'engine' ? serviceClass : '',
    moduleClass: `${familyPascal}CoreModule`,
    moduleFile: `${family}.module`,
    serviceTemplateDir: style === 'engine' ? 'core-engine' : 'workflow-common',
    // Hằng bảng chuyển trạng thái và tiền tố tên file, ví dụ PROCUREMENT_ORDER_TRANSITIONS
    entityUpperSnake: toSnake(entity).toUpperCase(),
  };
}
