import { BadRequestException, Injectable } from '@nestjs/common';
import {
  IPurchaseOrderLine,
  PURCHASE_ORDER_LOCKED_STATUSES,
  PURCHASE_ORDER_STATUS,
  PURCHASE_ORDER_TRANSITIONS,
  PurchaseOrderAction,
  PurchaseOrderStatus,
} from '../contracts/purchase-order.contract';
import { deriveInventoryStatus } from '../helpers/purchase-order.mapper';

export interface NormalizedPurchaseOrderLine {
  qtyOrdered: string;
  unitPrice: string | null;
  amount: string;
}

/**
 * Luật nghiệp vụ PO thuần, không đụng DB. Stateless nên có thể gọi trực tiếp
 * từ v1 khi refactor dần, không cần đổi service.
 */
@Injectable()
export class PurchaseOrderEngine {
  /** Kiểm tra hành động có được phép ở trạng thái hiện tại không. */
  assertAction(action: PurchaseOrderAction, current: string): void {
    const rule = PURCHASE_ORDER_TRANSITIONS[action];
    if (!rule.from.includes(current as PurchaseOrderStatus)) {
      throw new BadRequestException(
        `Không thể ${actionLabel(action)} khi phiếu đang ở trạng thái ${current}`,
      );
    }
  }

  /** Trạng thái đích của một hành động. */
  targetOf(action: PurchaseOrderAction): PurchaseOrderStatus {
    return PURCHASE_ORDER_TRANSITIONS[action].to;
  }

  /** Header được sửa khi chưa khóa (không RECEIVED, không CANCELLED). */
  assertHeaderEditable(current: string): void {
    if (
      PURCHASE_ORDER_LOCKED_STATUSES.includes(current as PurchaseOrderStatus)
    ) {
      throw new BadRequestException(
        `Không thể sửa phiếu đơn mua hàng ở trạng thái ${current}`,
      );
    }
  }

  /**
   * Chuẩn hóa một dòng đầu vào: qty > 0, đơn giá >= 0, và TÍNH LẠI amount
   * = qty × price ở server (không tin số client gửi).
   */
  normalizeLine(input: {
    qtyOrdered: string;
    unitPrice?: string | null;
  }): NormalizedPurchaseOrderLine {
    const qty = Number(input.qtyOrdered);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new BadRequestException('Số lượng đặt phải lớn hơn 0');
    }
    const priceRaw = input.unitPrice ?? null;
    const price = priceRaw === null ? null : Number(priceRaw);
    if (price !== null && (!Number.isFinite(price) || price < 0)) {
      throw new BadRequestException('Đơn giá không được âm');
    }
    const amount = qty * (price ?? 0);
    return {
      qtyOrdered: qty.toFixed(3),
      unitPrice: price === null ? null : price.toFixed(3),
      amount: amount.toFixed(3),
    };
  }

  /**
   * Khi sửa dòng PO đã có nhận hàng: không được đặt SL đặt < SL đã nhận,
   * và không được bỏ dòng đã có SL nhận. Khớp dòng theo thứ tự lineNo.
   */
  assertLinesEditable(
    current: Pick<IPurchaseOrderLine, 'qtyReceived'>[],
    next: Pick<NormalizedPurchaseOrderLine, 'qtyOrdered'>[],
  ): void {
    current.forEach((line, index) => {
      const received = Number(line.qtyReceived || 0);
      if (received <= 0) return;
      const nextLine = next[index];
      if (!nextLine) {
        throw new BadRequestException(
          `Không thể xóa dòng ${index + 1} vì đã nhận ${received} hàng`,
        );
      }
      if (Number(nextLine.qtyOrdered) < received) {
        throw new BadRequestException(
          `Số lượng đặt của dòng ${index + 1} không được nhỏ hơn số đã nhận (${received})`,
        );
      }
    });
  }

  /** Tổng tiền của các dòng, làm tròn 3 chữ số thập phân. */
  totalOf(lines: { amount: string | null }[]): number {
    const sum = lines.reduce((acc, line) => acc + Number(line.amount || 0), 0);
    return Math.round(sum * 1000) / 1000;
  }

  /** Trạng thái hiển thị nhận hàng, khớp toCoreDocument của v1. */
  deriveInventoryStatus(
    status: string,
  ): 'RECEIVED' | 'PARTIAL_RECEIVED' | 'NOT_RECEIVED' {
    return deriveInventoryStatus(status);
  }

  /**
   * Trạng thái sau khi số lượng nhận thay đổi (phục vụ luồng phiếu nhập về sau).
   * Hủy nhận hàng về APPROVED/CONFIRMED như v1.
   */
  statusAfterReceipt(
    current: string,
    totalOrdered: number,
    totalReceived: number,
  ): PurchaseOrderStatus {
    if (totalReceived <= 0) {
      return current === PURCHASE_ORDER_STATUS.CONFIRMED
        ? PURCHASE_ORDER_STATUS.CONFIRMED
        : PURCHASE_ORDER_STATUS.APPROVED;
    }
    if (totalReceived < totalOrdered)
      return PURCHASE_ORDER_STATUS.PARTIAL_RECEIVED;
    return PURCHASE_ORDER_STATUS.RECEIVED;
  }
}

function actionLabel(action: PurchaseOrderAction): string {
  switch (action) {
    case 'approve':
      return 'duyệt';
    case 'confirm':
      return 'xác nhận';
    case 'cancel':
      return 'hủy';
  }
}
