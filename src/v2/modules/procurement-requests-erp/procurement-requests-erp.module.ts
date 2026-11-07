import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RbacCoreModule } from '@/v2/core/rbac-core';
import { ApprovalEvent } from '@/v2/core/approval-core/entities/approval-event.entity';
import { ApprovalEventService } from '@/v2/core/approval-core/approval-event.service';
import { ApprovalActorService } from '@/v2/core/approval-core/approval-actor.service';
import { CoreUser } from '@/users/entities/core-user.entity';
import { ProcurementRequest } from './entities/procurement-request.entity';
import { ProcurementRequestLine } from './entities/procurement-request-line.entity';
import { ErpProcurementRequestController } from './controllers/procurement-request.controller';
import { ErpProcurementRequestsService } from './procurement-requests-erp.service';
import { ProcurementRequestCommandService } from './services/procurement-request-command.service';
import { ProcurementRequestQueryService } from './services/procurement-request-query.service';
import { ProcurementRequestOrderingService } from './services/procurement-request-ordering.service';

/** Module đề nghị mua thường (bảng erp_proc_requests). Lõi nằm ở src/v2/core/procurement-requests. */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProcurementRequest,
      ProcurementRequestLine,
      ApprovalEvent,
      CoreUser,
    ]),
    RbacCoreModule,
  ],
  controllers: [ErpProcurementRequestController],
  providers: [
    ApprovalEventService,
    ApprovalActorService,
    ProcurementRequestCommandService,
    ProcurementRequestQueryService,
    ErpProcurementRequestsService,
    ProcurementRequestOrderingService,
  ],
  exports: [ProcurementRequestQueryService, ProcurementRequestOrderingService],
})
export class ErpProcurementRequestsModule {}
