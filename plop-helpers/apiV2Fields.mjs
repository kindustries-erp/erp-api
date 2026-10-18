/** Kiểu trường hỗ trợ trong `fields` của generator `api-module-v2` */
export const API_V2_FIELD_TYPES = ['string', 'text', 'number', 'decimal', 'boolean', 'date', 'status'];

const NAME_PATTERN = /^[a-z][A-Za-z0-9]*$/;

/**
 * Đọc chuỗi `fields` dạng `name:type[:required],...`.
 * Ví dụ: `code:string:required,name:string:required,amount:decimal,status:status`.
 * Luôn có `createdAt` (kiểu date) để response DTO và filter ngày giống các module chuẩn.
 */
export function parseApiV2Fields(spec) {
  const items = String(spec ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const fields = items.map((item) => {
    const [name, type = 'string', ...flags] = item.split(':');
    if (!NAME_PATTERN.test(name)) {
      throw new Error(`Tên trường không hợp lệ: "${name}" (camelCase, bắt đầu bằng chữ thường)`);
    }
    if (!API_V2_FIELD_TYPES.includes(type)) {
      throw new Error(
        `Kiểu không hợp lệ: "${type}" của trường "${name}". Chọn: ${API_V2_FIELD_TYPES.join(', ')}`,
      );
    }
    return { name, type, required: flags.includes('required') };
  });

  if (!fields.some((field) => field.name === 'createdAt')) {
    fields.push({ name: 'createdAt', type: 'date', required: false });
  }
  return fields;
}

export const hasStatusApiV2Field = (fields) => fields.some((field) => field.type === 'status');
