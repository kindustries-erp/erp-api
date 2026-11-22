import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { resolveSortOrder } from '@/common/utils/sort.util';
import { BaseBranchEntity } from '../entities/base-branch.entity';

/** Truy vấn danh sách chi nhánh: chỉ bản ghi chưa xóa mềm. Module cung cấp repository. */
export abstract class AbstractBranchQueryService<
  TBranch extends BaseBranchEntity,
> {
  protected abstract readonly repository: Repository<TBranch>;

  async findAll(query: PaginationDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const order = resolveSortOrder(query.sort, {
      allowedFields: ['createdAt', 'code', 'name'],
      columnMap: { created_at: 'createdAt' },
      defaultOrder: { createdAt: 'DESC' },
    });

    const live = { isDeleted: false } as FindOptionsWhere<TBranch>;
    const where: FindOptionsWhere<TBranch>[] = query.search
      ? [
          { ...live, code: ILike(`%${query.search}%`) },
          { ...live, name: ILike(`%${query.search}%`) },
        ]
      : [live];

    const [items, total] = await this.repository.findAndCount({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: order as never,
    });

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
