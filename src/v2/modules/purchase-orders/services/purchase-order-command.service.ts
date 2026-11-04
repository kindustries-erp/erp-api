import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DocumentDependenciesCoreService } from '@/document-dependencies-core/document-dependencies-core.service';
import { AbstractPurchaseOrderCommandService } from '@/v2/core/purchase-orders/services/abstract-purchase-order-command.service';
import { PurchaseOrderEngine } from '@/v2/core/purchase-orders/services/purchase-order-engine.service';
import { PurchaseOrderNumberingService } from '@/v2/core/purchase-orders/services/purchase-order-numbering.service';
import { PurchaseOrder } from '../entities/purchase-order.entity';
import { PurchaseOrderLine } from '../entities/purchase-order-line.entity';
import { PO_NUMBER_PREFIX } from '../purchase-orders.constants';

/**
 * Lệnh ghi PO v2 trên bảng erp_purchase_orders (dùng chung với v1).
 * Luật chung nằm ở lõi; ở đây chỉ khai báo bảng và kiểm tra phụ thuộc khi hủy.
 */
@Injectable()
export class PurchaseOrderCommandService extends AbstractPurchaseOrderCommandService<
  PurchaseOrder,
  PurchaseOrderLine
> {
  protected readonly target = {
    header: PurchaseOrder,
    line: PurchaseOrderLine,
    lineForeignKey: 'purchaseOrderId',
  };
  protected readonly numberPrefix = PO_NUMBER_PREFIX;

  constructor(
    dataSource: DataSource,
    engine: PurchaseOrderEngine,
    numbering: PurchaseOrderNumberingService,
    private readonly dependencies: DocumentDependenciesCoreService,
  ) {
    super(dataSource, engine, numbering);
  }

  /** Không hủy khi đã có phiếu nhập hoặc hóa đơn liên kết (như v1). */
  protected override async assertCanCancel(
    header: PurchaseOrder,
  ): Promise<void> {
    await this.dependencies.checkDependencies('purchase_orders', header.id);
  }
}
