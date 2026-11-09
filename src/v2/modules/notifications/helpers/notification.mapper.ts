import type { NotificationCore } from '@/v2/core/notifications-core';
import type { PaginationMetaDto } from '@/common/dto/pagination-meta.dto';
import type { NotificationResponseDto } from '../dto/notification-response.dto';

/** Entity -> response DTO. Không trả entity ra ngoài module. */
export function toNotificationResponse(
  row: Pick<
    NotificationCore,
    | 'id'
    | 'title'
    | 'message'
    | 'type'
    | 'isRead'
    | 'readAt'
    | 'createdAt'
    | 'extraData'
    | 'targetModule'
    | 'targetId'
    | 'action'
  >,
): NotificationResponseDto {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    type: row.type,
    isRead: row.isRead,
    readAt: row.readAt ? new Date(row.readAt).toISOString() : null,
    createdAt: new Date(row.createdAt).toISOString(),
    extraData: row.extraData ?? {},
    target:
      row.targetModule && row.targetId
        ? {
            module: row.targetModule,
            id: row.targetId,
            action: row.action ?? null,
          }
        : null,
  };
}

/** `totalPages` tối thiểu là 1, khớp chuẩn `pagination` của v2. */
export function toPaginationMeta(
  page: number,
  pageSize: number,
  total: number,
): PaginationMetaDto {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
