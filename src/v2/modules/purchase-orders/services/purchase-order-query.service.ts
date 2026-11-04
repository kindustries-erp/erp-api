import { Injectable } from '@nestjs/common';
import { DataSource, SelectQueryBuilder } from 'typeorm';
import { TableColumnMap } from '@/common/utils/table-query';
import { AbstractPurchaseOrderQueryService } from '@/v2/core/purchase-orders/services/abstract-purchase-order-query.service';
import { PurchaseOrder } from '../entities/purchase-order.entity';
import { PurchaseOrderLine } from '../entities/purchase-order-line.entity';

/** Truy vấn PO v2: thêm join NCC để có tên nhà cung cấp trong danh sách. */
@Injectable()
export class PurchaseOrderQueryService extends AbstractPurchaseOrderQueryService<
  PurchaseOrder,
  PurchaseOrderLine
> {
  protected readonly target = {
    header: PurchaseOrder,
    line: PurchaseOrderLine,
    lineForeignKey: 'purchaseOrderId',
  };

  constructor(dataSource: DataSource) {
    super(dataSource);
  }

  protected override applyJoins(qb: SelectQueryBuilder<PurchaseOrder>): void {
    qb.leftJoinAndSelect('po.supplier', 'supplier');
  }

  protected override searchFields(): string[] {
    return [...super.searchFields(), 'supplier.name'];
  }

  protected override extraColumns(): TableColumnMap {
    const supplierName = { sql: 'supplier.name', type: 'text' as const };
    return { supplier_name: supplierName, supplierName };
  }
}
