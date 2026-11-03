export interface ExportColumn {
  header: string;
  key: string;
  width: number;
  style?: { numFmt?: string };
  isSum?: boolean;
}

export const HEADER_ROW = 4;
export const DATA_START_ROW = 5;
export const COLOR = {
  border: 'FFE2E8F0',
  totalFill: 'FFFFFBEB',
  totalFont: 'FF78350F',
  subtotalFill: 'FFF8FAFC',
  subtotalFont: 'FF475569',
  aquaFill: 'FFDAEEF3', // Aqua, Accent 5, Lighter 80%
  invoiceFill: 'FFF0FDF4',
  invoiceHeader: 'FF065F46',
  bankHeader: 'FF334155',
  darkText: 'FF0F172A',
  white: 'FFFFFFFF',
};

export const AQUA_KEYS = new Set([
  'cashflowClassification',
  'cashflowPurpose',
  'note',
  'businessPartner',
  'branchName',
]);

export const INVOICE_KEYS = new Set([
  'invoiceBranchName',
  'invoiceDate',
  'invoiceNo',
  'invoiceSerial',
  'invoicePartner',
  'invoiceDescription',
  'invoiceTotalAmount',
]);

export const BORDER_THIN = {
  top: { style: 'thin' as const, color: { argb: COLOR.border } },
  bottom: { style: 'thin' as const, color: { argb: COLOR.border } },
  left: { style: 'thin' as const, color: { argb: COLOR.border } },
  right: { style: 'thin' as const, color: { argb: COLOR.border } },
};

export const solidFill = (argb: string) => ({
  type: 'pattern' as const,
  pattern: 'solid' as const,
  fgColor: { argb },
});

export const ALIGNMENTS: Record<
  string,
  { horizontal: 'center' | 'left' | 'right'; vertical: 'middle' }
> = {
  stt: { horizontal: 'center', vertical: 'middle' },
  account: { horizontal: 'left', vertical: 'middle' },
  transDate: { horizontal: 'center', vertical: 'middle' },
  referenceNumber: { horizontal: 'center', vertical: 'middle' },
  description: { horizontal: 'left', vertical: 'middle' },
  credit: { horizontal: 'right', vertical: 'middle' },
  debit: { horizontal: 'right', vertical: 'middle' },
  balance: { horizontal: 'right', vertical: 'middle' },
  netOffAmount: { horizontal: 'right', vertical: 'middle' },
  remainingAmount: { horizontal: 'right', vertical: 'middle' },
  correspondentAccount: { horizontal: 'center', vertical: 'middle' },
  correspondentName: { horizontal: 'left', vertical: 'middle' },
  correspondentBank: { horizontal: 'left', vertical: 'middle' },
  cashflowClassification: { horizontal: 'left', vertical: 'middle' },
  cashflowPurpose: { horizontal: 'left', vertical: 'middle' },
  note: { horizontal: 'left', vertical: 'middle' },
  businessPartner: { horizontal: 'left', vertical: 'middle' },
  branchName: { horizontal: 'center', vertical: 'middle' },
  invoiceBranchName: { horizontal: 'center', vertical: 'middle' },
  invoiceDate: { horizontal: 'center', vertical: 'middle' },
  invoiceNo: { horizontal: 'center', vertical: 'middle' },
  invoiceSerial: { horizontal: 'center', vertical: 'middle' },
  invoicePartner: { horizontal: 'left', vertical: 'middle' },
  invoiceDescription: { horizontal: 'left', vertical: 'middle' },
  invoiceTotalAmount: { horizontal: 'right', vertical: 'middle' },
};

export const MONEY_FMT = '#,##0.00';

export function buildExportColumns(
  sourceType: 'BANK' | 'CASH' | undefined,
  selectedColumns?: string[],
): ExportColumn[] {
  const allColumns: ExportColumn[] = [
    { header: 'STT', key: 'stt', width: 8 },
    {
      header: sourceType === 'CASH' ? 'Sổ quỹ' : 'Ngân hàng',
      key: 'account',
      width: 25,
    },
    {
      header: 'Ngày GD',
      key: 'transDate',
      width: 22,
      style: { numFmt: 'dd/mm/yyyy hh:mm:ss' },
    },
    { header: 'Số tham chiếu', key: 'referenceNumber', width: 24 },
    { header: 'Diễn giải', key: 'description', width: 45 },
    {
      header: 'Thu (VND)',
      key: 'credit',
      width: 18,
      style: { numFmt: MONEY_FMT },
      isSum: true,
    },
    {
      header: 'Chi (VND)',
      key: 'debit',
      width: 18,
      style: { numFmt: MONEY_FMT },
      isSum: true,
    },
    {
      header: 'Số dư (VND)',
      key: 'balance',
      width: 18,
      style: { numFmt: MONEY_FMT },
    },
    {
      header: 'Đã cấn trừ (VND)',
      key: 'netOffAmount',
      width: 18,
      style: { numFmt: MONEY_FMT },
      isSum: true,
    },
    {
      header: 'Còn lại (VND)',
      key: 'remainingAmount',
      width: 18,
      style: { numFmt: MONEY_FMT },
      isSum: true,
    },
    { header: 'TK đối ứng', key: 'correspondentAccount', width: 18 },
    { header: 'Tên đối tác', key: 'correspondentName', width: 30 },
    { header: 'Ngân hàng đối tác', key: 'correspondentBank', width: 22 },
    { header: 'Phân loại', key: 'cashflowClassification', width: 24 },
    { header: 'Mục đích', key: 'cashflowPurpose', width: 28 },
    { header: 'Ghi chú', key: 'note', width: 30 },
    { header: 'Đối tượng', key: 'businessPartner', width: 30 },
    { header: 'Chi nhánh GD', key: 'branchName', width: 22 },
    // Nhóm cột Hóa đơn cấn trừ
    { header: '[HĐ] Chi nhánh', key: 'invoiceBranchName', width: 24 },
    {
      header: '[HĐ] Ngày HĐ',
      key: 'invoiceDate',
      width: 20,
      style: { numFmt: 'dd/mm/yyyy' },
    },
    { header: '[HĐ] Số HĐ', key: 'invoiceNo', width: 20 },
    { header: '[HĐ] Ký hiệu HĐ', key: 'invoiceSerial', width: 18 },
    { header: '[HĐ] Đối tác HĐ', key: 'invoicePartner', width: 38 },
    { header: '[HĐ] Nội dung HĐ', key: 'invoiceDescription', width: 45 },
    {
      header: '[HĐ] Tổng tiền HĐ (VND)',
      key: 'invoiceTotalAmount',
      width: 22,
      style: { numFmt: MONEY_FMT },
      isSum: true,
    },
  ];

  return selectedColumns && selectedColumns.length > 0
    ? allColumns.filter((c) => selectedColumns.includes(c.key))
    : allColumns;
}
