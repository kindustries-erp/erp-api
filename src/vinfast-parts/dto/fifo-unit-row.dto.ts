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
  cogsFifo?: number;
  profit?: number;
  qty?: number;

  status: 'IN_STOCK' | 'SOLD' | 'ADJUSTMENT';
}
