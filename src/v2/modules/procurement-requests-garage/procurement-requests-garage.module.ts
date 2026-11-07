import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RbacCoreModule } from '@/v2/core/rbac-core';
import { ApprovalEvent } from '@/v2/core/approval-core/entities/approval-event.entity';
import { ApprovalEventService } from '@/v2/core/approval-core/approval-event.service';
import { ApprovalActorService } from '@/v2/core/approval-core/approval-actor.service';
import { ApprovalSetting } from '@/v2/core/approval-core/entities/approval-setting.entity';
import { ApprovalSettingsService } from '@/v2/core/approval-core/approval-settings.service';
import { ApproverDirectoryService } from '@/v2/core/approval-core/approver-directory.service';
import { createApprovalConfigController } from '@/v2/core/approval-core/approval-config.controller';
import { CoreUser } from '@/users/entities/core-user.entity';
import { ErpResource } from '@/v2/core/rbac-core';
import { CashflowGarageModule } from '@/v2/modules/cashflow-garage/cashflow-garage.module';
import { GarageProcurementRequest } from './entities/procurement-request.entity';
import { GarageProcurementRequestLine } from './entities/procurement-request-line.entity';
import { GarageProcurementRequestController } from './controllers/procurement-request.controller';
import { GarageProcurementRequestsService } from './procurement-requests-garage.service';
import { GarageProcurementRequestCommandService } from './services/procurement-request-command.service';
import { GarageProcurementRequestQueryService } from './services/procurement-request-query.service';
import { GarageProcurementRequestOrderingService } from './services/garage-procurement-request-ordering.service';

const GarageProcurementRequestApprovalConfigController =
  createApprovalConfigController({
    path: 'api/v2/approval-config/garage-procurement-requests',
    docType: 'GARAGE_PROCUREMENT_REQUEST',
    resource: ErpResource.GARAGE_PROCUREMENT_REQUESTS,
    tag: 'procurement_requests',
  });

/** Module đề nghị mua thường (bảng erp_garage_proc_requests). Lõi nằm ở src/v2/core/procurement-requests. */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      GarageProcurementRequest,
      GarageProcurementRequestLine,
      ApprovalEvent,
      ApprovalSetting,
      CoreUser,
    ]),
    RbacCoreModule,
    CashflowGarageModule,
  ],
  controllers: [
    GarageProcurementRequestController,
    GarageProcurementRequestApprovalConfigController,
  ],
  providers: [
    ApprovalEventService,
    ApprovalActorService,
    ApprovalSettingsService,
    ApproverDirectoryService,
    GarageProcurementRequestCommandService,
    GarageProcurementRequestQueryService,
    GarageProcurementRequestsService,
    GarageProcurementRequestOrderingService,
  ],
  exports: [
    GarageProcurementRequestQueryService,
    GarageProcurementRequestOrderingService,
  ],
})
export class GarageProcurementRequestsModule {}
