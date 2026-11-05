import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  PROCUREMENT_FULFILLMENT_STATUS,
  PROCUREMENT_ORDER_STATUS,
  ProcurementFulfillmentStatus,
  ProcurementOrderStatus,
} from '../contracts/procurement-orders.contract';

const EPS = 1e-9;

export interface OrderLineQty {
  qtyOrdered: number;
  qtyFulfilled: number;
}

export interface SubmitCheckLine {
  unitPrice: string | null;
}

/** Suy tiến độ giao nhận từ các dòng. Hàm thuần. */
export function fulfillmentStatusOf(
  lines: OrderLineQty[],
): ProcurementFulfillmentStatus {
  const total = lines.reduce((sum, l) => sum + l.qtyFulfilled, 0);
  if (total <= EPS) return PROCUREMENT_FULFILLMENT_STATUS.NONE;
  const allFull = lines.every((l) => l.qtyFulfilled >= l.qtyOrdered - EPS);
  return allFull
    ? PROCUREMENT_FULFILLMENT_STATUS.FULL
    : PROCUREMENT_FULFILLMENT_STATUS.PARTIAL;
}

/** Chỉ sửa header và dòng khi còn DRAFT. */
export function assertEditable(status: ProcurementOrderStatus): void {
  if (status !== PROCUREMENT_ORDER_STATUS.DRAFT) {
    throw new ConflictException(
      `Chỉ sửa được khi ở DRAFT, hiện tại là ${status}`,
    );
  }
}

/** Gửi duyệt phải có NCC và đơn giá ở mọi dòng. */
export function assertReadyToSubmit(
  supplierId: string | null,
  lines: SubmitCheckLine[],
): void {
  if (!supplierId) {
    throw new BadRequestException(
      'Đơn mua cần chọn nhà cung cấp trước khi gửi duyệt',
    );
  }
  if (lines.length === 0) {
    throw new BadRequestException('Đơn mua phải có ít nhất một dòng');
  }
  if (lines.some((l) => l.unitPrice === null || Number(l.unitPrice) < 0)) {
    throw new BadRequestException(
      'Mọi dòng phải có đơn giá trước khi gửi duyệt',
    );
  }
}

/** Hủy PO chỉ khi chưa có hàng nhận hoặc nghiệm thu. */
export function assertCanCancel(lines: OrderLineQty[]): void {
  if (lines.some((l) => l.qtyFulfilled > EPS)) {
    throw new ConflictException(
      'Không hủy được đơn đã có nhận hàng hoặc nghiệm thu, hãy đóng thiếu',
    );
  }
}

export interface OrderDraftLineInput {
  lineType: string;
  qtyOrdered: number;
  unitPrice?: number | null;
  requestLineId?: string | null;
}

/** Dòng đơn mua: loại hợp lệ, số lượng dương, và khớp với có/không có PR nguồn. */
export function assertValidOrderLines(
  lines: OrderDraftLineInput[],
  requestId: string | null,
): void {
  if (lines.length === 0) {
    throw new BadRequestException('Đơn mua phải có ít nhất một dòng');
  }
  lines.forEach((l, i) => {
    if (l.lineType !== 'GOODS' && l.lineType !== 'SERVICE') {
      throw new BadRequestException(
        `Dòng ${i + 1}: loại dòng phải là GOODS hoặc SERVICE`,
      );
    }
    if (!(l.qtyOrdered > 0)) {
      throw new BadRequestException(`Dòng ${i + 1}: số lượng phải lớn hơn 0`);
    }
    if (l.unitPrice != null && l.unitPrice < 0) {
      throw new BadRequestException(`Dòng ${i + 1}: đơn giá không được âm`);
    }
    if (requestId && !l.requestLineId) {
      throw new BadRequestException(
        `Dòng ${i + 1}: đơn mua từ đề nghị phải gắn dòng đề nghị`,
      );
    }
    if (!requestId && l.requestLineId) {
      throw new BadRequestException(
        `Dòng ${i + 1}: chỉ gắn dòng đề nghị khi đơn có đề nghị nguồn`,
      );
    }
  });
}

/** Tổng tiền đơn, làm tròn 2 chữ số như cột numeric(18,2). */
export function orderTotalOf(lines: OrderDraftLineInput[]): number {
  const sum = lines.reduce(
    (acc, l) => acc + l.qtyOrdered * (l.unitPrice ?? 0),
    0,
  );
  return Math.round(sum * 100) / 100;
}
