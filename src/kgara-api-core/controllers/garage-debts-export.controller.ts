import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  Res,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CoreRbacGuard } from '../../auth/guards/core-rbac.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { ErpAction, ErpResource } from '@/rbac-core/enums';
import { BranchId } from '../decorators/branch-id.decorator';
import { GarageDebtsExportDto } from '../dto/garage-export.dto';
import type { GarageDebtExportKind } from '../helpers/garage-debts-export.helper';
import { GarageExportJobsService } from '../services/garage-export-jobs.service';
import {
  exportProgressStream,
  sendReadyExportFile,
} from './garage-export.helper';

const DEBTS_READ = {
  resource: ErpResource.GARAGE_DEBTS,
  action: ErpAction.READ,
};

/**
 * Xuất Excel nền công nợ phải thu (khách hàng) và phải trả (NCC). Hai bảng có
 * runner riêng nên có thể xuất song song; quyền `GARAGE_DEBTS`.
 */
@ApiTags('greenway_debts_export')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('greenway')
export class GarageDebtsExportController {
  constructor(private readonly exportJobs: GarageExportJobsService) {}

  private start(
    kind: GarageDebtExportKind,
    dto: GarageDebtsExportDto,
    branchId: string,
    req: any,
  ) {
    return this.exportJobs.startDebtsExport(kind, dto, branchId, req.user?.sub);
  }

  private history(
    kind: GarageDebtExportKind,
    req: any,
    page?: string,
    pageSize?: string,
  ) {
    return this.exportJobs
      .debtsRunner(kind)
      .listHistoryForUser(
        req.user?.sub,
        page ? Number(page) : undefined,
        pageSize ? Number(pageSize) : undefined,
      );
  }

  // ===== Công nợ phải thu (khách hàng) =====

  @Post('cases/customers-debt/export/background')
  @RequirePermissions(DEBTS_READ)
  startCustomers(
    @Body() dto: GarageDebtsExportDto,
    @BranchId() branchId: string,
    @Request() req: any,
  ) {
    return this.start('customers', dto, branchId, req);
  }

  @Get('cases/customers-debt/export/background/history')
  @RequirePermissions(DEBTS_READ)
  customersHistory(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.history('customers', req, page, pageSize);
  }

  @Get('cases/customers-debt/export/background/:jobId/download')
  @RequirePermissions(DEBTS_READ)
  downloadCustomers(
    @Param('jobId') jobId: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    sendReadyExportFile(
      this.exportJobs.debtsRunner('customers'),
      jobId,
      req.user?.sub,
      res,
    );
  }

  @Sse('cases/customers-debt/export/progress/stream')
  @RequirePermissions(DEBTS_READ)
  customersProgressStream(@Request() req: any) {
    return exportProgressStream(
      this.exportJobs.debtsRunner('customers'),
      req.user?.sub,
    );
  }

  // ===== Công nợ phải trả (nhà cung cấp) =====

  @Post('payables/suppliers-debt/export/background')
  @RequirePermissions(DEBTS_READ)
  startSuppliers(
    @Body() dto: GarageDebtsExportDto,
    @BranchId() branchId: string,
    @Request() req: any,
  ) {
    return this.start('suppliers', dto, branchId, req);
  }

  @Get('payables/suppliers-debt/export/background/history')
  @RequirePermissions(DEBTS_READ)
  suppliersHistory(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.history('suppliers', req, page, pageSize);
  }

  @Get('payables/suppliers-debt/export/background/:jobId/download')
  @RequirePermissions(DEBTS_READ)
  downloadSuppliers(
    @Param('jobId') jobId: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    sendReadyExportFile(
      this.exportJobs.debtsRunner('suppliers'),
      jobId,
      req.user?.sub,
      res,
    );
  }

  @Sse('payables/suppliers-debt/export/progress/stream')
  @RequirePermissions(DEBTS_READ)
  suppliersProgressStream(@Request() req: any) {
    return exportProgressStream(
      this.exportJobs.debtsRunner('suppliers'),
      req.user?.sub,
    );
  }

  // ===== Công nợ tổng hợp (cả khách hàng và nhà cung cấp) =====

  @Post('debts/all/export/background')
  @RequirePermissions(DEBTS_READ)
  startAll(
    @Body() dto: GarageDebtsExportDto,
    @BranchId() branchId: string,
    @Request() req: any,
  ) {
    return this.start('all', dto, branchId, req);
  }

  @Get('debts/all/export/background/history')
  @RequirePermissions(DEBTS_READ)
  allHistory(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.history('all', req, page, pageSize);
  }

  @Get('debts/all/export/background/:jobId/download')
  @RequirePermissions(DEBTS_READ)
  downloadAll(
    @Param('jobId') jobId: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    sendReadyExportFile(
      this.exportJobs.debtsRunner('all'),
      jobId,
      req.user?.sub,
      res,
    );
  }

  @Sse('debts/all/export/progress/stream')
  @RequirePermissions(DEBTS_READ)
  allProgressStream(@Request() req: any) {
    return exportProgressStream(
      this.exportJobs.debtsRunner('all'),
      req.user?.sub,
    );
  }
}
