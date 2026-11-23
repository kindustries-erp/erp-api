import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalManagementModule } from '@/v2/modules/approval-management/approval-management.module';
import { createApprovalConfigController } from '@/v2/modules/approval-management/controllers/approval-config.controller';
import { UsersManagement } from '@/v2/modules/users-management/entities/users-management.entity';
import { ErpResource } from '@/v2/core/rbac-core';
import { GarageProcurementRequest } from './entities/procurement-request.entity';
import { GarageProcurementRequestLine } from './entities/procurement-request-line.entity';
import { GarageProcurementRequestController } from './controllers/procurement-request.controller';
import { GarageProcurementRequestWorkflowController } from './controllers/procurement-request-workflow.controller';
import { GarageProcurementRequestsService } from './procurement-requests-garage.service';
import { GarageProcurementRequestCommandService } from './services/procurement-request-command.service';
import { GarageProcurementRequestFlowService } from './services/garage-procurement-request-flow.service';
import { GarageProcurementRequestQueryService } from './services/procurement-request-query.service';
import { GarageProcurementRequestOrderingService } from './services/garage-procurement-request-ordering.service';
import { ProcurementRequestNotifierService } from './services/procurement-request-notifier.service';
import { NotificationsInboxModule } from '@/v2/modules/notifications-inbox/notifications-inbox.module';
import { GarageProcurementOrder } from '@/v2/modules/procurement-orders-garage/entities/procurement-order.entity';
import { GarageProcurementRequestOrderRefService } from './services/garage-procurement-request-order-ref.service';
import { ItemsGarageModule } from '@/v2/modules/items-garage/items-garage.module';
import { BranchManagement } from '@/v2/modules/branches-management/entities/branch-management.entity';
import { ProcurementRequestBranchLinkSource } from './link-sources/branch.link-source';
import { ProcurementRequestLinkEngine } from './services/procurement-request-link.engine';

const GarageProcurementRequestApprovalConfigController =
  createApprovalConfigController({
    path: 'api/v2/approval-config/garage-procurement-requests',
    docType: 'GARAGE_PROCUREMENT_REQUEST',
    resource: ErpResource.GARAGE_PROCUREMENT_REQUESTS,
    tag: 'procurement_requests',
  });

/** Module đề nghị mua thường (bảng proc_requests_garage). Lõi nằm ở src/v2/core/procurement-requests. */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      GarageProcurementRequest,
      GarageProcurementRequestLine,
      GarageProcurementOrder,
      UsersManagement,
      BranchManagement,
    ]),
    ApprovalManagementModule,
    NotificationsInboxModule,
    ItemsGarageModule,
  ],
  controllers: [
    GarageProcurementRequestController,
    GarageProcurementRequestWorkflowController,
    GarageProcurementRequestApprovalConfigController,
  ],
  providers: [
    GarageProcurementRequestCommandService,
    GarageProcurementRequestFlowService,
    GarageProcurementRequestQueryService,
    GarageProcurementRequestsService,
    GarageProcurementRequestOrderingService,
    ProcurementRequestNotifierService,
    GarageProcurementRequestOrderRefService,
    ProcurementRequestBranchLinkSource,
    ProcurementRequestLinkEngine,
  ],
  exports: [
    GarageProcurementRequestCommandService,
    GarageProcurementRequestQueryService,
    GarageProcurementRequestOrderingService,
  ],
})
export class GarageProcurementRequestsModule {}
