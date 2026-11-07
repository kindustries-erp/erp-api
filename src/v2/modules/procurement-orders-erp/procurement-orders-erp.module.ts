import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RbacCoreModule } from '@/v2/core/rbac-core';
import { ApprovalEvent } from '@/v2/core/approval-core/entities/approval-event.entity';
import { ApprovalEventService } from '@/v2/core/approval-core/approval-event.service';
import { ApprovalActorService } from '@/v2/core/approval-core/approval-actor.service';
import { CoreUser } from '@/users/entities/core-user.entity';
import { ErpProcurementRequestsModule } from '@/v2/modules/procurement-requests-erp/procurement-requests-erp.module';
import { ProcurementOrder } from './entities/procurement-order.entity';
import { ProcurementOrderLine } from './entities/procurement-order-line.entity';
import { ProcurementOrderAcceptance } from './entities/procurement-order-acceptance.entity';
import { ErpProcurementOrderController } from './controllers/procurement-order.controller';
import { ErpProcurementOrdersService } from './procurement-orders-erp.service';
import { ProcurementOrderCommandService } from './services/procurement-order-command.service';
import { ProcurementOrderFulfilmentService } from './services/procurement-order-fulfilment.service';
import { ProcurementOrderQueryService } from './services/procurement-order-query.service';
import {
  PROCUREMENT_REQUEST_LINK,
  ProcurementRequestLinkAdapter,
} from './services/procurement-request-link.adapter';

/** Module đơn mua thường (bảng erp_proc_orders). Lõi nằm ở src/v2/core/procurement-orders. */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProcurementOrder,
      ProcurementOrderLine,
      ProcurementOrderAcceptance,
      ApprovalEvent,
      CoreUser,
    ]),
    RbacCoreModule,
    ErpProcurementRequestsModule,
  ],
  controllers: [ErpProcurementOrderController],
  providers: [
    ApprovalEventService,
    ApprovalActorService,
    ProcurementRequestLinkAdapter,
    {
      provide: PROCUREMENT_REQUEST_LINK,
      useExisting: ProcurementRequestLinkAdapter,
    },
    ProcurementOrderCommandService,
    ProcurementOrderFulfilmentService,
    ProcurementOrderQueryService,
    ErpProcurementOrdersService,
  ],
  exports: [ErpProcurementOrdersService],
})
export class ErpProcurementOrdersModule {}
