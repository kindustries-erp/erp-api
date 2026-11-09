import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CoreUserTablePreference } from '../entities/core-user-table-preference.entity';
import { escapeLikePattern } from '../helpers/table-preference-like.helper';

@Injectable()
export class TablePreferenceQueryService {
  constructor(
    @InjectRepository(CoreUserTablePreference)
    private readonly repo: Repository<CoreUserTablePreference>,
  ) {}

  /** Các cấu hình bảng của user, tùy chọn lọc theo tiền tố tableId */
  listForUser(
    userId: string,
    tableIdPrefix?: string,
  ): Promise<CoreUserTablePreference[]> {
    const qb = this.repo
      .createQueryBuilder('t')
      .where('t.userId = :userId', { userId })
      .orderBy('t.tableId', 'ASC');

    if (tableIdPrefix) {
      // ESCAPE '\' trong SQL chuẩn (standard_conforming_strings)
      qb.andWhere("t.tableId LIKE :prefix ESCAPE '\\'", {
        prefix: `${escapeLikePattern(tableIdPrefix)}%`,
      });
    }

    return qb.getMany();
  }

  findOneForUser(
    userId: string,
    tableId: string,
  ): Promise<CoreUserTablePreference | null> {
    return this.repo.findOne({ where: { userId, tableId } });
  }
}
