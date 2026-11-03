import { Injectable, NotFoundException } from '@nestjs/common';
import { GarageGoodsReceipt } from './entities/garage-goods-receipt.entity';
import { CreateGarageGoodsReceiptDto } from './dto/create-garage-goods-receipt.dto';
import { QueryGarageGoodsReceiptDto } from './dto/query-garage-goods-receipt.dto';
import { UpdateGarageGoodsReceiptDto } from './dto/update-garage-goods-receipt.dto';
import { toGarageGoodsReceiptResponse } from './helpers/garage-goods-receipt.mapper';
import { GarageGoodsReceiptCommandService } from './services/garage-goods-receipt-command.service';
import { GarageGoodsReceiptQueryService } from './services/garage-goods-receipt-query.service';

/** Facade của module: điều phối query/command và luôn trả response DTO, không lộ entity. */
@Injectable()
export class GarageGoodsReceiptsCoreService {
  constructor(
    private readonly query: GarageGoodsReceiptQueryService,
    private readonly command: GarageGoodsReceiptCommandService,
  ) {}

  async findAll(dto: QueryGarageGoodsReceiptDto) {
    const page = await this.query.findAll(dto);
    return {
      items: page.items.map((item) => toGarageGoodsReceiptResponse(item)),
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
      totalPages: Math.ceil(page.total / page.pageSize),
      summaries: page.summaries,
    };
  }

  findColumnOptions(
    column: string,
    search: string | undefined,
    page: number,
    pageSize: number,
    filters?: string,
  ) {
    return this.query.findColumnOptions(
      column,
      search,
      page,
      pageSize,
      filters,
    );
  }

  async getNextCode(date?: string) {
    const nextCode = await this.command.generateDailyReceiptNo(date);
    return { nextCode };
  }

  async findOne(id: string) {
    const entity = await this.requireById(id);
    return {
      message: 'Lấy thông tin thành công',
      data: toGarageGoodsReceiptResponse(entity),
    };
  }

  async create(dto: CreateGarageGoodsReceiptDto) {
    const entity = await this.command.create(dto);
    return {
      message: 'Tạo thành công',
      data: toGarageGoodsReceiptResponse(entity),
    };
  }

  async update(id: string, dto: UpdateGarageGoodsReceiptDto) {
    const entity = await this.requireById(id);
    const saved = await this.command.update(entity, dto);
    return {
      message: 'Cập nhật thành công',
      data: toGarageGoodsReceiptResponse(saved),
    };
  }

  async post(id: string) {
    const entity = await this.requireById(id);
    const saved = await this.command.post(entity);
    return {
      message: 'Ghi sổ nhập kho thành công',
      data: toGarageGoodsReceiptResponse(saved),
    };
  }

  async cancel(id: string) {
    const entity = await this.requireById(id);
    const saved = await this.command.cancel(entity);
    return {
      message: 'Hủy phiếu nhập kho thành công',
      data: toGarageGoodsReceiptResponse(saved),
    };
  }

  async remove(id: string) {
    const entity = await this.requireById(id);
    const saved = await this.command.softDelete(entity);
    return {
      message: 'Xóa thành công',
      data: toGarageGoodsReceiptResponse(saved),
    };
  }

  private async requireById(id: string): Promise<GarageGoodsReceipt> {
    const entity = await this.query.findById(id);
    if (!entity) {
      throw new NotFoundException(
        `Không tìm thấy GarageGoodsReceipt với id ${id}`,
      );
    }
    return entity;
  }
}
