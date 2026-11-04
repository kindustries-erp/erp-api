import { moduleFileMap } from './apiV2Files.mjs';

/**
 * Template thay thế cho module mỏng. Các template còn lại (facade, query, mapper, controller,
 * DTO response/query/update và spec tương ứng) dùng chung với pipeline `api-module-v2`.
 */
const THIN_OVERRIDES = {
  'entity.ts.hbs': 'thin-common/entity.ts.hbs',
  'create-dto.ts.hbs': 'thin-common/create-dto.ts.hbs',
  'command-service.ts.hbs': 'thin-common/command-service.ts.hbs',
  'command-service.spec.ts.hbs': 'thin-common/command-service.spec.ts.hbs',
  'module.ts.hbs': 'thin-common/module.ts.hbs',
};

/**
 * Danh sách file sinh ra cho một module mỏng ghép lõi.
 * `template` là đường dẫn trong `plop-templates/`, `path` là đường dẫn đích từ thư mục gốc của repo.
 */
export function thinFileMap(data) {
  return moduleFileMap(data).map(({ template, path }) => ({
    template: THIN_OVERRIDES[template] ?? `module-v2/${template}`,
    path,
  }));
}
