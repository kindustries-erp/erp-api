import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { NotificationPayload } from '@/v2/core/notifications-core';
import {
  PROCUREMENT_FLOW_EVENTS,
  type ProcurementFlowEvent,
  type ProcurementFlowEventPort,
} from '@/v2/core/procurement-flow-core';
import { GarageProcurementOrder } from '@/v2/modules/procurement-orders-garage/entities/procurement-order.entity';
import { NotificationsPublisherService } from '@/v2/modules/notifications-inbox/services/notifications-publisher.service';

/** Đích thông báo: đơn mua garage (FE ánh xạ sang drawer khi có đường dẫn). */
export const PROCUREMENT_ORDER_GARAGE_TARGET = 'PROCUREMENT_ORDER_GARAGE';

interface NotificationPlan {
  userId: string;
  payload: NotificationPayload;
}

/**
 * Cổng sự kiện của luồng mua garage: báo người tạo đơn mua khi phiếu nhập kho gắn đơn của họ
 * được ghi sổ hoặc hủy. Chạy SAU commit; lỗi gửi do lõi ghi log, không làm hỏng luồng.
 */
@Injectable()
export class GarageProcurementFlowEventsService implements ProcurementFlowEventPort {
  constructor(
    private readonly dataSource: DataSource,
    private readonly publisher: NotificationsPublisherService,
  ) {}

  async publish(event: ProcurementFlowEvent): Promise<void> {
    const plan = await this.planFor(event);
    if (!plan) return;
    await this.publisher.createForUser(plan.userId, plan.payload);
  }

  private async planFor(
    event: ProcurementFlowEvent,
  ): Promise<NotificationPlan | null> {
    const posted = event.type === PROCUREMENT_FLOW_EVENTS.receiptPosted;
    const cancelled = event.type === PROCUREMENT_FLOW_EVENTS.receiptCancelled;
    if (!posted && !cancelled) return null;

    const orderId = event.payload?.orderId;
    if (typeof orderId !== 'string') return null;

    const order = await this.dataSource
      .getRepository(GarageProcurementOrder)
      .findOne({
        where: { id: orderId },
        select: { id: true, orderNo: true, createdBy: true },
      });
    if (!order?.createdBy || order.createdBy === event.actorId) return null;

    return {
      userId: order.createdBy,
      payload: {
        title: posted ? 'Đơn mua đã nhận hàng' : 'Phiếu nhập kho đã hủy',
        message: posted
          ? `Đơn mua ${order.orderNo} vừa có phiếu nhập kho được ghi sổ`
          : `Phiếu nhập kho của đơn mua ${order.orderNo} đã bị hủy, số nhận hàng được hoàn lại`,
        type: posted ? 'SUCCESS' : 'WARNING',
        extraData: {
          event: posted ? 'GOODS_RECEIVED' : 'GOODS_RECEIPT_CANCELLED',
          orderNo: order.orderNo,
        },
        target: {
          module: PROCUREMENT_ORDER_GARAGE_TARGET,
          id: order.id,
          action: 'VIEW',
        },
      },
    };
  }
}
