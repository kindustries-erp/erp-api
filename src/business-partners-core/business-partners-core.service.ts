import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { PaginationDto } from '../common/dto/pagination.dto';
import { resolveSortOrder } from '../common/utils/sort.util';
import { ErpBusinessPartner } from './entities/erp_business_partner.entity';
import { CreateBusinessPartnerDto } from './dto/create-business-partner.dto';
import { UpdateBusinessPartnerDto } from './dto/update-business-partner.dto';

@Injectable()
export class BusinessPartnersCoreService {
  constructor(
    @InjectRepository(ErpBusinessPartner)
    private readonly repository: Repository<ErpBusinessPartner>,
  ) {}

  async create(dto: CreateBusinessPartnerDto) {
    const entity = this.repository.create(dto as any);
    const data = await this.repository.save(entity);
    return { message: 'Tạo thành công', data };
  }

  async findAll(query: PaginationDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const baseWhere = query.partnerType
      ? ({ partnerType: query.partnerType, isDeleted: false } as any)
      : ({ isDeleted: false } as any);

    const where = query.search
      ? ([
          { ...baseWhere, name: ILike(`%${query.search}%`) },
          { ...baseWhere, displayName: ILike(`%${query.search}%`) },
          { ...baseWhere, code: ILike(`%${query.search}%`) },
        ] as any)
      : Object.keys(baseWhere).length > 0
        ? baseWhere
        : undefined;

    const order = resolveSortOrder(query.sort, {
      allowedFields: [
        'createdAt',
        'code',
        'name',
        'displayName',
        'partnerType',
      ],
      columnMap: {
        created_at: 'createdAt',
        display_name: 'displayName',
        partner_type: 'partnerType',
      },
      defaultOrder: { createdAt: 'DESC' },
    });

    const [items, total] = await this.repository.findAndCount({
      where,
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

  async findOne(id: string) {
    const data = await this.repository.findOneByOrFail({
      id,
      isDeleted: false,
    });
    return { message: 'Lấy thông tin thành công', data };
  }

  async update(id: string, dto: UpdateBusinessPartnerDto) {
    await this.repository.update(id, dto as any);
    const data = await this.repository.findOneByOrFail({
      id,
      isDeleted: false,
    });
    return { message: 'Cập nhật thành công', data };
  }

  async remove(id: string) {
    const existing = await this.repository.findOneBy({ id });
    if (!existing) {
      throw new NotFoundException(`Business partner ${id} not found`);
    }
    existing.isDeleted = true;
    const data = await this.repository.save(existing);
    return { message: 'Xóa thành công', data };
  }
}
