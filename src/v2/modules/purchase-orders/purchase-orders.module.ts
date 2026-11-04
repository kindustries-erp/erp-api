import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErpGoodsReceipt } from '@/goods-receipts-core/entities/erp_goods_receipt.entity';
import { ErpGoodsReceiptLine } from '@/goods-receipts-core/entities/erp_goods_receipt_line.entity';
import { ErpInvoice } from '@/erp-invoices-core/entities/erp_invoice.entity';
import { ErpBusinessPartner } from '@/v2/business-partners-core/entities/erp_business_partner.entity';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { PurchaseOrderLine } from './entities/purchase-order-line.entity';
import { PurchaseOrdersCoreModule } from '@/v2/core/purchase-orders/purchase-orders-core.module';
import { PurchaseOrderController } from './controllers/purchase-order.controller';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseOrderCommandService } from './services/purchase-order-command.service';
import { PurchaseOrderLinksService } from './services/purchase-order-links.service';
import { PurchaseOrderQueryService } from './services/purchase-order-query.service';

/**
 * Module PO v2 trên bảng erp_purchase_orders, chạy song song với v1
 * (/api/v1/purchase-orders). Lõi nghiệp vụ lấy từ PurchaseOrdersCoreModule.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PurchaseOrder,
      PurchaseOrderLine,
      ErpGoodsReceipt,
      ErpGoodsReceiptLine,
      ErpInvoice,
      ErpBusinessPartner,
    ]),
    PurchaseOrdersCoreModule,
  ],
  controllers: [PurchaseOrderController],
  providers: [
    PurchaseOrderCommandService,
    PurchaseOrderQueryService,
    PurchaseOrderLinksService,
    PurchaseOrdersService,
  ],
  exports: [PurchaseOrdersService],
})
export class PurchaseOrdersModule {}
