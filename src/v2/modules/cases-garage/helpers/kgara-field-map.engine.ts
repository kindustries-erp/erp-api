/** Kiểu chuyển giá trị khi map giữa `kgara_*` (V1) và bảng v2. */
export type FieldKind =
  | 'copy'
  | 'text'
  | 'money'
  | 'quantity'
  | 'date'
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
