/**
 * vinfast-parts-query.helper.ts
 *
 * Query SQL builders cho tìm kiếm đa từ khóa (;), tìm kiếm chính xác (""),
 * và lọc theo cột / giá trị rỗng (__BLANK__) trong module vinfast-parts.
 */

export function buildRawMultiKeywordSql(
  sqlField: string,
  searchString: string,
  startIndex: number,
  params: any[],
): { sql: string; nextIndex: number } {
  if (!searchString) return { sql: '', nextIndex: startIndex };

  const keywords = searchString
    .split(';')
    .map((k) => k.trim())
    .filter((k) => k.length > 0);

  if (keywords.length === 0) return { sql: '', nextIndex: startIndex };

  const parts: string[] = [];
  let idx = startIndex;

  for (const kw of keywords) {
    if (kw === '__BLANK__') {
      parts.push(`(${sqlField} IS NULL OR ${sqlField} = '')`);
    } else if (kw.startsWith('"') && kw.endsWith('"') && kw.length >= 2) {
      const clean = kw.slice(1, -1);
      parts.push(`${sqlField} ILIKE $${idx}`);
      params.push(clean);
      idx++;
    } else {
      parts.push(`${sqlField} ILIKE $${idx}`);
      params.push(`%${kw}%`);
      idx++;
    }
  }

  const sql = ` AND (${parts.join(' OR ')})`;
  return { sql, nextIndex: idx };
}

export function buildRawColumnFilterSql(
  sqlField: string,
  vals: string[],
  startIndex: number,
  params: any[],
): { sql: string; nextIndex: number } {
  if (!vals || vals.length === 0) return { sql: '', nextIndex: startIndex };

  const hasBlank = vals.includes('__BLANK__');
  const nonBlankVals = vals.filter((v) => v !== '__BLANK__');
  const conditions: string[] = [];
  let idx = startIndex;

  if (nonBlankVals.length > 0) {
    conditions.push(`${sqlField} = ANY($${idx})`);
    params.push(nonBlankVals);
    idx++;
  }
  if (hasBlank) {
    conditions.push(`(${sqlField} IS NULL OR ${sqlField} = '')`);
  }

  if (conditions.length === 0) return { sql: '', nextIndex: idx };
  const sql = ` AND (${conditions.join(' OR ')})`;
  return { sql, nextIndex: idx };
}
