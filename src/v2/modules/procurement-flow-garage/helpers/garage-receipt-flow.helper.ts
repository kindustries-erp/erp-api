import { BadRequestException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type {
  ProcurementFlowFulfilmentItem,
  ProcurementFlowStockDocument,
  ProcurementFlowStockLine,
} from '@/v2/core/procurement-flow-core';
import { GarageGoodsReceipt } from '@/v2/modules/goods-receipts-garage/entities/garage-goods-receipt.entity';
import { GarageGoodsReceiptLine } from '@/v2/modules/goods-receipts-garage/entities/garage-goods-receipt-line.entity';
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
