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
  balanceQty?: number;
  balanceValue?: number;
  shortageQty?: number;
  [key: string]: any;
}

export interface FifoEntryMetrics {
  cogs: number | null;
  shortageQty: number;
  balanceQty: number;
  balanceValue: number;
}

export interface FifoRunResult {
  unitRows: FifoUnitRow[];
  /** Số liệu theo từng dòng, cùng thứ tự với `entries`. */
  metrics: FifoEntryMetrics[];
}

/** Số lượng có dấu: điều chỉnh đảo chiều (adjSign -1) thành số âm. */
function signedQty(row: LedgerEntryForFifo): number {
  let qty = Number(row.qty || 0);
  if (row.isAdjustment && row.adjSign === -1) {
    qty = -qty;
  }
  return qty;
}

const EPSILON = 0.0001;

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/**
 * Pure Engine FIFO đơn vị: lõi mô phỏng duy nhất cho bảng kê và số liệu lũy kế.
 *
 * Trạng thái đơn vị:
 * - IN_STOCK: còn trong kho, chưa bán và chưa từng bị trả.
 * - SOLD: đã bán (có giá vốn FIFO và lợi nhuận).
 * - RETURNED: đã bán rồi trả về kho; vẫn tính là tồn cho tới khi bán lại.
 * - ADJUSTMENT: lô nhập bị điều chỉnh giảm.
 * - SHORTAGE: phần xuất (hoặc đảo nhập) vượt tồn, không có giá vốn.
 *
 * Bất biến: balanceQty = Σ IN đã ký − Σ OUT đã ký (kể cả thiếu hàng).
 */
export function runFifo(entries: LedgerEntryForFifo[]): FifoRunResult {
  const unitRows: FifoUnitRow[] = [];
  let unitIndexCounter = 1;
  // Chỉ số các đơn vị đang trong kho (IN_STOCK hoặc RETURNED), theo thứ tự FIFO
  const inQueue: number[] = [];
  let shortageTotal = 0;
  const metrics: FifoEntryMetrics[] = [];

  const addShortage = (
    row: LedgerEntryForFifo,
    qty: number,
    outPricePerUnit: number,
  ) => {
    shortageTotal += qty;
    unitRows.push({
      unitIndex: unitIndexCounter++,
      inLedgerId: '',
      inDate: '',
      inInvoiceNo: '',
      inInvoiceId: '',
      inUnitCost: 0,
      outLedgerId: row.id,
      outDate: row.transactionDate,
      outInvoiceNo: row.invoiceNo,
      outInvoiceId: row.invoiceId,
      licensePlate: row.licensePlate,
      outPrice: outPricePerUnit,
      cogsFifo: null,
      profit: null,
      qty: round4(qty),
      status: 'SHORTAGE',
    });
  };

  for (const row of entries) {
    const qty = signedQty(row);
    const amount = Number(row.preVatAmount || 0);
    let cogs: number | null = null;

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
        while (qToReverse > EPSILON && inQueue.length > 0) {
          const rowIndex = inQueue[0];
          const unitRow = unitRows[rowIndex];

          if (unitRow.qty! <= qToReverse + EPSILON) {
            qToReverse -= unitRow.qty!;
            unitRow.status = 'ADJUSTMENT';
            inQueue.shift();
          } else {
            unitRow.qty = round4(unitRow.qty! - qToReverse);
            unitRows.push({
              ...unitRow,
              qty: qToReverse,
              unitIndex: unitIndexCounter++,
              status: 'ADJUSTMENT',
            });
            qToReverse = 0;
          }
        }
        if (qToReverse > EPSILON) {
          addShortage(row, qToReverse, 0);
        }
      }
    } else if (row.direction === 'OUT') {
      cogs = 0;
      if (qty > 0) {
        const outPricePerUnit = amount / qty;
        let qNeeded = qty;
        while (qNeeded > EPSILON && inQueue.length > 0) {
          const rowIndex = inQueue[0];
          const unitRow = unitRows[rowIndex];

          if (unitRow.qty! <= qNeeded + EPSILON) {
            qNeeded -= unitRow.qty!;
            cogs += unitRow.qty! * unitRow.inUnitCost;
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
            const consumed = round4(qNeeded);
            unitRow.qty = round4(unitRow.qty! - consumed);
            cogs += consumed * unitRow.inUnitCost;

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

        if (qNeeded > EPSILON) {
          addShortage(row, qNeeded, outPricePerUnit);
        }
      } else if (qty < 0) {
        // Hàng trả lại: đảo các lần bán gần nhất, đưa đơn vị về kho với giá vốn cũ
        let remaining = Math.abs(qty);
        for (let k = unitRows.length - 1; k >= 0 && remaining > EPSILON; k--) {
          const unitRow = unitRows[k];
          if (unitRow.status !== 'SOLD') continue;

          const take = Math.min(unitRow.qty!, remaining);
          if (take < unitRow.qty! - EPSILON) {
            // Phần chưa trả giữ nguyên trạng thái đã bán
            unitRows.push({
              ...unitRow,
              qty: round4(unitRow.qty! - take),
              unitIndex: unitIndexCounter++,
            });
          }

          cogs -= take * unitRow.inUnitCost;
          unitRow.qty = take;
          unitRow.status = 'RETURNED';
          unitRow.returnLedgerId = row.id;
          unitRow.returnDate = row.transactionDate;
          unitRow.returnInvoiceNo = row.invoiceNo;
          unitRow.outPrice = undefined;
          unitRow.profit = undefined;
          unitRow.cogsFifo = undefined;
          inQueue.unshift(k);
          remaining -= take;
        }

        if (remaining > EPSILON) {
          // Không có lần bán để đảo: nhập lại kho với giá vốn 0 (cần đối chiếu)
          unitRows.push({
            unitIndex: unitIndexCounter++,
            inLedgerId: '',
            inDate: '',
            inInvoiceNo: '',
            inInvoiceId: '',
            inUnitCost: 0,
            qty: round4(remaining),
            returnLedgerId: row.id,
            returnDate: row.transactionDate,
            returnInvoiceNo: row.invoiceNo,
            status: 'RETURNED',
          });
          inQueue.unshift(unitRows.length - 1);
        }
      }
    }

    let balanceQty = -shortageTotal;
    let balanceValue = 0;
    for (const idx of inQueue) {
      balanceQty += unitRows[idx].qty!;
      balanceValue += unitRows[idx].qty! * unitRows[idx].inUnitCost;
    }

    metrics.push({
      cogs: row.direction === 'OUT' ? round4(cogs ?? 0) : null,
      shortageQty: round4(shortageTotal),
      balanceQty: round4(balanceQty),
      balanceValue: round4(balanceValue),
    });
  }

  return { unitRows, metrics };
}

/**
 * Bảng kê phân rã đơn vị FIFO (đầu ra cho màn hình chi tiết).
 */
export function calculateFifoUnitRows(
  entries: LedgerEntryForFifo[],
): FifoUnitRow[] {
  return runFifo(entries).unitRows;
}

/**
 * Gắn giá vốn FIFO và số liệu lũy kế vào từng dòng sổ cái.
 * Dòng trả hàng (qty âm) có COGS âm bằng giá vốn của phần hàng đưa về kho.
 */
export function calculateLedgerHistoryCogs(
  entries: LedgerEntryForFifo[],
): LedgerEntryForFifo[] {
  const { metrics } = runFifo(entries);

  entries.forEach((row, i) => {
    const m = metrics[i];
    const qty = signedQty(row);

    if (row.direction === 'IN') {
      row.calculatedCogs = null;
    } else {
      row.calculatedCogs = m.cogs;
      row.calculatedUnitCost = qty !== 0 ? (m.cogs ?? 0) / qty : 0;
    }
    row.balanceQty = m.balanceQty;
    row.balanceValue = m.balanceValue;
    row.shortageQty = m.shortageQty;
  });

  return entries;
}
