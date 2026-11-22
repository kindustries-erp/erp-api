import { BadRequestException, ConflictException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type {
  ProcurementFlowFulfilmentItem,
  ProcurementFlowStockDocument,
  ProcurementFlowStockLine,
} from '@/v2/core/procurement-flow-core';
import { GarageGoodsReceipt } from '@/v2/modules/goods-receipts-garage/entities/garage-goods-receipt.entity';
import { GarageGoodsReceiptLine } from '@/v2/modules/goods-receipts-garage/entities/garage-goods-receipt-line.entity';
import { InventoryMovementsGarageTransaction } from '@/v2/modules/inventory-movements-garage-ledger/entities/inventory-movements-garage-transaction.entity';
import { GarageProcurementOrder } from '@/v2/modules/procurement-orders-garage/entities/procurement-order.entity';

/** Loại chứng từ ghi vào sổ tồn garage khi phiếu nhập kho được ghi sổ. */
export const GARAGE_GOODS_RECEIPT_DOC_TYPE = 'GOODS_RECEIPT_GARAGE';

/** Mỗi dòng phiếu nhập gắn đơn mua phải trỏ tới một dòng đơn mua. */
export function toFulfilmentItems(
  lines: GarageGoodsReceiptLine[],
): ProcurementFlowFulfilmentItem[] {
  return lines.map((line) => {
    if (!line.procurementOrderLineId) {
      throw new BadRequestException(
        `Dòng ${line.lineNo} chưa gắn dòng đơn mua`,
      );
    }
    return {
      orderLineId: line.procurementOrderLineId,
      qty: Number(line.qtyReceived || 0),
    };
  });
}

/** Dòng phiếu nhập → dòng nhập sổ tồn. Dòng thiếu mã hàng dùng tên hàng làm mã. */
export function toStockLines(
  lines: GarageGoodsReceiptLine[],
): ProcurementFlowStockLine[] {
  return lines.map((line) => ({
    itemCode: line.itemCode || line.itemName,
    itemName: line.itemName,
    unit: line.unit || 'Cái',
    qty: Number(line.qtyReceived || 0),
    unitCost: Number(line.unitCost || 0),
  }));
}

/** Chứng từ gốc ghi vào sổ tồn: chính phiếu nhập. Chi nhánh trống ghi null. */
export function toStockDocument(
  receipt: GarageGoodsReceipt,
): ProcurementFlowStockDocument {
  const date = new Date(receipt.receiptDate);
  return {
    branchId: receipt.branchId ?? null,
    documentType: GARAGE_GOODS_RECEIPT_DOC_TYPE,
    documentId: receipt.id,
    transactionDate: Number.isNaN(date.getTime()) ? new Date() : date,
    createdBy: receipt.createdBy ?? null,
  };
}

/** Dòng phiếu nhập gắn đơn mua phải có dòng đơn mua tương ứng và cùng chi nhánh, NCC với đơn. */
export async function assertReceiptMatchesOrder(
  manager: EntityManager,
  receipt: GarageGoodsReceipt,
  lines: GarageGoodsReceiptLine[],
): Promise<void> {
  const order = await manager.findOne(GarageProcurementOrder, {
    where: {
      id: receipt.garageProcurementOrderId as string,
      isDeleted: false,
    },
  });
  if (!order) {
    throw new BadRequestException('Không tìm thấy đơn mua garage liên kết');
  }
  if ((receipt.branchId ?? null) !== (order.branchId ?? null)) {
    throw new BadRequestException('Phiếu nhập khác chi nhánh với đơn mua');
  }
  if ((receipt.supplierId ?? null) !== (order.supplierId ?? null)) {
    throw new BadRequestException('Phiếu nhập khác nhà cung cấp với đơn mua');
  }
  toFulfilmentItems(lines);
}

export const GOODS_USED_MESSAGE =
  'Hàng đã xuất/điều chỉnh sau khi nhập kho, không thể hoàn nhập';

/**
 * Lý do chặn hoàn nhập, hoặc null nếu hàng chưa dùng: sau lúc ghi sổ phiếu không có phiếu xuất/điều chỉnh
 * nào của cùng mã hàng và chi nhánh trong sổ garage_stock_transactions.
 */
export async function findReverseBlockedReason(
  manager: EntityManager,
  receipt: GarageGoodsReceipt,
  lines: GarageGoodsReceiptLine[],
): Promise<string | null> {
  const codes = [...new Set(toStockLines(lines).map((l) => l.itemCode))];
  if (codes.length === 0) return null;
  const repo = manager.getRepository(InventoryMovementsGarageTransaction);
  const posted = await repo
    .createQueryBuilder('t')
    .select('MIN(t.createdAt)', 'at')
    .where('t.documentType = :dt AND t.documentId = :id', {
      dt: GARAGE_GOODS_RECEIPT_DOC_TYPE,
      id: receipt.id,
    })
    .andWhere("t.transactionType = 'RECEIPT'")
    .getRawOne<{ at: Date | null }>();
  if (!posted?.at) return null;
  const qb = repo
    .createQueryBuilder('t')
    .where('t.itemCode IN (:...codes)', { codes })
    .andWhere("t.transactionType IN ('ISSUE', 'ADJUSTMENT')")
    .andWhere('t.createdAt > :at', { at: posted.at });
  if (receipt.branchId) {
    qb.andWhere('t.branchId = :branch', { branch: receipt.branchId });
  } else {
    qb.andWhere('t.branchId IS NULL');
  }
  return (await qb.getCount()) > 0 ? GOODS_USED_MESSAGE : null;
}

/** Chỉ cho hoàn nhập khi hàng của phiếu chưa xuất/điều chỉnh (409 nếu đã dùng). */
export async function assertGoodsUnused(
  manager: EntityManager,
  receipt: GarageGoodsReceipt,
  lines: GarageGoodsReceiptLine[],
): Promise<void> {
  const reason = await findReverseBlockedReason(manager, receipt, lines);
  if (reason) throw new ConflictException(reason);
}
