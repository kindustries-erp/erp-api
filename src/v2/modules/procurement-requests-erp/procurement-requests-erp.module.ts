import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalManagementModule } from '@/v2/modules/approval-management/approval-management.module';
import { UsersManagement } from '@/v2/modules/users-management/entities/users-management.entity';
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
      UsersManagement,
    ]),
    ApprovalManagementModule,
  ],
  controllers: [ErpProcurementRequestController],
  providers: [
    ProcurementRequestCommandService,
    ProcurementRequestQueryService,
    ErpProcurementRequestsService,
    ProcurementRequestOrderingService,
  ],
  exports: [ProcurementRequestQueryService, ProcurementRequestOrderingService],
})
export class ErpProcurementRequestsModule {}
