import { toKebab, toPascal, toSnake } from './apiV2Data.mjs';

/** Kiểu lõi điều phối nhiều module: không entity, không bảng, chỉ có port và khung transaction + sự kiện sau commit. */
export const ORCHESTRATOR_STYLE = 'orchestrator';

/**
 * Ba kiểu lõi: `engine` (Engine service, như goods-receipts/invoices), `abstract-services`
 * (họ chứng từ có vòng đời, như procurement-orders) và `orchestrator` (điều phối chuỗi nhiều module, không entity).
 */
export const API_CORE_STYLES = ['engine', 'abstract-services', ORCHESTRATOR_STYLE];

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
  const orchestrator = style === ORCHESTRATOR_STYLE;
  // Orchestrator: `entity` là tên luồng (vd ProcurementFlow), không sinh entity, DTO hay bảng
  const serviceFile = orchestrator
    ? `abstract-${entityKebab}.service`
    : style === 'engine'
      ? `base-${base}-engine.service`
      : `abstract-${entityKebab}-command.service`;
  const serviceClass = orchestrator
    ? `Abstract${entity}Service`
    : style === 'engine'
      ? `Base${familyPascal}EngineService`
      : `Abstract${entity}CommandService`;

  return {
    family,
    base,
    familyPascal,
    entity,
    entityKebab,
    style,
    orchestrator,
    coreDir: `src/v2/core/${family}`,
    baseEntity: orchestrator ? null : `Base${entity}Entity`,
    baseCreateDto: orchestrator ? null : `BaseCreate${entity}Dto`,
    // Orchestrator: hợp đồng là cổng sự kiện (EventPort), không phải hợp đồng entity
    baseContract: orchestrator ? `${entity}EventPort` : `Base${entity}Contract`,
    serviceClass,
    serviceFile,
    // Lõi chỉ là base để kế thừa: không có module Nest, không provider.
    // Lớp cụ thể do module con kế thừa và tự đăng ký (xem plop-templates/*-common/module.ts.hbs).
    moduleProviders: '',
    moduleClass: null,
    moduleFile: null,
    serviceTemplateDir: orchestrator ? 'core-orchestrator' : style === 'engine' ? 'core-engine' : 'workflow-common',
    // Hằng bảng chuyển trạng thái và tiền tố tên file, ví dụ PROCUREMENT_ORDER_TRANSITIONS
    entityUpperSnake: toSnake(entity).toUpperCase(),
  };
}
