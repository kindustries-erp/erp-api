import { API_V2_MARKERS } from './apiV2Wiring.mjs';

/**
 * Danh sách file sinh ra cho một module v2.
 * `template` là tên file trong `plop-templates/module-v2/`, `path` là đường dẫn đích từ thư mục gốc của repo.
 */
export function moduleFileMap(data) {
  const base = `src/${data.moduleName}`;
  const e = data.entityKebab;
  const m = data.moduleName;
  return [
    { template: 'entity.ts.hbs', path: `${base}/entities/${e}.entity.ts` },
    { template: 'create-dto.ts.hbs', path: `${base}/dto/create-${e}.dto.ts` },
    { template: 'update-dto.ts.hbs', path: `${base}/dto/update-${e}.dto.ts` },
    { template: 'query-dto.ts.hbs', path: `${base}/dto/query-${e}.dto.ts` },
    { template: 'response-dto.ts.hbs', path: `${base}/dto/${e}-response.dto.ts` },
    { template: 'mapper.ts.hbs', path: `${base}/helpers/${e}.mapper.ts` },
    { template: 'mapper.spec.ts.hbs', path: `${base}/helpers/${e}.mapper.spec.ts` },
    { template: 'query-service.ts.hbs', path: `${base}/services/${e}-query.service.ts` },
    { template: 'query-service.spec.ts.hbs', path: `${base}/services/${e}-query.service.spec.ts` },
    { template: 'command-service.ts.hbs', path: `${base}/services/${e}-command.service.ts` },
    { template: 'command-service.spec.ts.hbs', path: `${base}/services/${e}-command.service.spec.ts` },
    { template: 'facade.ts.hbs', path: `${base}/${m}.service.ts` },
    { template: 'facade.spec.ts.hbs', path: `${base}/${m}.service.spec.ts` },
    { template: 'controller.ts.hbs', path: `${base}/controllers/${e}.controller.ts` },
    { template: 'controller.spec.ts.hbs', path: `${base}/controllers/${e}.controller.spec.ts` },
    { template: 'module.ts.hbs', path: `${base}/${m}.module.ts` },
  ];
}

/** Snippet cho từng marker. Tag đi kèm để chèn idempotent. */
function snippetFor(key, data) {
  const e = data.entityKebab;
  const m = data.moduleName;
  const snippets = {
    'rbac-resource': `  ${data.resourceKey} = '${data.permissionResource}',`,
    'app-imports': `import { ${data.moduleClass}Module } from './${m}/${m}.module';`,
    'app-modules': `    ${data.moduleClass}Module,`,
    'entity-imports': `import { ${data.entityName} } from '../${m}/entities/${e}.entity';`,
    entities: `  ${data.entityName},`,
  };
  return snippets[key];
}

/**
 * Đăng ký resource RBAC. Luôn chạy, vì controller v2 dùng `ErpResource.<KEY>`.
 */
export function rbacPlan(data) {
  return planFor(data, (item) => item.key === 'rbac-resource');
}

/**
 * Nối module và entity vào app khi `wire = true`. Không gồm resource RBAC (xem `rbacPlan`).
 */
export function wiringPlan(data) {
  if (!data.wire) return [];
  return planFor(data, (item) => item.key !== 'rbac-resource');
}

function planFor(data, select) {
  const tag = (key) => `// api-v2-module:${data.moduleName}:${key}`;
  return API_V2_MARKERS.filter(select).map(({ key, file, marker }) => ({
    key,
    file,
    marker,
    snippet: snippetFor(key, data),
    tag: tag(key),
  }));
}
