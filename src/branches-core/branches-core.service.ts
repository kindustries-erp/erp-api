import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { PaginationDto } from '../common/dto/pagination.dto';
import { resolveSortOrder } from '../common/utils/sort.util';
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
    const order = resolveSortOrder(query.sort, {
      allowedFields: ['createdAt', 'code', 'name'],
      columnMap: {
        created_at: 'createdAt',
      },
      defaultOrder: { createdAt: 'DESC' },
    });

    const [items, total] = await this.repository.findAndCount({
      where: query.search
        ? ([
            { code: ILike(`%${query.search}%`) },
            { name: ILike(`%${query.search}%`) },
          ] as any)
        : undefined,
      skip: (page - 1) * pageSize,
      take: pageSize,
      order,
    });

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async create(data: any) {
    const item = this.repository.create({
      code: data.code,
      name: data.name,
      isActive: data.is_active,
    });
    const saved = await this.repository.save(item);
    return { data: saved, message: 'Branch created successfully' };
  }

  async update(id: string, data: any) {
    await this.repository.update(id, {
      code: data.code,
      name: data.name,
      isActive: data.is_active,
    });
    const updated = await this.repository.findOne({ where: { id } });
    return { data: updated, message: 'Branch updated successfully' };
  }

  async remove(id: string) {
    await this.repository.delete(id);
    return { message: 'Branch deleted successfully' };
  }
}
