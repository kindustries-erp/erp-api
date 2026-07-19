import { Brackets, WhereExpressionBuilder } from 'typeorm';

/**
 * Parses a search string separated by semicolon into an array of non-empty keywords.
 * Builds an OR condition for the given sqlField using ILIKE for each keyword.
 * Uses parameter bindings to prevent SQL injection.
 *
 * Example:
 * applyMultiKeywordFilter(qb, 'inv.serial_no', 'aa;tt', 'serialSearch')
 * will append: AND (inv.serial_no ILIKE :serialSearch_0 OR inv.serial_no ILIKE :serialSearch_1)
 */
export function applyMultiKeywordFilter(
  qb: WhereExpressionBuilder,
  sqlField: string,
  searchString: string,
  paramPrefix: string,
): WhereExpressionBuilder {
  if (!searchString) return qb;

  const keywords = searchString
    .split(';')
    .map((k) => k.trim())
    .filter((k) => k.length > 0);

  if (keywords.length === 0) return qb;

  return qb.andWhere(
    new Brackets((sqb) => {
      keywords.forEach((kw, index) => {
        const paramName = `${paramPrefix}_${index}`;
        const condition = `${sqlField} ILIKE :${paramName}`;
        const params = { [paramName]: `%${kw}%` };

        if (index === 0) {
          sqb.where(condition, params);
        } else {
          sqb.orWhere(condition, params);
        }
      });
    }),
  );
}

/**
 * Applies multi-keyword filter when there are multiple fields to search for EACH keyword (e.g., OR between fields).
 * Example: Searching partner name across seller_name and buyer_name.
 * For each keyword, it creates (seller ILIKE X OR buyer ILIKE X)
 */
export function applyMultiKeywordMultiFieldFilter(
  qb: WhereExpressionBuilder,
  sqlFields: string[],
  searchString: string,
  paramPrefix: string,
): WhereExpressionBuilder {
  if (!searchString || sqlFields.length === 0) return qb;

  const keywords = searchString
    .split(';')
    .map((k) => k.trim())
    .filter((k) => k.length > 0);

  if (keywords.length === 0) return qb;

  return qb.andWhere(
    new Brackets((sqb) => {
      keywords.forEach((kw, index) => {
        const paramName = `${paramPrefix}_${index}`;
        const params = { [paramName]: `%${kw}%` };

        // For each keyword, it matches ANY of the sqlFields
        const condition = sqlFields
          .map((field) => `${field} ILIKE :${paramName}`)
          .join(' OR ');

        if (index === 0) {
          sqb.where(`(${condition})`, params);
        } else {
          sqb.orWhere(`(${condition})`, params);
        }
      });
    }),
  );
}
