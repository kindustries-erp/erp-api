import { toKebab, toPascal, toCamel, toSnake } from './apiV2Data.mjs';
import { API_V2_MARKERS } from './apiV2Wiring.mjs';

/**
 * Chuẩn hóa input cho generator Voucher V2 (Header + Lines Document)
 */
export function buildApiVoucherData(answers) {
  const moduleRaw = answers.moduleInput || '';
  const moduleName = toKebab(moduleRaw.replace(/-core$/, '')) + '-core';
  const moduleBase = moduleName.replace(/-core$/, '');

  const headerEntityName = toPascal(answers.headerEntityInput || 'GoodsReceipt');
  const headerEntityKebab = toKebab(headerEntityName);
  const headerEntityCamel = toCamel(headerEntityName);

  const lineEntityName = toPascal(
    answers.lineEntityInput || `${headerEntityName}Line`,
  );
  const lineEntityKebab = toKebab(lineEntityName);
  const lineEntityCamel = toCamel(lineEntityName);

  const voucherPrefix = (answers.voucherPrefixInput || 'REC').toUpperCase().trim();

  const tableName =
    answers.tableNameInput?.trim() || `erp_${toSnake(moduleBase)}`;
  const lineTableName =
    answers.lineTableNameInput?.trim() || `${tableName}_lines`;

  const routePath = answers.routePathInput?.trim() || moduleBase;
  const permissionResource =
    answers.permissionResourceInput?.trim() || toSnake(moduleBase);
  const resourceKey = toSnake(permissionResource).toUpperCase();

  const moduleClass = toPascal(moduleName);

  return {
    moduleName,
    moduleBase,
    moduleClass,
    headerEntityName,
    headerEntityKebab,
    headerEntityCamel,
    lineEntityName,
    lineEntityKebab,
    lineEntityCamel,
    voucherPrefix,
    tableName,
    lineTableName,
    routePath,
    permissionResource,
    resourceKey,
    wire: Boolean(answers.wireInput),
  };
}

/**
 * Danh sách file sinh ra cho Voucher V2
 */
export function voucherFileMap(data) {
  const base = `src/v2/modules/${data.moduleName}`;
  const h = data.headerEntityKebab;
  const l = data.lineEntityKebab;
  const m = data.moduleName;

  return [
    { template: 'header-entity.ts.hbs', path: `${base}/entities/${h}.entity.ts` },
    { template: 'line-entity.ts.hbs', path: `${base}/entities/${l}.entity.ts` },
    { template: 'create-dto.ts.hbs', path: `${base}/dto/create-${h}.dto.ts` },
    { template: 'update-dto.ts.hbs', path: `${base}/dto/update-${h}.dto.ts` },
    { template: 'query-dto.ts.hbs', path: `${base}/dto/query-${h}.dto.ts` },
    { template: 'response-dto.ts.hbs', path: `${base}/dto/${h}-response.dto.ts` },
    { template: 'mapper.ts.hbs', path: `${base}/helpers/${h}.mapper.ts` },
    { template: 'mapper.spec.ts.hbs', path: `${base}/helpers/${h}.mapper.spec.ts` },
    { template: 'query-service.ts.hbs', path: `${base}/services/${h}-query.service.ts` },
    { template: 'query-service.spec.ts.hbs', path: `${base}/services/${h}-query.service.spec.ts` },
    { template: 'command-service.ts.hbs', path: `${base}/services/${h}-command.service.ts` },
    { template: 'command-service.spec.ts.hbs', path: `${base}/services/${h}-command.service.spec.ts` },
    { template: 'facade.ts.hbs', path: `${base}/${m}.service.ts` },
    { template: 'facade.spec.ts.hbs', path: `${base}/${m}.service.spec.ts` },
    { template: 'controller.ts.hbs', path: `${base}/controllers/${h}.controller.ts` },
    { template: 'controller.spec.ts.hbs', path: `${base}/controllers/${h}.controller.spec.ts` },
    { template: 'module.ts.hbs', path: `${base}/${m}.module.ts` },
  ];
}

function snippetFor(key, data) {
  const h = data.headerEntityKebab;
  const l = data.lineEntityKebab;
  const m = data.moduleName;
  const snippets = {
    'rbac-resource': `  ${data.resourceKey} = '${data.permissionResource}',`,
    'app-imports': `import { ${data.moduleClass}Module } from './v2/modules/${m}/${m}.module';`,
    'app-modules': `    ${data.moduleClass}Module,`,
    'entity-imports': `import { ${data.headerEntityName} } from '@/v2/modules/${m}/entities/${h}.entity';\nimport { ${data.lineEntityName} } from '@/v2/modules/${m}/entities/${l}.entity';`,
    entities: `  ${data.headerEntityName},\n  ${data.lineEntityName},`,
  };
  return snippets[key];
}

export function voucherRbacPlan(data) {
  const tag = (key) => `// api-voucher-v2:${data.moduleName}:${key}`;
  return API_V2_MARKERS.filter((item) => item.key === 'rbac-resource').map(
    ({ key, file, marker }) => ({
      key,
      file,
      marker,
      snippet: snippetFor(key, data),
      tag: tag(key),
    }),
  );
}

export function voucherWiringPlan(data) {
  if (!data.wire) return [];
  const tag = (key) => `// api-voucher-v2:${data.moduleName}:${key}`;
  return API_V2_MARKERS.filter((item) => item.key !== 'rbac-resource').map(
    ({ key, file, marker }) => ({
      key,
      file,
      marker,
      snippet: snippetFor(key, data),
      tag: tag(key),
    }),
  );
}
