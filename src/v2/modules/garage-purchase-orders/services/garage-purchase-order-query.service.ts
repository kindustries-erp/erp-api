import { Injectable } from '@nestjs/common';
import { DataSource, SelectQueryBuilder } from 'typeorm';
import { TableColumnMap } from '@/common/utils/table-query';
import { BaseQueryPurchaseOrderDto } from '@/v2/core/purchase-orders/dto';
import { AbstractPurchaseOrderQueryService } from '@/v2/core/purchase-orders/services/abstract-purchase-order-query.service';
import { QueryGaragePurchaseOrdersDto } from '../dto/garage-purchase-order.dto';
import { GaragePurchaseOrder } from '../entities/garage-purchase-order.entity';
import { GaragePurchaseOrderLine } from '../entities/garage-purchase-order-line.entity';

/**
 * Truy vấn PO garage. Tổng tiền đọc từ cột total_amount đã lưu, không tính lại
 * từ dòng. Tên chi nhánh và NCC nằm trên phiếu nên không cần join.
 */
@Injectable()
export class GaragePurchaseOrderQueryService extends AbstractPurchaseOrderQueryService<
  GaragePurchaseOrder,
  GaragePurchaseOrderLine
> {
  protected readonly target = {
    header: GaragePurchaseOrder,
    line: GaragePurchaseOrderLine,
    lineForeignKey: 'garagePurchaseOrderId',
  };

  constructor(dataSource: DataSource) {
    super(dataSource);
  }

  protected override totalSql(): string {
    return 'po.total_amount';
  }

  protected override searchFields(): string[] {
    return [...super.searchFields(), 'po.branch_name', 'po.supplier_name'];
  }

  protected override extraColumns(): TableColumnMap {
    const branchName = { sql: 'po.branch_name', type: 'text' as const };
    const supplierName = { sql: 'po.supplier_name', type: 'text' as const };
    return {
      branch_name: branchName,
      branchName,
      supplier_name: supplierName,
      supplierName,
    };
  }

  protected override applyExtraFilters(
    qb: SelectQueryBuilder<GaragePurchaseOrder>,
    query: BaseQueryPurchaseOrderDto,
  ): void {
    const branchId = (query as QueryGaragePurchaseOrdersDto).branch_id;
    if (branchId) {
      qb.andWhere('po.branch_id = :branchId', { branchId });
    }
  }
}
