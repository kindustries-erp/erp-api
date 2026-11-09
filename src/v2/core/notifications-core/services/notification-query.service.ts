import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { NotificationCore } from '../entities/notification.entity';
import type { NotificationListFilter } from '../types/notification.types';

@Injectable()
export class NotificationQueryService {
  constructor(
    @InjectRepository(NotificationCore)
    private readonly repo: Repository<NotificationCore>,
  ) {}

  /** Danh sách thông báo của đúng một user, mới nhất trước. Luôn lọc `userId` và `isDeleted`. */
  async listForUser(
    userId: string,
    filter: NotificationListFilter,
  ): Promise<{ items: NotificationCore[]; total: number }> {
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

  private ownedQuery(userId: string): SelectQueryBuilder<NotificationCore> {
    return this.repo
      .createQueryBuilder('n')
      .where('n.userId = :userId', { userId })
      .andWhere('n.isDeleted = :isDeleted', { isDeleted: false });
  }
}
