import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RbacCoreModule } from '@/v2/core/rbac';
import { ApprovalEvent } from '@/v2/core/approval/entities/approval-event.entity';
import { ApprovalEventService } from '@/v2/core/approval/approval-event.service';
import { CoreUser } from '@/users/entities/core-user.entity';
import { GarageProcurementRequestsModule } from '@/v2/modules/garage-procurement-requests/garage-procurement-requests.module';
import { GarageProcurementOrder } from './entities/procurement-order.entity';
import { GarageProcurementOrderLine } from './entities/procurement-order-line.entity';
import { GarageProcurementOrderAcceptance } from './entities/procurement-order-acceptance.entity';
import { GarageProcurementOrderController } from './controllers/procurement-order.controller';
import { GarageProcurementOrdersService } from './garage-procurement-orders.service';
import { GarageProcurementOrderCommandService } from './services/procurement-order-command.service';
import { GarageProcurementOrderFulfilmentService } from './services/procurement-order-fulfilment.service';
import { GarageProcurementOrderQueryService } from './services/procurement-order-query.service';
import {
  GARAGE_PROCUREMENT_REQUEST_LINK,
  GarageProcurementRequestLinkAdapter,
} from './services/garage-procurement-request-link.adapter';

/** Module đơn mua thường (bảng erp_garage_proc_orders). Lõi nằm ở src/v2/core/procurement-orders. */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      GarageProcurementOrder,
      GarageProcurementOrderLine,
      GarageProcurementOrderAcceptance,
      ApprovalEvent,
      CoreUser,
    ]),
    RbacCoreModule,
    GarageProcurementRequestsModule,
  ],
  controllers: [GarageProcurementOrderController],
  providers: [
    ApprovalEventService,
    GarageProcurementRequestLinkAdapter,
    {
      provide: GARAGE_PROCUREMENT_REQUEST_LINK,
      useExisting: GarageProcurementRequestLinkAdapter,
    },
    GarageProcurementOrderCommandService,
    GarageProcurementOrderFulfilmentService,
    GarageProcurementOrderQueryService,
    GarageProcurementOrdersService,
  ],
  exports: [
    GarageProcurementOrdersService,
    GarageProcurementOrderFulfilmentService,
  ],
})
export class GarageProcurementOrdersModule {}
