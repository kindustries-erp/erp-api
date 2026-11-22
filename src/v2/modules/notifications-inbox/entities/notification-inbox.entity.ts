import { Entity, Index } from 'typeorm';
import { BaseNotificationEntity } from '@/v2/core/notifications-core';

/**
 * Hộp thư thông báo theo user (v2). Mỗi dòng gắn đúng một `user_id`.
 * Producer ghi qua `NotificationsPublisherService`. Bảng tách khỏi `core_notifications` (v1).
 */
@Entity({ name: 'notifications_inbox' })
@Index('IDX_notifications_inbox_user_list', [
  'userId',
  'isDeleted',
  'isRead',
  'createdAt',
])
export class NotificationInbox extends BaseNotificationEntity {}
