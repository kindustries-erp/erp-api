import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildApiThinData } from './apiThinData.mjs';
import { toSnake } from './apiV2Data.mjs';

/** Chỉ họ kiểu này (có vòng đời trạng thái) mới dùng được cho `api-workflow-module`. */
export const WORKFLOW_STYLE = 'abstract-services';

/** Ném lỗi nếu họ không phải kiểu workflow. Họ CRUD dùng `api-thin-module`. */
export function assertWorkflowFamily(manifest) {
  if (manifest.style !== WORKFLOW_STYLE) {
    throw new Error(
      `Họ "${manifest.family}" có style "${manifest.style}", không phải "${WORKFLOW_STYLE}". Dùng api-thin-module cho họ CRUD.`,
    );
  }
}

/**
 * Chuẩn hóa đầu vào của `api-workflow-module` và ghép với manifest của họ.
 * Phần module dùng lại `buildApiThinData`; thêm docType (mã loại chứng từ trong nhật ký) và tên Action của lõi.
 */
export function buildApiWorkflowData(answers, manifest, coreFields = []) {
  assertWorkflowFamily(manifest);
  const data = buildApiThinData(answers, manifest, coreFields);
  return {
    ...data,
    docType: toSnake(data.entityName).toUpperCase(),
    coreEntity: manifest.entity,
  };
}

/**
 * Danh sách file của module workflow. Không sinh facade, query và DTO cập nhật:
 * module workflow chỉ có tạo nháp và chuyển trạng thái; phần đọc dữ liệu dev tự thêm.
 * `template` nằm trong `plop-templates/`, `path` từ thư mục gốc erp-api.
 */
export function workflowFileMap(data) {
  const base = data.modulePath;
  const e = data.entityKebab;
  return [
    { template: 'thin-common/entity.ts.hbs', path: `${base}/entities/${e}.entity.ts` },
    { template: 'thin-common/create-dto.ts.hbs', path: `${base}/dto/create-${e}.dto.ts` },
    { template: 'workflow-common/command.service.ts.hbs', path: `${base}/services/${e}-command.service.ts` },
    { template: 'workflow-common/command.spec.ts.hbs', path: `${base}/services/${e}-command.service.spec.ts` },
    { template: 'workflow-common/controller.ts.hbs', path: `${base}/controllers/${e}.controller.ts` },
    { template: 'workflow-common/module.ts.hbs', path: `${base}/${data.moduleName}.module.ts` },
  ];
}

/**
 * Kiểm tra thư mục module đích chưa tồn tại. Gọi trước khi ghi file để không ghi đè module cũ.
 * `baseDir` là thư mục gốc erp-api.
 */
export function assertModuleAbsent(baseDir, data) {
  if (existsSync(join(baseDir, data.modulePath))) {
    throw new Error(`Module "${data.moduleName}" đã tồn tại tại ${data.modulePath}. Chọn tên khác hoặc sửa module cũ.`);
  }
}
