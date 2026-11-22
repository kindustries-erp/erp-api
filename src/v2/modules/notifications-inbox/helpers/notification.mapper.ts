import { buildPagination } from '@/common/utils/paginated-result';
import type { NotificationInbox } from '../entities/notification-inbox.entity';
import type { PaginationMetaDto } from '@/common/dto/pagination-meta.dto';
import type { NotificationResponseDto } from '../dto/notification-response.dto';

/** Entity -> response DTO. Không trả entity ra ngoài module. */
export function toNotificationResponse(
  row: Pick<
    NotificationInbox,
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

/** Khối `pagination` chuẩn v2 (dùng chung lõi `buildPagination`). */
export function toPaginationMeta(
  page: number,
  pageSize: number,
  total: number,
): PaginationMetaDto {
  return buildPagination(page, pageSize, total);
}
