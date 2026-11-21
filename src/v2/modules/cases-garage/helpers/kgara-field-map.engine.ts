/** Kiểu chuyển giá trị khi map giữa `kgara_*` (V1) và bảng v2. */
export type FieldKind =
  | 'copy'
  | 'text'
  | 'money'
  | 'quantity'
  | 'date'
  /**
   * Cột V1 `timestamp` KHÔNG múi giờ lưu giờ tường Việt Nam (UTC+7). pg đọc chuỗi này bằng múi
   * giờ của tiến trình, nên dựng lại instant đúng từ chữ số ngày giờ, không phụ thuộc TZ tiến trình.
   */
  | 'vnLocalDateTime'
  | 'int'
  | 'bool';

/** `identity` = định danh/nguồn, `source` = dữ liệu gốc KGara (khóa với xe sync), `erp-local` = sửa được ở ERP. */
export type FieldGroup = 'identity' | 'source' | 'erp-local';

export interface FieldMapEntry {
  /** Tên property trên entity V1 (`KgaraCase`/`KgaraCaseService`). */
  from: string;
  /** Tên property camelCase tiếng Anh trên entity v2. */
  to: string;
  kind: FieldKind;
  group: FieldGroup;
  /** `both`: có chiều ngược v2 → V1 (chỉ nhóm ERP-local). */
  direction: 'v1->v2' | 'both';
}

export interface IgnoredColumn {
  property: string;
  reason: string;
}

type Dict = Record<string, unknown>;

const isBlank = (v: unknown) => v === null || v === undefined || v === '';

const VN_UTC_OFFSET_HOURS = 7;
const NAIVE_TS_RE =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3})\d*)?)?)?$/;

/**
 * Giờ tường VN (chữ số ngày giờ) → instant UTC. `Date` đầu vào là kết quả pg parse chuỗi naive theo
 * múi giờ tiến trình, nên đọc bằng getter cục bộ để lấy lại đúng chữ số gốc.
 */
export function vnLocalDateTimeToInstant(value: unknown): Date | null {
  let parts: number[] | null = null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    parts = [
      value.getFullYear(),
      value.getMonth(),
      value.getDate(),
      value.getHours(),
      value.getMinutes(),
      value.getSeconds(),
      value.getMilliseconds(),
    ];
  } else if (typeof value === 'string') {
    const m = NAIVE_TS_RE.exec(value.trim());
    if (m) {
      parts = [
        Number(m[1]),
        Number(m[2]) - 1,
        Number(m[3]),
        Number(m[4] ?? 0),
        Number(m[5] ?? 0),
        Number(m[6] ?? 0),
        Number((m[7] ?? '0').padEnd(3, '0')),
      ];
    } else {
      // Có hậu tố múi giờ (Z, +07:00): đã là instant tuyệt đối.
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }
  if (!parts) return null;
  const [y, mo, d, h, mi, s, ms] = parts;
  return new Date(Date.UTC(y, mo, d, h - VN_UTC_OFFSET_HOURS, mi, s, ms));
}

/** Chuẩn hóa một giá trị theo `kind`. `undefined` giữ nguyên để caller bỏ qua. */
export function convertValue(kind: FieldKind, value: unknown): unknown {
  if (value === undefined) return undefined;
  switch (kind) {
    case 'text': {
      if (value === null) return null;
      const s = (
        typeof value === 'string' ? value : JSON.stringify(value)
      ).trim();
      return s === '' ? null : s;
    }
    case 'money':
    case 'quantity': {
      if (isBlank(value)) return null;
      const n = Number(value);
      return Number.isFinite(n) ? n.toFixed(kind === 'money' ? 2 : 4) : null;
    }
    case 'int': {
      if (isBlank(value)) return null;
      const n = Number(value);
      return Number.isFinite(n) ? Math.trunc(n) : null;
    }
    case 'vnLocalDateTime':
      return isBlank(value) ? null : vnLocalDateTimeToInstant(value);
    case 'date': {
      if (isBlank(value)) return null;
      const d = value instanceof Date ? value : new Date(value as string);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    default:
      return value;
  }
}

/** Map V1 → v2: chỉ ghi key có giá trị khác `undefined`. */
export function mapForward(entries: readonly FieldMapEntry[], src: Dict): Dict {
  const out: Dict = {};
  for (const e of entries) {
    const v = convertValue(e.kind, src[e.from]);
    if (v !== undefined) out[e.to] = v;
  }
  return out;
}

/** Map v2 → V1 cho các field `both`: chỉ ghi key có mặt (`undefined` bị bỏ). */
export function mapBackward(
  entries: readonly FieldMapEntry[],
  src: Dict,
): Dict {
  const out: Dict = {};
  for (const e of entries) {
    if (e.direction !== 'both') continue;
    const v = convertValue(e.kind, src[e.to]);
    if (v !== undefined) out[e.from] = v;
  }
  return out;
}
