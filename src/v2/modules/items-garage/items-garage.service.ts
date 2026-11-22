import { Injectable, NotFoundException } from '@nestjs/common';
import { toPaginatedResult } from '@/common/utils/paginated-result';
import { GarageItem } from './entities/garage-item.entity';
import { CreateGarageItemDto } from './dto/create-garage-item.dto';
import { QueryGarageItemDto } from './dto/query-garage-item.dto';
import { UpdateGarageItemDto } from './dto/update-garage-item.dto';
import { toGarageItemResponse } from './helpers/garage-item.mapper';
import { GarageItemCommandService } from './services/garage-item-command.service';
import { GarageItemQueryService } from './services/garage-item-query.service';

/** Facade của module: điều phối query/command và luôn trả response DTO, không lộ entity. */
@Injectable()
export class ItemsGarageService {
  constructor(
    private readonly query: GarageItemQueryService,
    private readonly command: GarageItemCommandService,
  ) {}

  async findAll(dto: QueryGarageItemDto) {
    const page = await this.query.findAll(dto);
    return toPaginatedResult(
      page.items.map((item) => toGarageItemResponse(item)),
      page.page,
      page.pageSize,
      page.total,
      page.summaries,
    );
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

  async findOne(id: string) {
    const entity = await this.requireById(id);
    return {
      message: 'Lấy thông tin thành công',
      data: toGarageItemResponse(entity),
    };
  }

  async create(dto: CreateGarageItemDto) {
    const entity = await this.command.create(dto);
    return { message: 'Tạo thành công', data: toGarageItemResponse(entity) };
  }

  async update(id: string, dto: UpdateGarageItemDto) {
    const entity = await this.requireById(id);
    const saved = await this.command.update(entity, dto);
    return {
      message: 'Cập nhật thành công',
      data: toGarageItemResponse(saved),
    };
  }

  async remove(id: string) {
    const entity = await this.requireById(id);
    const saved = await this.command.softDelete(entity);
    return { message: 'Xóa thành công', data: toGarageItemResponse(saved) };
  }

  private async requireById(id: string): Promise<GarageItem> {
    const entity = await this.query.findById(id);
    if (!entity) {
      throw new NotFoundException(`Không tìm thấy GarageItem với id ${id}`);
    }
    return entity;
  }
}
