import { Column } from 'typeorm';
import { CoreSoftDeletableEntity } from '@/v2/core/base-core';
import type { NotificationType } from '../types/notification.types';

/**
 * Lớp nền thông báo (abstract, không `@Entity`). Module cụ thể kế thừa và khai báo
 * `@Entity` + `@Index` của riêng mình (ví dụ `notifications-inbox`).
 */
export abstract class BaseNotificationEntity extends CoreSoftDeletableEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'varchar', length: 20, default: 'INFO' })
  type: NotificationType;

  @Column({ type: 'boolean', name: 'is_read', default: false })
  isRead: boolean;

  @Column({ type: 'timestamptz', name: 'read_at', nullable: true })
  readAt: Date | null;

  /** Chứng từ/màn hình liên quan, ví dụ INVOICE, PROCUREMENT_ORDER_GARAGE. FE ánh xạ sang drawer/modal. */
  @Column({
    type: 'varchar',
    length: 50,
    name: 'target_module',
    nullable: true,
  })
  targetModule: string | null;

  /** Id bản ghi. varchar vì có chứng từ dùng uuid, có chứng từ dùng mã. */
  @Column({ type: 'varchar', length: 100, name: 'target_id', nullable: true })
  targetId: string | null;

  /** Hành động khi bấm: VIEW, APPROVE, REJECT. */
  @Column({ type: 'varchar', length: 30, nullable: true })
  action: string | null;
}
