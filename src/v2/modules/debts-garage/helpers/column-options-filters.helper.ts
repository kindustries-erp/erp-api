import {
  parseFilterRecord,
  type TableFilterPayload,
} from '@/common/utils/table-query';

const ENVELOPE_KEYS = [
  'columnFilters',
  'columnSearch',
  'columnOperators',
  'dateRanges',
];

/**
 * Bộ lọc gửi kèm `column-options`: nhận payload đầy đủ lẫn dạng rút gọn `{ cột: [giá trị] }`
 * của bảng V2. Chuỗi sai định dạng thì bỏ qua (không lọc), không gây lỗi.
 */
export function parseOptionsFilters(raw: unknown): TableFilterPayload {
  const parsed = parseFilterRecord<
    TableFilterPayload & Record<string, unknown>
  >(raw);
  if (!parsed) return {};
  return ENVELOPE_KEYS.some((key) => key in parsed)
    ? parsed
    : { columnFilters: parsed as Record<string, string[]> };
}
