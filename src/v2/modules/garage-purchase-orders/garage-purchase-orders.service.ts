import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BaseQueryPurchaseOrderDto } from '@/v2/core/purchase-orders/dto';
import { toPurchaseOrderResponse } from '@/v2/core/purchase-orders/helpers/purchase-order.mapper';
import { PurchaseOrderNumberingService } from '@/v2/core/purchase-orders/services/purchase-order-numbering.service';
import {
  CreateGaragePurchaseOrderDto,
  QueryGaragePurchaseOrderColumnOptionsDto,
  UpdateGaragePurchaseOrderDto,
} from './dto/garage-purchase-order.dto';
import { GaragePurchaseOrder } from './entities/garage-purchase-order.entity';
import { GaragePurchaseOrderLine } from './entities/garage-purchase-order-line.entity';
import { GARAGE_PO_NUMBER_PREFIX } from './garage-purchase-orders.constants';
import { GaragePurchaseOrderCommandService } from './services/garage-purchase-order-command.service';
import { GaragePurchaseOrderQueryService } from './services/garage-purchase-order-query.service';

/** Facade PO garage: ghép lệnh và truy vấn, trả { message, data } như module PO. */
@Injectable()
export class GaragePurchaseOrdersService {
  constructor(
    private readonly commands: GaragePurchaseOrderCommandService,
    private readonly queries: GaragePurchaseOrderQueryService,
    private readonly numbering: PurchaseOrderNumberingService,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateGaragePurchaseOrderDto, userId: string | null) {
    const { id } = await this.commands.create(dto, userId);
    return {
      message: 'Tạo đơn mua hàng garage thành công',
      data: await this.detail(id),
    };
  }

  async update(id: string, dto: UpdateGaragePurchaseOrderDto) {
    await this.commands.update(id, dto);
    return {
      message: 'Cập nhật đơn mua hàng garage thành công',
      data: await this.detail(id),
    };
  }

  async findOne(id: string) {
    return { message: 'Lấy thông tin thành công', data: await this.detail(id) };
  }

  async list(query: BaseQueryPurchaseOrderDto) {
    const result = await this.queries.list(query);
    return {
      items: result.items.map((item) =>
        this.toResponse(item.header, item.lines),
      ),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
      summaries: result.summaries,
    };
  }

  columnOptions(query: QueryGaragePurchaseOrderColumnOptionsDto) {
    return this.queries.columnOptions(query.column, query, {
      search: query.option_search,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
    });
  }

  async nextNo(date?: string) {
    const nextNo = await this.dataSource.transaction((manager) =>
      this.numbering.nextNo(
        manager,
        GaragePurchaseOrder,
        GARAGE_PO_NUMBER_PREFIX,
        date,
      ),
    );
    return { nextNo };
  }

  async remove(id: string) {
    await this.commands.softDelete(id);
    return { message: 'Xóa đơn mua hàng garage thành công', data: { id } };
  }

  async approve(id: string) {
    return {
      message: 'Duyệt đơn mua hàng garage thành công',
      data: await this.commands.approve(id),
    };
  }

  async confirm(id: string) {
    return {
      message: 'Xác nhận đơn mua hàng garage thành công',
      data: await this.commands.confirm(id),
    };
  }

  async cancel(id: string) {
    return {
      message: 'Hủy đơn mua hàng garage thành công',
      data: await this.commands.cancel(id),
    };
  }

  private async detail(id: string) {
    const { header, lines } = await this.queries.findOne(id);
    return this.toResponse(header, lines);
  }

  /** Khuôn chung của PO + trường riêng garage (chi nhánh). Tổng lấy từ cột đã lưu. */
  private toResponse(
    header: GaragePurchaseOrder,
    lines: GaragePurchaseOrderLine[],
  ) {
    return {
      ...toPurchaseOrderResponse(header, lines, {
        totalAmount: Number(header.totalAmount),
      }),
      branchId: header.branchId,
      branchName: header.branchName,
    };
  }
}
