import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { toPurchaseOrderResponse } from '@/v2/core/purchase-orders/helpers/purchase-order.mapper';
import { PurchaseOrderNumberingService } from '@/v2/core/purchase-orders/services/purchase-order-numbering.service';
import { BaseQueryPurchaseOrderDto } from '@/v2/core/purchase-orders/dto';
import {
  CreatePurchaseOrderDto,
  QueryPurchaseOrderColumnOptionsDto,
  UpdatePurchaseOrderDto,
} from './dto/purchase-order.dto';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { PO_NUMBER_PREFIX } from './purchase-orders.constants';
import { PurchaseOrderCommandService } from './services/purchase-order-command.service';
import { PurchaseOrderLinksService } from './services/purchase-order-links.service';
import { PurchaseOrderQueryService } from './services/purchase-order-query.service';

/**
 * Facade PO v2: ghép lệnh, truy vấn và liên kết, rồi trả response
 * theo khuôn { message, data } như các module v2 khác.
 */
@Injectable()
export class PurchaseOrdersService {
  constructor(
    private readonly commands: PurchaseOrderCommandService,
    private readonly queries: PurchaseOrderQueryService,
    private readonly links: PurchaseOrderLinksService,
    private readonly numbering: PurchaseOrderNumberingService,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreatePurchaseOrderDto, userId: string | null) {
    const { id } = await this.commands.create(dto, userId);
    return {
      message: 'Tạo đơn mua hàng thành công',
      data: await this.detail(id),
    };
  }

  async update(id: string, dto: UpdatePurchaseOrderDto) {
    await this.commands.update(id, dto);
    return {
      message: 'Cập nhật đơn mua hàng thành công',
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
        toPurchaseOrderResponse(item.header, item.lines),
      ),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
      summaries: result.summaries,
    };
  }

  columnOptions(query: QueryPurchaseOrderColumnOptionsDto) {
    return this.queries.columnOptions(query.column, query, {
      search: query.option_search,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
    });
  }

  /** Xem trước số PO kế tiếp; không giữ số (khóa chỉ trong transaction này). */
  async nextNo(date?: string) {
    const nextNo = await this.dataSource.transaction((manager) =>
      this.numbering.nextNo(manager, PurchaseOrder, PO_NUMBER_PREFIX, date),
    );
    return { nextNo };
  }

  async remove(id: string) {
    await this.commands.softDelete(id);
    return { message: 'Xóa đơn mua hàng thành công', data: { id } };
  }

  async approve(id: string) {
    const data = await this.commands.approve(id);
    return { message: 'Duyệt đơn mua hàng thành công', data };
  }

  async confirm(id: string) {
    const data = await this.commands.confirm(id);
    return { message: 'Xác nhận đơn mua hàng thành công', data };
  }

  async cancel(id: string) {
    const data = await this.commands.cancel(id);
    return { message: 'Hủy đơn mua hàng thành công', data };
  }

  receipts(id: string) {
    return this.links.getReceipts(id);
  }

  connections(id: string) {
    return this.links.getConnections(id);
  }

  invoices(id: string) {
    return this.links.getLinkedInvoices(id);
  }

  linkInvoices(id: string, invoiceIds: string[]) {
    return this.links.linkInvoices(id, invoiceIds);
  }

  unlinkInvoice(id: string, invoiceId: string) {
    return this.links.unlinkInvoice(id, invoiceId);
  }

  private async detail(id: string) {
    const { header, lines } = await this.queries.findOne(id);
    return toPurchaseOrderResponse(header, lines);
  }
}
