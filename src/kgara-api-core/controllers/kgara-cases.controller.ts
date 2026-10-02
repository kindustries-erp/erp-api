import {
  Controller,
  Get,
  Patch,
  Query,
  Param,
  Body,
  UseGuards,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiProduces, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KgaraBranch } from '../entities/kgara_branch.entity';
import { KgaraCaseQueryService } from '../services/kgara-case-query.service';
import { buildGarageCaseExportFileName } from '../helpers/kgara-excel-style.helper';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { ErpResource, ErpAction } from '@/rbac-core/enums';
import { BranchId } from '../decorators/branch-id.decorator';
import { KgaraCaseConfigService } from '../services/kgara-case-config.service';
import { UpdateCaseConfigDto } from '../dto/update-case-config.dto';
import { KgaraCaseLookupService } from '../services/kgara-case-lookup.service';

@ApiTags('greenway_cases')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('greenway')
export class KgaraCasesController {
  constructor(
    @InjectRepository(KgaraBranch)
    private readonly branchRepo: Repository<KgaraBranch>,
    private readonly caseQueryService: KgaraCaseQueryService,
    private readonly caseConfigService: KgaraCaseConfigService,
    private readonly caseLookupService: KgaraCaseLookupService,
  ) {}

  @Get('branches')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  async getBranches() {
    return this.branchRepo.find({ order: { name: 'ASC' } });
  }

  @Get('cases/export/excel')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @ApiQuery({ name: 'date_from', required: false })
  @ApiQuery({ name: 'date_to', required: false })
  @ApiQuery({ name: 'date_type', required: false })
  @ApiQuery({ name: 'classification', required: false })
  @ApiQuery({ name: 'branch_id', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'q', required: false })
  async exportCasesExcel(
    @Res() res: Response,
    @BranchId() headerBranchId: string,
    @Query('branch_id') queryBranchId?: string,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
    @Query('date_type') dateType?: 'completion_date' | 'case_date',
    @Query('classification') classification?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
  ) {
    const effectiveBranchId = queryBranchId || headerBranchId;
    const buffer = await this.caseQueryService.exportCompletedCasesExcel({
      branchId: effectiveBranchId || undefined,
      date_from: dateFrom,
      date_to: dateTo,
      date_type: dateType,
      classification,
      status,
      q,
    });

    const fileName = buildGarageCaseExportFileName(classification, status);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('cases/services/export/excel')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'serviceType', required: false })
  @ApiQuery({ name: 'filtersStr', required: false })
  @ApiQuery({ name: 'sorts', required: false })
  @ApiQuery({ name: 'branch_id', required: false })
  @ApiQuery({ name: 'q', required: false })
  async exportCaseServicesExcel(
    @Res() res: Response,
    @BranchId() headerBranchId: string,
    @Query('branch_id') queryBranchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('serviceType') serviceType?: string,
    @Query('filtersStr') filtersStr?: string,
    @Query('sorts') sorts?: string | string[],
    @Query('q') q?: string,
  ) {
    const effectiveBranchId = queryBranchId || headerBranchId;
    const buffer = await this.caseQueryService.exportCaseServicesExcel({
      branchId: effectiveBranchId || undefined,
      from,
      to,
      serviceType,
      filtersStr,
      sorts,
      q,
    });

    const ts = new Date()
      .toISOString()
      .replace(/[-:T.]/g, '')
      .slice(0, 14);
    const fileName = `Chi_tiet_phieu_dich_vu_${ts}.xlsx`;

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('cases/services/column-options')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  async getCaseServiceColumnOptions(
    @BranchId() headerBranchId: string,
    @Query('branch_id') queryBranchId: string,
    @Query('column') column: string,
    @Query('search') search: string = '',
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20',
    @Query('filtersStr') filtersStr?: string,
    @Query('serviceType') serviceType?: string,
  ) {
    const effectiveBranchId = queryBranchId || headerBranchId;
    return this.caseQueryService.getCaseServiceColumnOptions(
      effectiveBranchId,
      column,
      search,
      parseInt(page, 10) || 1,
      parseInt(pageSize, 10) || 20,
      filtersStr,
      serviceType,
    );
  }

  @Get('cases/services')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  async getCaseServices(
    @BranchId() headerBranchId: string,
    @Query('branch_id') queryBranchId: string,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20',
    @Query('q') q: string = '',
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('serviceType') serviceType?: string,
    @Query('filtersStr') filtersStr?: string,
    @Query('sorts') sorts?: string | string[],
  ) {
    const effectiveBranchId = queryBranchId || headerBranchId;
    return this.caseQueryService.findCaseServices({
      branchId: effectiveBranchId,
      page,
      pageSize,
      q,
      from,
      to,
      serviceType,
      filtersStr,
      sorts,
    });
  }

  @Get('cases')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  async getCases(
    @BranchId() branchId: string,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20',
    @Query('q') q: string = '',
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('filtersStr') filtersStr?: string,
    @Query('includeDeleted') includeDeleted?: string,
    @Query('sorts') sorts?: string | string[],
  ) {
    return this.caseQueryService.findCases({
      branchId,
      page,
      pageSize,
      q,
      from,
      to,
      filtersStr,
      includeDeleted,
      sorts,
    });
  }

  @Get('cases/column-options')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  async getCaseColumnOptions(
    @BranchId() branchId: string,
    @Query('column') column: string,
    @Query('search') search: string = '',
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20',
    @Query('filtersStr') filtersStr?: string,
  ) {
    return this.caseQueryService.getCaseColumnOptions({
      branchId,
      column,
      search,
      page,
      pageSize,
      filtersStr,
    });
  }

  @Get('cases/gross-profit-report')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  async getGrossProfitReport(
    @BranchId() branchId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.caseQueryService.getGrossProfitReport({
      branchId,
      from,
      to,
    });
  }

  @Get('cases/by-code/:code')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  async getCaseByCode(@Param('code') code: string) {
    return this.caseLookupService.findCaseByCodeOrId(code);
  }

  @Get('cases/by-code/:code/gross-profit')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  async getGrossProfitByCode(@Param('code') code: string) {
    return this.caseLookupService.findGrossProfitByCodeOrId(code);
  }

  @Get('cases/external/:externalId')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  async getCaseByExternalId(
    @Param('externalId') externalId: string,
    @BranchId() branchId: string,
  ) {
    return this.caseLookupService.findCaseByExternalId(externalId, branchId);
  }

  @Get('cases/:id')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  async getCaseById(@Param('id') id: string) {
    return this.caseLookupService.findCaseByCodeOrId(id);
  }

  @Patch('cases/:id/erp-notes')
  @RequirePermissions({
    resource: ErpResource.GARAGE,
    action: ErpAction.UPDATE,
  })
  async updateErpNotes(
    @Param('id') id: string,
    @Body() body: { erpNotes: string | null },
  ) {
    return this.caseConfigService.updateErpNotes(id, body.erpNotes);
  }

  @Patch('cases/:id/config')
  @RequirePermissions({
    resource: ErpResource.GARAGE,
    action: ErpAction.UPDATE,
  })
  async updateCaseConfig(
    @Param('id') id: string,
    @Body() body: UpdateCaseConfigDto,
  ) {
    return this.caseConfigService.updateCaseConfig(id, body);
  }
}
