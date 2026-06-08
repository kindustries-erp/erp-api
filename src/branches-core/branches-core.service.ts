import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ErpBranch } from './entities/erp_branch.entity';

@Injectable()
export class BranchesCoreService {
  constructor(
    @InjectRepository(ErpBranch)
    private readonly repository: Repository<ErpBranch>,
  ) {}

  async findAll(query: PaginationDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const orderField = query.sort?.startsWith('-') ? query.sort.slice(1) : query.sort;
    const orderDirection = query.sort?.startsWith('-') ? 'DESC' : 'ASC';

    const [items, total] = await this.repository.findAndCount({
      where: query.search
        ? ([
            { code: ILike(`%${query.search}%`) },
            { name: ILike(`%${query.search}%`) },
          ] as any)
        : undefined,
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: orderField
        ? ({ [orderField]: orderDirection } as any)
        : { code: 'ASC' },
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
