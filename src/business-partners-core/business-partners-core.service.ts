import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { PaginationDto } from '../common/dto/pagination.dto';
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
    const [items, total] = await this.repository.findAndCount({
      where: query.search
        ? ([{ name: ILike(`%${query.search}%`) }] as any)
        : undefined,
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { createdAt: 'DESC' },
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
    const data = await this.repository.findOneByOrFail({ id });
    return { message: 'Lấy thông tin thành công', data };
  }

  async update(id: string, dto: UpdateBusinessPartnerDto) {
    await this.repository.update(id, dto as any);
    const data = await this.repository.findOneByOrFail({ id });
    return { message: 'Cập nhật thành công', data };
  }
}
