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
import { GarageDashboardExportDto } from '../dto/garage-export.dto';
import { GarageExportJobsService } from '../services/garage-export-jobs.service';
import {
  exportProgressStream,
  sendReadyExportFile,
} from './garage-export.helper';

/** File báo cáo chứa cả công nợ nên cần quyền Garage và quyền Công nợ Garage. */
const DASHBOARD_EXPORT_PERMISSIONS = [
  { resource: ErpResource.GARAGE, action: ErpAction.READ },
  { resource: ErpResource.GARAGE_DEBTS, action: ErpAction.READ },
] as const;

/** Xuất Excel nền báo cáo Garage theo kỳ (tab Tổng quan): job, lịch sử, tải file, SSE. */
@ApiTags('greenway_dashboard_export')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('greenway/dashboard/export')
export class GarageDashboardExportController {
  constructor(private readonly exportJobs: GarageExportJobsService) {}

  @Post('background')
  @RequirePermissions(...DASHBOARD_EXPORT_PERMISSIONS)
  start(
    @Body() dto: GarageDashboardExportDto,
    @BranchId() branchId: string,
    @Request() req: any,
  ) {
    return this.exportJobs.startDashboardExport(dto, branchId, req.user?.sub);
  }

  @Get('background/history')
  @RequirePermissions(...DASHBOARD_EXPORT_PERMISSIONS)
  history(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.exportJobs.dashboardRunner.listHistoryForUser(
      req.user?.sub,
      page ? Number(page) : undefined,
      pageSize ? Number(pageSize) : undefined,
    );
  }

  @Get('background/:jobId/download')
  @RequirePermissions(...DASHBOARD_EXPORT_PERMISSIONS)
  download(
    @Param('jobId') jobId: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    sendReadyExportFile(
      this.exportJobs.dashboardRunner,
      jobId,
      req.user?.sub,
      res,
    );
  }

  @Sse('progress/stream')
  @RequirePermissions(...DASHBOARD_EXPORT_PERMISSIONS)
  progressStream(@Request() req: any) {
    return exportProgressStream(this.exportJobs.dashboardRunner, req.user?.sub);
  }
}
