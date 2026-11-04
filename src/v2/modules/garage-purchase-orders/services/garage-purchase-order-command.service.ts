import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { AbstractPurchaseOrderCommandService } from '@/v2/core/purchase-orders/services/abstract-purchase-order-command.service';
import { PurchaseOrderEngine } from '@/v2/core/purchase-orders/services/purchase-order-engine.service';
import { PurchaseOrderNumberingService } from '@/v2/core/purchase-orders/services/purchase-order-numbering.service';
import { UpdateGaragePurchaseOrderDto } from '../dto/garage-purchase-order.dto';
import { GaragePurchaseOrder } from '../entities/garage-purchase-order.entity';
import { GaragePurchaseOrderLine } from '../entities/garage-purchase-order-line.entity';
import { GARAGE_PO_NUMBER_PREFIX } from '../garage-purchase-orders.constants';

/**
 * Lệnh ghi PO garage (bảng erp_garage_purchase_orders, bảng mới).
 * Khác PO core: có chi nhánh, tên NCC lưu trên phiếu, và tổng tiền lưu cột
 * total_amount (ghi trong onLinesPersisted, cùng transaction với dòng).
 * Chưa nối với phiếu nhập garage (theo phạm vi thay đổi này).
 */
@Injectable()
export class GaragePurchaseOrderCommandService extends AbstractPurchaseOrderCommandService<
  GaragePurchaseOrder,
  GaragePurchaseOrderLine
> {
  protected readonly target = {
    header: GaragePurchaseOrder,
    line: GaragePurchaseOrderLine,
    lineForeignKey: 'garagePurchaseOrderId',
  };
  protected readonly numberPrefix = GARAGE_PO_NUMBER_PREFIX;

  constructor(
    dataSource: DataSource,
    engine: PurchaseOrderEngine,
    numbering: PurchaseOrderNumberingService,
  ) {
    super(dataSource, engine, numbering);
  }

  /** Chỉ đưa vào các trường client thực sự gửi (undefined thì giữ nguyên). */
  protected override extraHeaderFields(
    dto: UpdateGaragePurchaseOrderDto,
  ): Record<string, unknown> {
    const fields: Record<string, unknown> = {};
    if (dto.branchId !== undefined) fields.branchId = dto.branchId ?? null;
    if (dto.branchName !== undefined)
      fields.branchName = dto.branchName ?? null;
    if (dto.supplierName !== undefined) {
      fields.supplierName = dto.supplierName ?? null;
    }
    return fields;
  }

  /** Tổng tiền = tổng amount các dòng (server tính), lưu vào cột total_amount. */
  protected override async onLinesPersisted(
    manager: EntityManager,
    header: GaragePurchaseOrder,
    lines: GaragePurchaseOrderLine[],
  ): Promise<void> {
    const total = this.engine.totalOf(lines).toFixed(2);
    await manager.update(
      GaragePurchaseOrder,
      { id: header.id },
      { totalAmount: total },
    );
  }
}
