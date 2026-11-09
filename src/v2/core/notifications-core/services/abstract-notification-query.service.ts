import { Repository, SelectQueryBuilder } from 'typeorm';
import type { BaseNotificationEntity } from '../entities/base-notification.entity';
import type { NotificationListFilter } from '../types/notification.types';

/**
 * Truy vấn thông báo nền. Module cụ thể kế thừa và truyền `Repository<T>` của entity mình.
 * Luôn lọc theo `userId` và `isDeleted = false`.
 */
export abstract class AbstractNotificationQueryService<
  T extends BaseNotificationEntity,
> {
  protected constructor(protected readonly repo: Repository<T>) {}

  /** Danh sách thông báo của đúng một user, mới nhất trước. */
  async listForUser(
    userId: string,
    filter: NotificationListFilter,
  ): Promise<{ items: T[]; total: number }> {
    const qb = this.ownedQuery(userId);
    if (filter.unreadOnly) {
      qb.andWhere('n.isRead = :isRead', { isRead: false });
    }
    if (filter.type) {
      qb.andWhere('n.type = :type', { type: filter.type });
    }
    qb.orderBy('n.createdAt', 'DESC')
      .addOrderBy('n.id', 'DESC')
      .skip((filter.page - 1) * filter.pageSize)
      .take(filter.pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  countUnread(userId: string): Promise<number> {
    return this.ownedQuery(userId)
      .andWhere('n.isRead = :isRead', { isRead: false })
      .getCount();
  }

  protected ownedQuery(userId: string): SelectQueryBuilder<T> {
    return this.repo
      .createQueryBuilder('n')
      .where('n.userId = :userId', { userId })
      .andWhere('n.isDeleted = :isDeleted', { isDeleted: false });
  }
}
