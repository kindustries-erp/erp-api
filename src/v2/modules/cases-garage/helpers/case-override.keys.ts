import {
  KGARA_CASE_FIELD_MAP,
  KGARA_CASE_RAW_PROGRESS_MAP,
} from './kgara-case.field-map';
import { KGARA_CASE_SERVICE_FIELD_MAP } from './kgara-case-service.field-map';
import type { FieldMapEntry } from './kgara-field-map.engine';

/** Field header đang là trạng thái KGara hoặc suy ra từ sổ khác: không cho override. */
const HEADER_LOCKED = [
  'paidAmount',
  'outstandingAmount',
  'externalDeletedAt',
  'kgaraStatusCode',
  'statusName',
  'customerSourceName',
  'customerSourceCode',
];
const LINE_LOCKED = ['externalDeletedAt'];

const keysOf = (
  entries: readonly FieldMapEntry[],
  locked: readonly string[],
): string[] =>
  entries
    .filter((e) => e.group === 'source' && !locked.includes(e.to))
    .map((e) => e.to);

/** Khóa header sửa đè được ở v2 (từ điển KGara cộng nhóm tiến độ và `status`). */
export const CASE_OVERRIDABLE_KEYS: ReadonlySet<string> = new Set([
  ...keysOf(KGARA_CASE_FIELD_MAP, HEADER_LOCKED),
  ...keysOf(KGARA_CASE_RAW_PROGRESS_MAP, []),
  'status',
]);

/** Khóa dòng sửa đè được ở v2. */
export const LINE_OVERRIDABLE_KEYS: ReadonlySet<string> = new Set(
  keysOf(KGARA_CASE_SERVICE_FIELD_MAP, LINE_LOCKED),
);

const dateKeysOf = (entries: readonly FieldMapEntry[]): string[] =>
  entries
    .filter((e) => e.kind === 'date' || e.kind === 'vnLocalDateTime')
    .map((e) => e.to);

/** Khóa kiểu ngày (snapshot lưu ISO, cần đổi về Date khi khôi phục). */
export const CASE_DATE_KEYS: ReadonlySet<string> = new Set(
  dateKeysOf([...KGARA_CASE_FIELD_MAP, ...KGARA_CASE_RAW_PROGRESS_MAP]),
);
export const LINE_DATE_KEYS: ReadonlySet<string> = new Set(
  dateKeysOf(KGARA_CASE_SERVICE_FIELD_MAP),
);
