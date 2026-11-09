import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErpResource, RbacCoreModule } from '@/v2/core/rbac-core';
import { ApprovalEvent } from '@/v2/core/approval-core/entities/approval-event.entity';
import { ApprovalEventService } from '@/v2/core/approval-core/approval-event.service';
import { ApprovalActorService } from '@/v2/core/approval-core/approval-actor.service';
import { ApprovalSetting } from '@/v2/core/approval-core/entities/approval-setting.entity';
import { ApprovalSettingsService } from '@/v2/core/approval-core/approval-settings.service';
import { ApproverDirectoryService } from '@/v2/core/approval-core/approver-directory.service';
import { createApprovalConfigController } from '@/v2/core/approval-core/approval-config.controller';
import { CoreUser } from '@/users/entities/core-user.entity';
import { GarageProcurementRequestsModule } from '@/v2/modules/procurement-requests-garage/procurement-requests-garage.module';
import { GarageProcurementOrder } from './entities/procurement-order.entity';
import { GarageProcurementOrderLine } from './entities/procurement-order-line.entity';
import { GarageProcurementOrderAcceptance } from './entities/procurement-order-acceptance.entity';
import { GarageProcurementOrderController } from './controllers/procurement-order.controller';
import { GarageProcurementOrdersService } from './procurement-orders-garage.service';
import { GarageProcurementOrderCommandService } from './services/procurement-order-command.service';
import { GarageProcurementOrderFulfilmentService } from './services/procurement-order-fulfilment.service';
import { GarageProcurementOrderQueryService } from './services/procurement-order-query.service';
import {
  GARAGE_PROCUREMENT_REQUEST_LINK,
  GarageProcurementRequestLinkAdapter,
} from './services/garage-procurement-request-link.adapter';

const GarageProcurementOrderApprovalConfigController =
  createApprovalConfigController({
    path: 'api/v2/approval-config/garage-procurement-orders',
    docType: 'GARAGE_PROCUREMENT_ORDER',
    resource: ErpResource.GARAGE_PROCUREMENT_ORDERS,
    tag: 'procurement_orders',
  });

/** Module đơn mua thường (bảng proc_orders_garage). Lõi nằm ở src/v2/core/procurement-orders. */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      GarageProcurementOrder,
      GarageProcurementOrderLine,
      GarageProcurementOrderAcceptance,
      ApprovalEvent,
      ApprovalSetting,
      CoreUser,
    ]),
    RbacCoreModule,
    GarageProcurementRequestsModule,
  ],
  controllers: [
    GarageProcurementOrderController,
    GarageProcurementOrderApprovalConfigController,
  ],
  providers: [
    ApprovalEventService,
    ApprovalActorService,
    ApprovalSettingsService,
    ApproverDirectoryService,
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
