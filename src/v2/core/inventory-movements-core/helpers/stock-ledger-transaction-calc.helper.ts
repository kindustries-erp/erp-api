import type { DataSource } from 'typeorm';
import type { StockTransactionItemDto } from '../dto/stock-ledger-response.dto';
import { roundTo, toNumber } from './decimal.helper';

export interface RawStockTransactionRow {
  id: string;
  transactionDate: Date;
  transactionType: string;
  documentType: string;
  documentId: string;
  qtyIn: string | number;
  qtyOut: string | number;
  unitCost: string | number;
  createdAt?: Date;
}

interface FifoLayer {
  qty: number;
  unitCost: number;
}

/**
 * Tính toán số dư tồn lũy kế và giá vốn (Bình quân gia quyền hoặc FIFO)
 * trên chuỗi giao dịch được sắp xếp theo thời gian tăng dần (chronological ASC).
 */
export function calculateRunningStockTransactions(
  rows: RawStockTransactionRow[],
  costingMethod: 'WEIGHTED_AVG' | 'FIFO' = 'WEIGHTED_AVG',
): StockTransactionItemDto[] {
  if (costingMethod === 'FIFO') {
    return calculateFifo(rows);
  }
  return calculateWeightedAvg(rows);
}

function calculateWeightedAvg(
  rows: RawStockTransactionRow[],
): StockTransactionItemDto[] {
  let runningQty = 0;
  let runningValue = 0;

  return rows.map((r) => {
    const qtyIn = toNumber(r.qtyIn);
    const qtyOut = toNumber(r.qtyOut);
    const recordedCost = toNumber(r.unitCost);

    let unitCost = recordedCost;
    let totalAmount = 0;

    if (qtyIn > 0) {
      totalAmount = roundTo(qtyIn * recordedCost, 2);
      runningQty = roundTo(runningQty + qtyIn, 3);
      runningValue = roundTo(runningValue + totalAmount, 2);
      unitCost = recordedCost;
    } else if (qtyOut > 0) {
      unitCost = recordedCost;
      totalAmount = roundTo(qtyOut * unitCost, 2);
      runningQty = roundTo(runningQty - qtyOut, 3);
      runningValue = Math.max(0, roundTo(runningValue - totalAmount, 2));
    }

    return {
      id: r.id,
      transactionDate: r.transactionDate,
      transactionType: r.transactionType,
      documentType: r.documentType,
      documentId: r.documentId,
      qtyIn,
      qtyOut,
      unitCost,
      totalAmount,
      balanceQty: runningQty,
      balanceValue: runningValue,
      createdAt: r.createdAt,
    };
  });
}

function calculateFifo(
  rows: RawStockTransactionRow[],
): StockTransactionItemDto[] {
  const layers: FifoLayer[] = [];
  let runningQty = 0;

  return rows.map((r) => {
    const qtyIn = toNumber(r.qtyIn);
    const qtyOut = toNumber(r.qtyOut);
    const recordedCost = toNumber(r.unitCost);

    let unitCost = recordedCost;
    let totalAmount = 0;

    if (qtyIn > 0) {
      layers.push({ qty: qtyIn, unitCost: recordedCost });
      totalAmount = roundTo(qtyIn * recordedCost, 2);
      runningQty = roundTo(runningQty + qtyIn, 3);
      unitCost = recordedCost;
    } else if (qtyOut > 0) {
      let need = qtyOut;
      let consumedValue = 0;

      for (let i = 0; i < layers.length && need > 0; i++) {
        const layer = layers[i];
        if (layer.qty <= 0) continue;

        const take = Math.min(layer.qty, need);
        consumedValue += take * layer.unitCost;
        layer.qty = roundTo(layer.qty - take, 3);
        need = roundTo(need - take, 3);
      }

      totalAmount = roundTo(consumedValue, 2);
      unitCost = qtyOut > 0 ? roundTo(consumedValue / qtyOut, 2) : 0;
      runningQty = roundTo(runningQty - qtyOut, 3);
    }

    // Giá trị tồn sau dòng là tổng giá trị các lớp còn lại
    const balanceValue = roundTo(
      layers.reduce((sum, l) => sum + l.qty * l.unitCost, 0),
      2,
    );

    return {
      id: r.id,
      transactionDate: r.transactionDate,
      transactionType: r.transactionType,
      documentType: r.documentType,
      documentId: r.documentId,
      qtyIn,
      qtyOut,
      unitCost,
      totalAmount,
      balanceQty: runningQty,
      balanceValue,
      createdAt: r.createdAt,
    };
  });
}

/**
 * Tra cứu mã số chứng từ (Số phiếu) từ các bảng nguồn chứng từ kho Garage.
 */
export async function resolveDocumentNumbers(
  dataSource: DataSource,
  docRefs: { documentType: string; documentId: string }[],
): Promise<Map<string, string>> {
  const docMap = new Map<string, string>();
  if (!docRefs.length || typeof dataSource?.query !== 'function') {
    return docMap;
  }

  const byType = new Map<string, string[]>();
  for (const ref of docRefs) {
    if (!ref.documentType || !ref.documentId) continue;
    const list = byType.get(ref.documentType) || [];
    list.push(ref.documentId);
    byType.set(ref.documentType, list);
  }

  const queries: Promise<void>[] = [];

  // 1. PURCHASE_RECEIPT
  const purchaseIds = byType.get('PURCHASE_RECEIPT') || [];
  if (purchaseIds.length) {
    queries.push(
      (async () => {
        try {
          const rows = await dataSource.query(
            `SELECT id, receipt_no AS no FROM goods_receipts_garage WHERE id = ANY($1)`,
            [purchaseIds],
          );
          for (const row of rows) {
            docMap.set(`PURCHASE_RECEIPT:${row.id}`, row.no);
          }
        } catch {
          // Bỏ qua nếu bảng chưa tồn tại hoặc lỗi query
        }
      })(),
    );
  }

  // 2. OTHER_RECEIPT
  const otherReceiptIds = byType.get('OTHER_RECEIPT') || [];
  if (otherReceiptIds.length) {
    queries.push(
      (async () => {
        try {
          const rows = await dataSource.query(
            `SELECT id, voucher_no AS no FROM garage_stock_receipts WHERE id = ANY($1)`,
            [otherReceiptIds],
          );
          for (const row of rows) {
            docMap.set(`OTHER_RECEIPT:${row.id}`, row.no);
          }
        } catch {}
      })(),
    );
  }

  // 3. ISSUE
  const issueIds = byType.get('ISSUE') || [];
  if (issueIds.length) {
    queries.push(
      (async () => {
        try {
          const rows = await dataSource.query(
            `SELECT id, voucher_no AS no FROM garage_stock_issues WHERE id = ANY($1)`,
            [issueIds],
          );
          for (const row of rows) {
            docMap.set(`ISSUE:${row.id}`, row.no);
          }
        } catch {}
      })(),
    );
  }

  // 4. ADJUSTMENT
  const adjustmentIds = byType.get('ADJUSTMENT') || [];
  if (adjustmentIds.length) {
    queries.push(
      (async () => {
        try {
          const rows = await dataSource.query(
            `SELECT id, voucher_no AS no FROM garage_stock_adjustments WHERE id = ANY($1)`,
            [adjustmentIds],
          );
          for (const row of rows) {
            docMap.set(`ADJUSTMENT:${row.id}`, row.no);
          }
        } catch {}
      })(),
    );
  }

  await Promise.all(queries);
  return docMap;
}
