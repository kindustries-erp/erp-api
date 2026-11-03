const EXCEL_SHEET_NAME_MAX_LENGTH = 31;
const EXCEL_FORBIDDEN_CHARS = /[[\]:*?/\\]/g;

/**
 * Tạo tên sheet hợp lệ cho Excel: bỏ ký tự cấm, tối đa 31 ký tự,
 * không trùng với tên đã dùng (thêm hậu tố " (2)", " (3)"...).
 */
export const buildUniqueSheetName = (
  rawName: string,
  usedNames: Set<string>,
): string => {
  const base =
    rawName.replace(EXCEL_FORBIDDEN_CHARS, ' ').replace(/\s+/g, ' ').trim() ||
    'Sheet';

  let candidate = base.slice(0, EXCEL_SHEET_NAME_MAX_LENGTH);
  let suffix = 2;
  while (usedNames.has(candidate.toLowerCase())) {
    const tail = ` (${suffix})`;
    candidate = base.slice(0, EXCEL_SHEET_NAME_MAX_LENGTH - tail.length) + tail;
    suffix += 1;
  }

  usedNames.add(candidate.toLowerCase());
  return candidate;
};
