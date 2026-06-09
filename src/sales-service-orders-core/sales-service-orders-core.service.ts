import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ErpSalesOrder } from '../sales-orders-core/entities/erp_sales_order.entity';

/**
 * SalesServiceOrdersCoreService
 * Compatibility bridge: exposes /api/v1/sales-service-orders
 * mapping onto erp_sales_orders (same table, different presentation).
 * The FE's OperationalDocument shape is approximated from the SO fields.
 */
@Injectable()
export class SalesServiceOrdersCoreService {
  constructor(
    @InjectRepository(ErpSalesOrder)
    private readonly repository: Repository<ErpSalesOrder>,
  ) {}

  async findAll(query: PaginationDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    // resolve sort: e.g. "-document_date" -> order by created_at DESC (alias)
    const rawSort = Array.isArray(query.sort)
      ? (query.sort as string[]).join(',')
      : (query.sort ?? '-created_at');

    const sortField = rawSort.startsWith('-') ? rawSort.slice(1) : rawSort;
    const sortDir = rawSort.startsWith('-') ? 'DESC' : 'ASC';

    // map document_date alias -> orderDate
    const colMap: Record<string, string> = {
      document_date: 'orderDate',
      created_at: 'createdAt',
      order_date: 'orderDate',
    };
    const resolvedField = colMap[sortField] ?? 'createdAt';

    const [rows, total] = await this.repository.findAndCount({
      where: query.search
        ? ([{ soNo: ILike(`%${query.search}%`) }] as any)
        : undefined,
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { [resolvedField]: sortDir } as any,
    });

    // Shape to OperationalDocument-compatible response
    const items = rows.map((r) => ({
      id: r.id,
      order_no: r.soNo,
      document_type: 'sales_service_orders',
      customer_id: r.customerId,
      document_date: r.orderDate,
      status: r.status,
      invoice_status: 'N/A',
      payment_status: 'N/A',
      accounting_status: 'N/A',
      total_amount: 0,
      settled_amount: 0,
      open_amount: 0,
      notes: r.remarks,
    }));

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
