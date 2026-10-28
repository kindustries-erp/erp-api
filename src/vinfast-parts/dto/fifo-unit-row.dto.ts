export interface FifoUnitRow {
  unitIndex: number;

  inLedgerId: string;
  inDate: string;
  inInvoiceNo: string;
  inInvoiceId: string;
  inUnitCost: number;

  outLedgerId?: string;
  outDate?: string;
  outInvoiceNo?: string;
  outInvoiceId?: string;
  licensePlate?: string;
  outPrice?: number;
  cogsFifo?: number | null;
  profit?: number | null;
  qty?: number;

  returnLedgerId?: string;
  returnDate?: string;
  returnInvoiceNo?: string;

  /** IN_STOCK: còn kho; SOLD: đã bán; RETURNED: đã bán rồi trả về kho (còn tính tồn);
   *  ADJUSTMENT: lô nhập bị điều chỉnh giảm; SHORTAGE: xuất vượt tồn, không có giá vốn. */
  status: 'IN_STOCK' | 'SOLD' | 'RETURNED' | 'ADJUSTMENT' | 'SHORTAGE';
}
