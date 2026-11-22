import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalManagementModule } from '@/v2/modules/approval-management/approval-management.module';
import { ErpResource, RbacCoreModule } from '@/v2/core/rbac-core';
import { createApprovalConfigController } from '@/v2/modules/approval-management/controllers/approval-config.controller';
import { UsersManagement } from '@/v2/modules/users-management/entities/users-management.entity';
import { GarageProcurementRequestsModule } from '@/v2/modules/procurement-requests-garage/procurement-requests-garage.module';
import { GarageProcurementRequest } from '@/v2/modules/procurement-requests-garage/entities/procurement-request.entity';
import { GarageProcurementOrderRequestRefService } from './services/garage-procurement-order-request-ref.service';
import { GarageProcurementOrder } from './entities/procurement-order.entity';
import { GarageProcurementOrderLine } from './entities/procurement-order-line.entity';
import { GarageProcurementOrderAcceptance } from './entities/procurement-order-acceptance.entity';
import { GarageProcurementOrderController } from './controllers/procurement-order.controller';
import { GarageProcurementOrdersService } from './procurement-orders-garage.service';
import { GarageProcurementOrderCommandService } from './services/procurement-order-command.service';
import { GarageProcurementOrderFulfilmentService } from './services/procurement-order-fulfilment.service';
import { GarageProcurementOrderFlowService } from './services/garage-procurement-order-flow.service';
import { GarageProcurementOrderQueryService } from './services/procurement-order-query.service';
import {
  GARAGE_PROCUREMENT_REQUEST_LINK,
  GarageProcurementRequestLinkAdapter,
} from './services/garage-procurement-request-link.adapter';
import { ItemsGarageModule } from '@/v2/modules/items-garage/items-garage.module';

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
      GarageProcurementRequest,
      UsersManagement,
    ]),
    RbacCoreModule,
    ApprovalManagementModule,
    ItemsGarageModule,
    GarageProcurementRequestsModule,
  ],
  controllers: [
    GarageProcurementOrderController,
    GarageProcurementOrderApprovalConfigController,
  ],
  providers: [
    GarageProcurementRequestLinkAdapter,
    GarageProcurementOrderRequestRefService,
    {
      provide: GARAGE_PROCUREMENT_REQUEST_LINK,
      useExisting: GarageProcurementRequestLinkAdapter,
    },
    GarageProcurementOrderCommandService,
    GarageProcurementOrderFlowService,
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
