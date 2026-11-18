import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Post,
  Query,
  Request,
  Res,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CoreRbacGuard } from '@/auth/guards/core-rbac.guard';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import { ErpAction, ErpResource } from '@/v2/core/rbac-core';
import {
  exportProgressStream,
  sendReadyExportFile,
} from '@/v2/core/export-jobs-core';
import { BranchId } from '@/kgara-api-core/decorators/branch-id.decorator';
import { GarageDebtsExportDto } from '@/kgara-api-core/dto/garage-export.dto';
import type { GarageDebtExportKind } from '@/kgara-api-core/helpers/garage-debts-export.helper';
import {
  DEBTS_EXPORT_KINDS,
  DebtsExportJobsService,
} from '../services/debts-export-jobs.service';

const DEBTS_READ = {
  resource: ErpResource.GARAGE_DEBTS,
  action: ErpAction.READ,
};
const KIND_PIPE = new ParseEnumPipe(
  Object.fromEntries(DEBTS_EXPORT_KINDS.map((k) => [k, k])),
);

interface AuthedRequest {
  user?: { sub?: string };
}

/**
 * Xuất Excel nền công nợ garage v2. `kind` là customers, suppliers hoặc all. Đường dẫn cố định
 * `export/...` nên không đụng route `:id` của các endpoint đọc.
 */
@ApiTags('debts-garage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('api/v2/debts-garage/export')
export class DebtsExportController {
  constructor(private readonly jobs: DebtsExportJobsService) {}

  private userId(req: AuthedRequest): string {
    const id = req.user?.sub;
    if (!id) throw new BadRequestException('Thiếu người dùng đăng nhập.');
    return id;
  }

  @RequirePermissions(DEBTS_READ)
  @ApiOperation({ summary: 'Bắt đầu job xuất Excel công nợ' })
  @Post(':kind')
  start(
    @Param('kind', KIND_PIPE) kind: GarageDebtExportKind,
    @Body() dto: GarageDebtsExportDto,
    @BranchId() branchId: string,
    @Request() req: AuthedRequest,
  ) {
    return this.jobs.start(kind, dto, branchId, this.userId(req));
  }

  @RequirePermissions(DEBTS_READ)
  @ApiOperation({ summary: 'Lịch sử job xuất của người dùng' })
  @Get(':kind/history')
  history(
    @Param('kind', KIND_PIPE) kind: GarageDebtExportKind,
    @Request() req: AuthedRequest,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.jobs
      .runner(kind)
      .listHistoryForUser(
        this.userId(req),
        page ? Number(page) : undefined,
        pageSize ? Number(pageSize) : undefined,
      );
  }

  @RequirePermissions(DEBTS_READ)
  @ApiOperation({ summary: 'Tải file đã xuất' })
  @Get(':kind/:jobId/download')
  download(
    @Param('kind', KIND_PIPE) kind: GarageDebtExportKind,
    @Param('jobId') jobId: string,
    @Request() req: AuthedRequest,
    @Res() res: Response,
  ) {
    sendReadyExportFile(this.jobs.runner(kind), jobId, this.userId(req), res);
  }

  @RequirePermissions(DEBTS_READ)
  @ApiOperation({ summary: 'Luồng tiến độ (SSE)' })
  @Sse(':kind/progress')
  progress(
    @Param('kind', KIND_PIPE) kind: GarageDebtExportKind,
    @Request() req: AuthedRequest,
  ) {
    return exportProgressStream(this.jobs.runner(kind), this.userId(req));
  }
}
