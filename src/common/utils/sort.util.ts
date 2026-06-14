/**
 * resolveSortOrder
 *
 * Converts a sort query string into a TypeORM `order` object.
 *
 * Syntax accepted (mirrors Directus / FE convention):
 *   - single field:   "createdAt"      → { createdAt: 'DESC' }  (implicit DESC)
 *   - prefix "-":    "-createdAt"     → { createdAt: 'DESC' }
 *   - prefix "+":    "+documentDate"  → { documentDate: 'ASC' }
 *   - no prefix = ASC:  "poNo"        → { poNo: 'ASC' }
 *   - comma-separated multi:
 *       "-createdAt,status"  → { createdAt: 'DESC', status: 'ASC' }
 *
 * Pass `allowedFields` to whitelist sortable columns (prevents injection).
 * If a field is not in `allowedFields`, it is silently ignored.
 *
 * `columnMap` translates FE aliases → TypeORM entity property names:
 *   e.g.  document_date → orderDate,  created_at → createdAt
 *
 * Default: { createdAt: 'DESC' } when sort is absent or resolves to nothing.
 */
export type SortOrder = Record<string, 'ASC' | 'DESC'>;

export function resolveSortOrder(
  sort: string | string[] | undefined,
  options: {
    allowedFields?: string[];
    columnMap?: Record<string, string>;
    defaultOrder?: SortOrder;
  } = {},
): SortOrder {
  const {
    allowedFields,
    columnMap = {},
    defaultOrder = { createdAt: 'DESC' },
  } = options;

  const raw = Array.isArray(sort) ? sort.join(',') : (sort ?? '');

  if (!raw.trim()) return defaultOrder;

  const result: SortOrder = {};

  for (const token of raw.split(',')) {
    const t = token.trim();
    if (!t) continue;

    let dir: 'ASC' | 'DESC' = 'DESC'; // default direction for bare fields is DESC
    let field: string;

    if (t.startsWith('-')) {
      dir = 'DESC';
      field = t.slice(1);
    } else if (t.startsWith('+')) {
      dir = 'ASC';
      field = t.slice(1);
    } else {
      // no prefix → treat as ASC (explicit field name = user wants that field)
      dir = 'ASC';
      field = t;
    }

    // translate alias (e.g. document_date → orderDate)
    const resolved = columnMap[field] ?? field;

    // whitelist check
    if (allowedFields && !allowedFields.includes(resolved)) continue;

    result[resolved] = dir;
  }

  return Object.keys(result).length > 0 ? result : defaultOrder;
}
