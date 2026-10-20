/**
 * Helper Functions cho Invoice Dashboard Query & Calculations
 */

/**
 * Xây dựng mệnh đề SQL cho Exact search ("...") và Multi-search (;)
 */
export function buildKeywordSqlClause(
  sqlField: string,
  searchString: string,
): string | null {
  if (!searchString || !searchString.trim()) return null;

  const keywords = searchString
    .split(';')
    .map((k) => k.trim())
    .filter((k) => k.length > 0);

  if (keywords.length === 0) return null;

  const clauses = keywords.map((kw) => {
    let isExact = false;
    let cleanKw = kw;
    if (kw.startsWith('"') && kw.endsWith('"') && kw.length >= 2) {
      isExact = true;
      cleanKw = kw.slice(1, -1);
    }
    const escaped = cleanKw.replace(/'/g, "''");
    return isExact
      ? `CAST(${sqlField} AS TEXT) ILIKE '${escaped}'`
      : `CAST(${sqlField} AS TEXT) ILIKE '%${escaped}%'`;
  });

  return `(${clauses.join(' OR ')})`;
}

/**
 * Tính toán chữ cái tương ứng của cột Excel (1 -> A, 2 -> B, 27 -> AA...)
 */
export function getExcelColLetter(colIndex: number): string {
  let letter = '';
  let temp = colIndex;
  while (temp > 0) {
    const mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - mod) / 26);
  }
  return letter;
}

/**
 * Chuẩn hóa giá trị dateTo (YYYY-MM-DD -> YYYY-MM-DD 23:59:59.999)
 */
export function normalizeEffectiveDateTo(dateTo?: string): string | undefined {
  if (!dateTo) return undefined;
  return dateTo.length === 10 ? `${dateTo} 23:59:59.999` : dateTo;
}
