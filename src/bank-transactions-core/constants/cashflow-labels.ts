// Nhãn tiếng Việt cho Excel sao kê. Giữ khớp với i18n `bankStatement.cashflow*Options` ở erp-web.
export const CASHFLOW_CLASSIFICATION_EXPORT_LABELS: Record<string, string> = {
  OPERATING: 'Hoạt động kinh doanh',
  INVESTING: 'Đầu tư',
  FINANCING: 'Tài chính',
  OTHER: 'Khác',
};

export const CASHFLOW_PURPOSE_EXPORT_LABELS: Record<string, string> = {
  CUSTOMER_PAYMENT: 'Khách hàng thanh toán',
  SUPPLIER_PAYMENT: 'Thanh toán nhà cung cấp',
  SALARY: 'Lương',
  TAX: 'Thuế',
  SOCIAL_INSURANCE: 'BHXH',
  BANK_FEE: 'Phí ngân hàng',
  RENT: 'Thuê mặt bằng / kho',
  INSURANCE_CLAIM: 'Bồi thường bảo hiểm',
  ADVANCE: 'Tạm ứng / Hoàn ứng',
  REFUND: 'Hoàn tiền khách',
  LOAN: 'Vay / Trả nợ',
  OPEX: 'Chi phí vận hành',
  ASSET_PURCHASE: 'Mua sắm tài sản',
  ASSET_DISPOSAL: 'Thanh lý tài sản',
  INVESTMENT: 'Đầu tư / Thu hồi đầu tư',
  INTEREST_INCOME: 'Lãi tiền gửi',
  CAPITAL: 'Góp vốn / Chia lợi nhuận',
  INTERNAL_TRANSFER: 'Chuyển nội bộ',
  OTHER: 'Khác',
};

export const toCashflowExportLabel = (
  labels: Record<string, string>,
  value?: string | null,
): string => (value ? (labels[value] ?? value) : '');
