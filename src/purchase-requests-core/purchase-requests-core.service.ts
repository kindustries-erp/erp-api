import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { PaginationDto } from '../common/dto/pagination.dto';
import { resolveSortOrder } from '../common/utils/sort.util';
import { ErpPurchaseRequest } from './entities/erp_purchase_request.entity';
import { CreatePurchaseRequestDto } from './dto/create-purchase-request.dto';
import { UpdatePurchaseRequestDto } from './dto/update-purchase-request.dto';

@Injectable()
export class PurchaseRequestsCoreService {
  constructor(
    @InjectRepository(ErpPurchaseRequest)
    private readonly repository: Repository<ErpPurchaseRequest>,
  ) {}

  async create(dto: CreatePurchaseRequestDto) {
    const entity = this.repository.create(dto as any);
    const data = await this.repository.save(entity);
    return { message: 'Tạo thành công', data };
  }

  async findAll(query: PaginationDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const order = resolveSortOrder(query.sort, {
      defaultOrder: { createdAt: 'DESC' },
    });

    const [items, total] = await this.repository.findAndCount({
      where: [
        {
          ...(query.search ? { requestNo: ILike(`%${query.search}%`) } : {}),
          isDeleted: false,
        },
      ] as any,
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
    const data = await this.repository.findOneByOrFail({ id, isDeleted: false });
    return { message: 'Lấy thông tin thành công', data };
  }

  async update(id: string, dto: UpdatePurchaseRequestDto) {
    await this.repository.update(id, dto as any);
    const data = await this.repository.findOneByOrFail({ id, isDeleted: false });
    return { message: 'Cập nhật thành công', data };
  }

  async remove(id: string) {
    const existing = await this.repository.findOne({ where: { id, isDeleted: false } });
    if (!existing) throw new NotFoundException('Không tìm thấy phiếu yêu cầu');
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException('Chỉ có thể xóa phiếu yêu cầu nháp');
    }
    
    await this.repository.update(id, { isDeleted: true } as any);
    return { message: 'Xóa thành công' };
  }

  async cancel(id: string) {
    const existing = await this.repository.findOne({ where: { id, isDeleted: false } });
    if (!existing) throw new NotFoundException('Không tìm thấy phiếu yêu cầu');
    if (existing.status === 'CANCELLED') {
      throw new BadRequestException('Phiếu yêu cầu đã bị hủy');
    }
    if (existing.status === 'DRAFT') {
      throw new BadRequestException('Không thể hủy phiếu nháp, vui lòng xóa');
    }

    existing.status = 'CANCELLED';
    await this.repository.save(existing);

    return {
      message: 'Hủy thành công',
      data: { id },
    };
  }
}
