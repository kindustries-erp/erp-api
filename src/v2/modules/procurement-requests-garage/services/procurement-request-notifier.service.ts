import { Injectable, Logger } from '@nestjs/common';
import type { NotificationPayload } from '@/v2/core/notifications-core';
import { NotificationsPublisherService } from '@/v2/modules/notifications-inbox/services/notifications-publisher.service';

/** Đích thông báo: web dùng để mở phiếu đề nghị garage khi người dùng bấm vào. */
export const PROCUREMENT_REQUEST_GARAGE_TARGET = 'PROCUREMENT_REQUEST_GARAGE';

/** Các trường của phiếu cần để chọn người nhận và nội dung thông báo. */
export interface NotifiableRequest {
  id: string;
  requestNo: string;
  title: string | null;
  status: string;
  createdBy: string | null;
  approverId: string | null;
  /** Người duyệt trước khi thu hồi (recall xóa approverId trên phiếu). */
  previousApproverId?: string | null;
  /** Trạng thái trước khi chuyển (dùng để chỉ báo khi đang chờ duyệt). */
  previousStatus?: string | null;
}

interface NotificationPlan {
  userId: string;
  payload: NotificationPayload;
}

/**
 * Thông báo cho đề nghị garage sau khi chuyển trạng thái:
 * - gửi duyệt (PENDING_APPROVAL, có người duyệt): báo người duyệt được chỉ định.
 * - duyệt / từ chối: báo người tạo phiếu.
 * - thu hồi / hủy khi đang chờ duyệt: báo người duyệt (trước đó).
 * Khóa duyệt tắt (tự duyệt) hoặc không có người duyệt thì không gửi.
 */
@Injectable()
export class ProcurementRequestNotifierService {
  private readonly logger = new Logger(ProcurementRequestNotifierService.name);

  constructor(private readonly publisher: NotificationsPublisherService) {}

  /** Gọi sau khi transition đã commit. Lỗi gửi thông báo chỉ được log, không làm hỏng luồng duyệt. */
  async afterTransition(
    action: string,
    header: NotifiableRequest,
    actorId: string,
    reason?: string | null,
  ): Promise<void> {
    const plan = this.planFor(action, header, actorId, reason ?? null);
    if (!plan) return;
    try {
      await this.publisher.createForUser(plan.userId, plan.payload);
    } catch (err) {
      this.logger.warn(
        `Không gửi được thông báo phiếu ${header.requestNo}: ${(err as Error).message}`,
      );
    }
  }

  private planFor(
    action: string,
    header: NotifiableRequest,
    actorId: string,
    reason: string | null,
  ): NotificationPlan | null {
    const ref = header.title
      ? `${header.requestNo} - ${header.title}`
      : header.requestNo;

    if (action === 'submit') {
      if (header.status !== 'PENDING_APPROVAL') return null;
      if (!header.approverId || header.approverId === actorId) return null;
      return {
        userId: header.approverId,
        payload: {
          title: 'Có đề nghị chờ bạn duyệt',
          message: `${ref} đang chờ bạn duyệt`,
          type: 'INFO',
          extraData: { event: 'SUBMITTED', requestNo: header.requestNo },
          target: {
            module: PROCUREMENT_REQUEST_GARAGE_TARGET,
            id: header.id,
            action: 'APPROVE',
          },
        },
      };
    }

    if (action === 'approve' || action === 'reject') {
      if (!header.createdBy || header.createdBy === actorId) return null;
      const approved = action === 'approve';
      return {
        userId: header.createdBy,
        payload: {
          title: approved ? 'Đề nghị đã được duyệt' : 'Đề nghị bị từ chối',
          message: approved
            ? `${ref} đã được duyệt`
            : `${ref} bị từ chối${reason ? `: ${reason}` : ''}`,
          type: approved ? 'SUCCESS' : 'WARNING',
          extraData: {
            event: approved ? 'APPROVED' : 'REJECTED',
            requestNo: header.requestNo,
          },
          target: {
            module: PROCUREMENT_REQUEST_GARAGE_TARGET,
            id: header.id,
            action: 'VIEW',
          },
        },
      };
    }

    if (action === 'recall' || action === 'cancel') {
      return this.planRecallOrCancel(action, header, actorId, reason, ref);
    }

    return null;
  }

  /** Thu hồi / hủy chỉ báo người duyệt khi phiếu đang chờ duyệt, và không báo chính người thao tác. */
  private planRecallOrCancel(
    action: 'recall' | 'cancel',
    header: NotifiableRequest,
    actorId: string,
    reason: string | null,
    ref: string,
  ): NotificationPlan | null {
    if (header.previousStatus !== 'PENDING_APPROVAL') return null;
    const recipient =
      action === 'recall'
        ? header.previousApproverId
        : (header.approverId ?? header.previousApproverId ?? null);
    if (!recipient || recipient === actorId) return null;

    const recalled = action === 'recall';
    return {
      userId: recipient,
      payload: {
        title: recalled
          ? 'Đề nghị mua đã được thu hồi'
          : 'Đề nghị mua đã bị hủy',
        message: recalled
          ? `${ref} đã được thu hồi`
          : `${ref} đã bị hủy${reason ? `: ${reason}` : ''}`,
        type: recalled ? 'INFO' : 'WARNING',
        extraData: {
          event: recalled ? 'RECALLED' : 'CANCELLED',
          requestNo: header.requestNo,
        },
        target: {
          module: PROCUREMENT_REQUEST_GARAGE_TARGET,
          id: header.id,
          action: 'VIEW',
        },
      },
    };
  }
}
