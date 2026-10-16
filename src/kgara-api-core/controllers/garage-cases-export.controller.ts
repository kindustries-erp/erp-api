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
import { GarageCasesExportDto } from '../dto/garage-export.dto';
import { GarageExportJobsService } from '../services/garage-export-jobs.service';
import {
  exportProgressStream,
  sendReadyExportFile,
} from './garage-export.helper';

/** Xuất Excel nền bảng kê phiếu dịch vụ (cases): job, lịch sử, tải file, SSE. */
@ApiTags('greenway_cases_export')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('greenway/cases/export/excel')
export class GarageCasesExportController {
  constructor(private readonly exportJobs: GarageExportJobsService) {}

  @Post('background')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  start(
    @Body() dto: GarageCasesExportDto,
    @BranchId() branchId: string,
    @Request() req: any,
  ) {
    return this.exportJobs.startCasesExport(dto, branchId, req.user?.sub);
  }

  @Get('background/history')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  history(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.exportJobs.casesRunner.listHistoryForUser(
      req.user?.sub,
      page ? Number(page) : undefined,
      pageSize ? Number(pageSize) : undefined,
    );
  }

  @Get('background/:jobId/download')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  download(
    @Param('jobId') jobId: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    sendReadyExportFile(this.exportJobs.casesRunner, jobId, req.user?.sub, res);
  }

  @Sse('progress/stream')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  progressStream(@Request() req: any) {
    return exportProgressStream(this.exportJobs.casesRunner, req.user?.sub);
  }
}
