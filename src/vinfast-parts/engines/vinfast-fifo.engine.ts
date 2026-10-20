import { FifoUnitRow } from '../dto/fifo-unit-row.dto';

export interface LedgerEntryForFifo {
  id: string;
  direction: string;
  qty: number | string;
  unitCost?: number | string | null;
  preVatAmount?: number | string | null;
  transactionDate: string;
  isAdjustment?: boolean;
  adjSign?: number;
  invoiceId?: string;
  invoiceNo?: string;
  invoiceDate?: string;
  buyerName?: string;
  sellerName?: string;
  licensePlate?: string;
  calculatedCogs?: number | null;
  calculatedUnitCost?: number | null;
  [key: string]: any;
}

/**
 * Pure Engine tính toán ghép cặp FIFO đơn vị (Unit-level matching)
 * từ danh sách các dòng sổ cái (Ledger Entries) đã sắp xếp theo ngày.
 */
export function calculateFifoUnitRows(
  entries: LedgerEntryForFifo[],
): FifoUnitRow[] {
  const unitRows: FifoUnitRow[] = [];
  let unitIndexCounter = 1;
  const inQueue: number[] = [];

  for (const row of entries) {
    let qty = Number(row.qty || 0);
    let amount = Number(row.preVatAmount || 0);

    if (row.isAdjustment && row.adjSign === -1) {
      qty = -qty;
      amount = -amount;
    }

    if (row.direction === 'IN') {
      if (qty > 0) {
        const unitCost = Number(row.unitCost || 0);
        unitRows.push({
          unitIndex: unitIndexCounter++,
          inLedgerId: row.id,
          inDate: row.transactionDate,
          inInvoiceNo: row.invoiceNo || '',
          inInvoiceId: row.invoiceId || '',
          inUnitCost: unitCost,
          qty: qty,
          status: 'IN_STOCK',
        });
        inQueue.push(unitRows.length - 1);
      } else if (qty < 0) {
        let qToReverse = Math.abs(qty);
        while (qToReverse > 0 && inQueue.length > 0) {
          const rowIndex = inQueue[0];
          const unitRow = unitRows[rowIndex];

          if (unitRow.qty! <= qToReverse + 0.0001) {
            qToReverse -= unitRow.qty!;
            unitRow.status = 'ADJUSTMENT';
            inQueue.shift();
          } else {
            unitRow.qty =
              Math.round((unitRow.qty! - qToReverse) * 10000) / 10000;
            unitRows.push({
              ...unitRow,
              qty: qToReverse,
              unitIndex: unitIndexCounter++,
              status: 'ADJUSTMENT',
            });
            qToReverse = 0;
          }
        }
      }
    } else if (row.direction === 'OUT') {
      if (qty > 0) {
        const outPricePerUnit = qty !== 0 ? amount / qty : 0;
        let qNeeded = qty;
        while (qNeeded > 0 && inQueue.length > 0) {
          const rowIndex = inQueue[0];
          const unitRow = unitRows[rowIndex];

          if (unitRow.qty! <= qNeeded + 0.0001) {
            qNeeded -= unitRow.qty!;
            unitRow.outLedgerId = row.id;
            unitRow.outDate = row.transactionDate;
            unitRow.outInvoiceNo = row.invoiceNo;
            unitRow.outInvoiceId = row.invoiceId;
            unitRow.licensePlate = row.licensePlate;
            unitRow.outPrice = outPricePerUnit;
            unitRow.cogsFifo = unitRow.inUnitCost;
            unitRow.profit = outPricePerUnit - unitRow.inUnitCost;
            unitRow.status = 'SOLD';
            inQueue.shift();
          } else {
            const consumed = Math.round(qNeeded * 10000) / 10000;
            unitRow.qty = Math.round((unitRow.qty! - consumed) * 10000) / 10000;

            unitRows.push({
              ...unitRow,
              qty: consumed,
              unitIndex: unitIndexCounter++,
              outLedgerId: row.id,
              outDate: row.transactionDate,
              outInvoiceNo: row.invoiceNo,
              outInvoiceId: row.invoiceId,
              licensePlate: row.licensePlate,
              outPrice: outPricePerUnit,
              cogsFifo: unitRow.inUnitCost,
              profit: outPricePerUnit - unitRow.inUnitCost,
              status: 'SOLD',
            });
            qNeeded = 0;
          }
        }
      }
    }
  }

  return unitRows;
}

/**
 * Pure Engine tính toán giá vốn FIFO (COGS) gắn vào từng dòng lịch sử sổ cái.
 */
export function calculateLedgerHistoryCogs(
  entries: LedgerEntryForFifo[],
): LedgerEntryForFifo[] {
  const inQueue: { id: string; qty: number; unitCost: number }[] = [];

  for (const row of entries) {
    let qty = Number(row.qty || 0);

    if (row.isAdjustment && row.adjSign === -1) {
      qty = -qty;
    }

    if (row.direction === 'IN') {
      if (qty > 0) {
        inQueue.push({
          id: row.id,
          qty,
          unitCost: Number(row.unitCost || 0),
        });
      } else if (qty < 0) {
        let qToReverse = Math.abs(qty);
        while (qToReverse > 0 && inQueue.length > 0) {
          const batch = inQueue[0];
          if (batch.qty <= qToReverse) {
            qToReverse -= batch.qty;
            inQueue.shift();
          } else {
            batch.qty -= qToReverse;
            qToReverse = 0;
          }
        }
      }
      row.calculatedCogs = null;
    } else {
      let cogsForThisOut = 0;
      if (qty > 0) {
        let qNeeded = qty;
        while (qNeeded > 0) {
          if (inQueue.length === 0) {
            break;
          }
          const batch = inQueue[0];
          if (batch.qty <= qNeeded) {
            cogsForThisOut += batch.qty * batch.unitCost;
            qNeeded -= batch.qty;
            inQueue.shift();
          } else {
            cogsForThisOut += qNeeded * batch.unitCost;
            batch.qty -= qNeeded;
            qNeeded = 0;
          }
        }
      }
      row.calculatedCogs = cogsForThisOut;
      row.calculatedUnitCost = qty !== 0 ? cogsForThisOut / qty : 0;
    }
  }

  return entries;
}
