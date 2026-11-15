import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { GarageProcurementOrder } from '@/v2/modules/procurement-orders-garage/entities/procurement-order.entity';
import { GarageGoodsReceipt } from '../entities/garage-goods-receipt.entity';

/** Các trường phiếu nhập luôn lấy theo đơn mua, không nhận giá trị từ client. */
export type ReceiptOrderFields = Pick<
  GarageGoodsReceipt,
  'supplierId' | 'supplierName' | 'branchId' | 'branchName'
>;

/**
 * Nạp đơn mua để lập phiếu nhập: đơn phải tồn tại, chưa xóa, đã phát hành và chưa nhận đủ.
 * Dùng khi tạo phiếu mới hoặc gắn đơn cho phiếu cũ chưa có đơn.
 */
export async function loadOrderForNewReceipt(
  manager: EntityManager,
  orderId: string,
): Promise<GarageProcurementOrder> {
  const order = await manager.findOne(GarageProcurementOrder, {
    where: { id: orderId, isDeleted: false },
  });
  if (!order) {
    throw new BadRequestException('Không tìm thấy đơn mua garage liên kết');
  }
  if (order.status !== 'ISSUED') {
    throw new BadRequestException('Chỉ lập phiếu nhập từ đơn mua đã phát hành');
  }
  if (order.fulfillmentStatus === 'FULL') {
    throw new BadRequestException('Đơn mua đã nhận đủ hàng');
  }
  return order;
}

/** NCC và chi nhánh của phiếu nhập luôn là của đơn mua. */
export function receiptFieldsFromOrder(
  order: GarageProcurementOrder,
): ReceiptOrderFields {
  return {
    supplierId: order.supplierId ?? null,
    supplierName: order.supplierName ?? null,
    branchId: order.branchId ?? null,
    branchName: order.branchName ?? null,
  } as ReceiptOrderFields;
}

/** Bỏ NCC, chi nhánh, tổng tiền client gửi lên khi phiếu đã gắn đơn mua. */
export function stripOrderOwnedFields<
  T extends {
    supplierId?: unknown;
    supplierName?: unknown;
    branchId?: unknown;
    branchName?: unknown;
    totalAmount?: unknown;
  },
>(dto: T): T {
  const {
    supplierId: _s,
    supplierName: _sn,
    branchId: _b,
    branchName: _bn,
    totalAmount: _t,
    ...rest
  } = dto;
  return rest as T;
}

/** Đơn mua của phiếu không đổi sau khi đã gắn. */
export function assertOrderUnchanged(
  current: string | null | undefined,
  next: string | undefined,
): void {
  if (current && next && current !== next) {
    throw new BadRequestException('Không đổi được đơn mua của phiếu nhập');
  }
}
