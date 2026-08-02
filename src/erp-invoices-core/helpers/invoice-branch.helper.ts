/**
 * Danh sách prefix lệnh quyết toán thuộc chi nhánh Đào Trí.
 * Dễ mở rộng khi thêm mã mới trong tương lai.
 */
export const DAO_TRI_SETTLEMENT_PREFIXES: string[] = [
  'S52801',
  'S52802',
  'S64701',
];

/**
 * Resolve branch code cho hóa đơn đầu ra dựa vào settlementOrder.
 * @returns 'ĐT' nếu lệnh quyết toán thuộc Đào Trí, 'PQ' nếu còn lại.
 */
export function resolveOutInvoiceBranchCode(
  settlementOrder: string | null | undefined,
): 'ĐT' | 'PQ' {
  if (settlementOrder) {
    const prefixMatch = settlementOrder.match(/^([^-]+)-WO-/i);
    if (prefixMatch && DAO_TRI_SETTLEMENT_PREFIXES.includes(prefixMatch[1])) {
      return 'ĐT';
    }
  }
  return 'PQ';
}
