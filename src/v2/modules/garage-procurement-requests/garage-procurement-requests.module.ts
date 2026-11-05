import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RbacCoreModule } from '@/v2/core/rbac';
import { ApprovalEvent } from '@/v2/core/approval/entities/approval-event.entity';
import { ApprovalEventService } from '@/v2/core/approval/approval-event.service';
import { GarageProcurementRequest } from './entities/procurement-request.entity';
import { GarageProcurementRequestLine } from './entities/procurement-request-line.entity';
import { GarageProcurementRequestController } from './controllers/procurement-request.controller';
import { GarageProcurementRequestsService } from './garage-procurement-requests.service';
import { GarageProcurementRequestCommandService } from './services/procurement-request-command.service';
import { GarageProcurementRequestQueryService } from './services/procurement-request-query.service';
import { GarageProcurementRequestOrderingService } from './services/garage-procurement-request-ordering.service';

/** Module đề nghị mua thường (bảng erp_garage_proc_requests). Lõi nằm ở src/v2/core/procurement-requests. */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      GarageProcurementRequest,
      GarageProcurementRequestLine,
      ApprovalEvent,
    ]),
    RbacCoreModule,
  ],
  controllers: [GarageProcurementRequestController],
  providers: [
    ApprovalEventService,
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
