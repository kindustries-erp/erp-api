/**
 * Đối tác của phiếu thu chi: chỉ phiếu THU được lấy tên khách của phiếu dịch vụ khi để trống.
 * Phiếu CHI trả cho nhà cung cấp, nhân viên... nên không bao giờ suy từ khách hàng.
 */
import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

/** Biểu thức SQL cho query builder có alias `voucher` và `case` (giữ khoảng trắng quanh cột để TypeORM escape alias). */
export const GARAGE_PARTNER_NAME_SQL =
  "COALESCE(voucher.partner_name, CASE WHEN voucher.voucher_type = 'RECEIPT' THEN case.khach_hang_name END)";

/** Lọc cột Đối tác theo đúng giá trị đang hiển thị; `__BLANK__` là phiếu không có đối tác. */
export function applyPartnerNameFilter<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  values: string[],
  param: string,
): void {
  const named = values.filter((v) => v !== '__BLANK__');
  const clauses: string[] = [];
  if (named.length > 0) {
    clauses.push(`${GARAGE_PARTNER_NAME_SQL} IN (:...${param})`);
  }
  if (named.length < values.length) {
    clauses.push(
      `${GARAGE_PARTNER_NAME_SQL} IS NULL OR ${GARAGE_PARTNER_NAME_SQL} = ''`,
    );
  }
  if (clauses.length === 0) return;
  qb.andWhere(
    `(${clauses.join(' OR ')})`,
    named.length > 0 ? { [param]: named } : undefined,
  );
}

export function defaultGaragePartnerName(
  voucherType: string | null | undefined,
  customerName: string | null | undefined,
): string | undefined {
  return voucherType === 'RECEIPT' ? customerName || undefined : undefined;
}
