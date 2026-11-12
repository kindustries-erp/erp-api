import { toPaginatedResult } from '@/common/utils/paginated-result';
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
    const orders = await this.query.findOrderSummaries(
      page.items.map((item) => item.garageProcurementOrderId ?? ''),
    );
    return toPaginatedResult(
      page.items.map((item) =>
        toGarageGoodsReceiptResponse(
          item,
          orders.get(item.garageProcurementOrderId ?? ''),
        ),
      ),
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

  async getNextCode(date?: string) {
    const nextCode = await this.command.generateDailyReceiptNo(date);
    return { nextCode };
  }

  async findOne(id: string) {
    const entity = await this.requireById(id);
    return {
      message: 'Lấy thông tin thành công',
      data: await this.toResponse(entity),
    };
  }

  async create(dto: CreateGarageGoodsReceiptDto) {
    const entity = await this.command.create(dto);
    return {
      message: 'Tạo thành công',
      data: await this.toResponse(entity),
    };
  }

  async update(id: string, dto: UpdateGarageGoodsReceiptDto) {
    const entity = await this.requireById(id);
    const saved = await this.command.update(entity, dto);
    return {
      message: 'Cập nhật thành công',
      data: await this.toResponse(saved),
    };
  }

  /** Tạo phiếu và ghi sổ nhập kho trong một bước (một transaction). */
  async createAndPost(dto: CreateGarageGoodsReceiptDto) {
    const saved = await this.command.saveAndPost(null, dto);
    return {
      message: 'Nhập kho thành công',
      data: await this.toResponse(saved),
    };
  }

  /** Cập nhật phiếu nháp và ghi sổ nhập kho trong một bước. */
  async updateAndPost(id: string, dto: UpdateGarageGoodsReceiptDto) {
    await this.requireById(id);
    const saved = await this.command.saveAndPost(id, dto);
    return {
      message: 'Nhập kho thành công',
      data: await this.toResponse(saved),
    };
  }

  async post(id: string) {
    const entity = await this.requireById(id);
    const saved = await this.command.post(entity);
    return {
      message: 'Ghi sổ nhập kho thành công',
      data: await this.toResponse(saved),
    };
  }

  async cancel(id: string) {
    const entity = await this.requireById(id);
    const saved = await this.command.cancel(entity);
    return {
      message: 'Hủy phiếu nhập kho thành công',
      data: await this.toResponse(saved),
    };
  }

  async remove(id: string) {
    const entity = await this.requireById(id);
    const saved = await this.command.softDelete(entity);
    return {
      message: 'Xóa thành công',
      data: await this.toResponse(saved),
    };
  }

  /** Response của một phiếu kèm số đơn và tổng tiền đơn mua nguồn. */
  private async toResponse(entity: GarageGoodsReceipt) {
    const orders = await this.query.findOrderSummaries([
      entity.garageProcurementOrderId ?? '',
    ]);
    const response = toGarageGoodsReceiptResponse(
      entity,
      orders.get(entity.garageProcurementOrderId ?? ''),
    );
    if (entity.status === 'POSTED') {
      const reason = await this.query.findReverseBlockedReason(entity);
      response.reversible = reason === null;
      response.reverseBlockedReason = reason ?? undefined;
    }
    return response;
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
