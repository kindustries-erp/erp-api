import { GarageGoodsReceipt } from '../entities/garage-goods-receipt.entity';
import { GarageGoodsReceiptLine } from '../entities/garage-goods-receipt-line.entity';
import { CreateGarageGoodsReceiptDto } from '../dto/create-garage-goods-receipt.dto';
import {
  GarageGoodsReceiptResponseDto,
  GarageGoodsReceiptLineResponseDto,
} from '../dto/garage-goods-receipt-response.dto';

export function toGarageGoodsReceiptLineResponse(
  line: GarageGoodsReceiptLine,
): GarageGoodsReceiptLineResponseDto {
  return {
    id: line.id,
    extraData: line.extraData ?? {},
    lineNo: line.lineNo,
    itemCode: line.itemCode ?? undefined,
    itemName: line.itemName,
    unit: line.unit,
    qtyReceived: Number(line.qtyReceived || 0),
    unitCost: Number(line.unitCost || 0),
    amount: Number(line.amount || 0),
    notes: line.notes ?? undefined,
    procurementOrderLineId: line.procurementOrderLineId ?? undefined,
    createdAt: line.createdAt,
  };
}

/** Chuyển entity sang response DTO. Hàm thuần, không gọi DB. */
export function toGarageGoodsReceiptResponse(
  entity: GarageGoodsReceipt,
): GarageGoodsReceiptResponseDto {
  return {
    id: entity.id,
    extraData: entity.extraData ?? {},
    receiptNo: entity.receiptNo,
    receiptDate: entity.receiptDate,
    supplierId: entity.supplierId ?? undefined,
    supplierName: entity.supplierName ?? undefined,
    branchId: entity.branchId ?? undefined,
    branchName: entity.branchName ?? undefined,
    totalAmount:
      entity.totalAmount == null ? undefined : Number(entity.totalAmount),
    status: entity.status,
    paymentStatus: entity.paymentStatus,
    garageProcurementOrderId: entity.garageProcurementOrderId ?? undefined,
    remarks: entity.remarks ?? undefined,
    lines: entity.lines?.map(toGarageGoodsReceiptLineResponse),
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}

/**
 * Chuyển dữ liệu DTO sang dạng ghi vào entity.
 * Bỏ các key `undefined` để cập nhật một phần không ghi đè giá trị cũ.
 */
export function toGarageGoodsReceiptEntityFields(
  dto: Partial<CreateGarageGoodsReceiptDto>,
): Partial<GarageGoodsReceipt> {
  return omitUndefined<Partial<GarageGoodsReceipt>>({
    receiptNo: dto.receiptNo,
    receiptDate:
      dto.receiptDate === undefined ? undefined : new Date(dto.receiptDate),
    supplierId: dto.supplierId,
    supplierName: dto.supplierName,
    branchId: dto.branchId,
    branchName: dto.branchName,
    totalAmount:
      dto.totalAmount === undefined ? undefined : String(dto.totalAmount),
    status: dto.status,
    paymentStatus: dto.paymentStatus,
    garageProcurementOrderId: dto.garageProcurementOrderId,
    remarks: dto.remarks,
  });
}

function omitUndefined<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as T;
}
