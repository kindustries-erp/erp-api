/**
 * Chèn `snippet` ngay trước dòng chứa `marker`.
 * Idempotent: nếu `tag` đã có trong nội dung thì trả về nguyên văn, không chèn lại.
 */
export function insertAtMarker(content, { marker, snippet, tag }) {
  if (content.includes(tag)) return content;

  const lines = content.split('\n');
  const index = lines.findIndex((line) => line.includes(marker));
  if (index === -1) {
    throw new Error(`Không tìm thấy marker "${marker}". Kiểm tra lại file wiring API v2.`);
  }
  lines.splice(index, 0, `${snippet} ${tag}`);
  return lines.join('\n');
}

export const API_V2_WIRING_FILES = {
  appModule: 'src/app.module.ts',
  dataSource: 'src/db/data-source.ts',
  rbacResource: 'src/rbac-core/enums/erp-resource.enum.ts',
};

/**
 * Các marker mà generator `api-module-v2` cần.
 * `always: true` nghĩa là luôn chèn (controller phụ thuộc vào nó); còn lại chỉ chèn khi `wire` bật.
 */
export const API_V2_MARKERS = [
  { key: 'rbac-resource', file: API_V2_WIRING_FILES.rbacResource, marker: '// plop:api-v2-resources', always: true },
  { key: 'app-imports', file: API_V2_WIRING_FILES.appModule, marker: '// plop:api-v2-imports' },
  { key: 'app-modules', file: API_V2_WIRING_FILES.appModule, marker: '// plop:api-v2-modules' },
  { key: 'entity-imports', file: API_V2_WIRING_FILES.dataSource, marker: '// plop:api-v2-entity-imports' },
  { key: 'entities', file: API_V2_WIRING_FILES.dataSource, marker: '// plop:api-v2-entities' },
];

/**
 * Enum entry `KEY = 'value',` đã có trong file chưa, theo key hoặc theo value.
 * Dùng để không thêm trùng resource RBAC của module cũ (ví dụ BUSINESS_PARTNERS đã có).
 * Snippet không khớp dạng enum thì trả về false (để luồng chèn thường xử lý).
 */
export function enumEntryExists(content, snippet) {
  const match = /^\s*(\w+)\s*=\s*'([^']+)'/.exec(snippet ?? '');
  if (!match) return false;
  const [, key, value] = match;
  const keyPattern = new RegExp(`^\\s*${key}\\s*=`, 'm');
  const valuePattern = new RegExp(`=\\s*'${value}'`);
  return keyPattern.test(content) || valuePattern.test(content);
}
