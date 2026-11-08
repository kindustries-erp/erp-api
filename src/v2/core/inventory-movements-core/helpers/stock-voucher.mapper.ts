import type {
  StockVoucherLineResponseDto,
  StockVoucherResponseDto,
} from '../dto/stock-voucher-response.dto';
import type { BaseCreateStockVoucherLineDto } from '../dto/base-stock-voucher-line.dto';
import type { BaseStockVoucherLineEntity } from '../entities/lines/base-stock-voucher-line.entity';
import type { StockMoveLine } from '../contracts/inventory-movements-core.contract';

/** Chuyển dòng chứng từ sang dòng di chuyển kho. `direction` do module quyết định; giá chỉ có ý nghĩa với nhập. */
export function toStockMoveLine(
  line: BaseStockVoucherLineEntity,
  transactionType: StockMoveLine['transactionType'],
): StockMoveLine {
  return {
    itemCode: line.itemCode,
    itemName: line.itemName,
    unit: line.unit || 'Cái',
    qty: Number(line.qty || 0),
    direction: line.direction,
    transactionType,
    unitCost: line.direction === 'IN' ? Number(line.unitCost ?? 0) : null,
  };
}

/** Dựng dòng chứng từ từ DTO đầu vào, chưa có giá xuất. */
export function fromCreateLineDto(
  dto: BaseCreateStockVoucherLineDto,
  lineNo: number,
  direction: 'IN' | 'OUT',
): Partial<BaseStockVoucherLineEntity> {
  const qty = Number(dto.qty || 0);
  const unitCost =
    dto.unitCost === undefined || dto.unitCost === null
      ? null
      : Number(dto.unitCost);
  return {
    lineNo,
    itemCode: dto.itemCode,
    itemName: dto.itemName,
    unit: dto.unit || 'Cái',
    qty: String(qty),
    unitCost: unitCost === null ? null : String(unitCost),
    amount: String(direction === 'IN' ? qty * (unitCost ?? 0) : 0),
    direction,
    notes: dto.notes ?? null,
  };
}

export function toLineResponse(
  line: BaseStockVoucherLineEntity,
): StockVoucherLineResponseDto {
  return {
    id: line.id,
    extraData: line.extraData ?? {},
    lineNo: line.lineNo,
    itemCode: line.itemCode,
    itemName: line.itemName,
    unit: line.unit,
    qty: Number(line.qty || 0),
    unitCost: line.unitCost === null ? null : Number(line.unitCost),
    amount: Number(line.amount || 0),
    direction: line.direction,
    notes: line.notes ?? null,
  };
}

export function toVoucherResponse(
  header: {
    id: string;
    extraData?: Record<string, unknown> | null;
    voucherNo: string;
    voucherDate: Date;
    status: string;
    branchId?: string | null;
    partnerName?: string | null;
    remarks?: string | null;
    totalAmount?: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
  lines: BaseStockVoucherLineEntity[],
): StockVoucherResponseDto {
  return {
    id: header.id,
    extraData: header.extraData ?? {},
    voucherNo: header.voucherNo,
    voucherDate: header.voucherDate,
    status: header.status,
    branchId: header.branchId ?? null,
    partnerName: header.partnerName ?? null,
    remarks: header.remarks ?? null,
    totalAmount:
      header.totalAmount === null || header.totalAmount === undefined
        ? null
        : Number(header.totalAmount),
    createdAt: header.createdAt,
    updatedAt: header.updatedAt,
    lines: lines.map(toLineResponse),
  };
}
