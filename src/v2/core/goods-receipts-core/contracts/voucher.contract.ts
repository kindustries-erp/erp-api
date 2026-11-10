import { EntityManager } from 'typeorm';

export type VoucherStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';

export interface IVoucherLine {
  id?: string;
  lineNo?: number;
  itemCode?: string | null;
  itemName: string;
  unit?: string | null;
  qtyReceived: string | number;
  unitCost: string | number;
  amount: string | number;
  notes?: string | null;
}

export interface IVoucherHeader {
  id?: string;
  receiptNo: string;
  receiptDate: string | Date;
  status: VoucherStatus | string;
  totalAmount?: string | number | null;
  branchId?: string | null;
  supplierId?: string | null;
  supplierName?: string | null;
  remarks?: string | null;
  lines?: IVoucherLine[];
}

/**
 * Interface cho chiến lược cập nhật kho (Stock Movement Strategy).
 * Mỗi domain (Garage, Kho tổng, Mua hàng) có thể cài đặt strategy riêng phù hợp với bảng tồn kho của mình.
 */
export interface IStockMovementStrategy {
  executeMovement(
    manager: EntityManager,
    header: IVoucherHeader,
    lines: IVoucherLine[],
  ): Promise<void>;

  revertMovement(
    manager: EntityManager,
    header: IVoucherHeader,
    lines: IVoucherLine[],
  ): Promise<void>;
}
