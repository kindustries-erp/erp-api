import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RbacCoreModule } from '@/v2/core/rbac';
import { ApprovalEvent } from '@/v2/core/approval/entities/approval-event.entity';
import { ApprovalEventService } from '@/v2/core/approval/approval-event.service';
import { ProcurementRequest } from './entities/procurement-request.entity';
import { ProcurementRequestLine } from './entities/procurement-request-line.entity';
import { ErpProcurementRequestController } from './controllers/procurement-request.controller';
import { ErpProcurementRequestsService } from './erp-procurement-requests.service';
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
    ]),
    RbacCoreModule,
  ],
  controllers: [ErpProcurementRequestController],
  providers: [
    ApprovalEventService,
    ProcurementRequestCommandService,
    ProcurementRequestQueryService,
    ErpProcurementRequestsService,
    ProcurementRequestOrderingService,
  ],
  exports: [ProcurementRequestQueryService, ProcurementRequestOrderingService],
})
export class ErpProcurementRequestsModule {}
