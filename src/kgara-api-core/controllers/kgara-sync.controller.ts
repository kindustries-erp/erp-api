import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GwSyncRun } from '../entities/kgara_sync_run.entity';
import { KgaraSyncService } from '../kgara-sync.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { ErpResource, ErpAction } from '@/rbac-core/enums';
import { BranchId } from '../decorators/branch-id.decorator';

@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('greenway')
export class KgaraSyncController {
  constructor(
    @InjectRepository(GwSyncRun)
    private readonly syncRunRepo: Repository<GwSyncRun>,
    private readonly syncService: KgaraSyncService,
  ) {}

  @Post('sync/all')
  @RequirePermissions({
    resource: ErpResource.GARAGE,
    action: ErpAction.CREATE,
  })
  async syncAll(@BranchId() branchId: string) {
    if (!branchId) {
      return { success: false, message: 'Missing x-kgara-branch-id header' };
    }
    // 1. Sync branches
    await this.syncService.syncBranches();

    // 2. Incremental sync cases
    const caseWatermark = await this.syncService.getIncrementalWatermark(
      branchId,
      '/api/v1/gr/cases/list',
    );
    await this.syncService.syncCasesForBranch(
      branchId,
      undefined,
      undefined,
      caseWatermark,
    );

    // 3. Incremental sync receivables
    const recWatermark = await this.syncService.getIncrementalWatermark(
      branchId,
      '/api/v1/gr/exports/receivables',
    );
    await this.syncService.syncReceivables(
      branchId,
      undefined,
      undefined,
      recWatermark,
    );

    // 4. Incremental sync payables
    const payWatermark = await this.syncService.getIncrementalWatermark(
      branchId,
      '/api/v1/gr/exports/payables',
    );
    await this.syncService.syncPayables(
      branchId,
      undefined,
      undefined,
      payWatermark,
    );

    return {
      success: true,
      message: 'Full incremental sync completed successfully.',
    };
  }

  @Post('sync/branches')
  @RequirePermissions({
    resource: ErpResource.GARAGE,
    action: ErpAction.CREATE,
  })
  async syncBranches() {
    await this.syncService.syncBranches();
    return { success: true, message: 'Branches synced successfully.' };
  }

  @Post('sync/cases/incremental')
  @RequirePermissions({
    resource: ErpResource.GARAGE,
    action: ErpAction.CREATE,
  })
  async syncCasesIncremental(@BranchId() branchId: string) {
    if (!branchId) {
      return { success: false, message: 'Missing x-kgara-branch-id header' };
    }
    const watermark = await this.syncService.getIncrementalWatermark(
      branchId,
      '/api/v1/gr/cases/list',
    );
    await this.syncService.syncCasesForBranch(
      branchId,
      undefined,
      undefined,
      watermark,
    );
    return {
      success: true,
      message: 'Cases incremental sync completed successfully.',
      watermark,
    };
  }

  @Post('sync/cases')
  @RequirePermissions({
    resource: ErpResource.GARAGE,
    action: ErpAction.CREATE,
  })
  async syncCases(
    @BranchId() branchId: string,
    @Body() body?: { from?: string; to?: string },
    @Query('from') queryFrom?: string,
    @Query('to') queryTo?: string,
  ) {
    if (!branchId) {
      return { success: false, message: 'Missing x-kgara-branch-id header' };
    }
    const from = body?.from || queryFrom;
    const to = body?.to || queryTo;
    return this.syncService.syncCasesForBranch(branchId, from, to);
  }

  @Post('sync/gross-profit')
  @RequirePermissions({
    resource: ErpResource.GARAGE,
    action: ErpAction.CREATE,
  })
  async syncGrossProfit(
    @BranchId() branchId: string,
    @Body() body?: { from?: string; to?: string },
    @Query('from') queryFrom?: string,
    @Query('to') queryTo?: string,
  ) {
    if (!branchId) {
      return { success: false, message: 'Missing x-kgara-branch-id header' };
    }
    const from = body?.from || queryFrom;
    const to = body?.to || queryTo;
    return this.syncService.syncGrossProfitForBranch(branchId, from, to);
  }

  @Post('sync/cases/:id/detail')
  @RequirePermissions({
    resource: ErpResource.GARAGE,
    action: ErpAction.CREATE,
  })
  async syncCaseDetail(@Param('id') id: string, @BranchId() branchId: string) {
    if (!branchId) {
      return { success: false, message: 'Missing x-kgara-branch-id header' };
    }
    return this.syncService.syncCaseDetail(branchId, id);
  }

  @Post('sync/receivables')
  @RequirePermissions({
    resource: ErpResource.GARAGE,
    action: ErpAction.CREATE,
  })
  async syncReceivables(
    @BranchId() branchId: string,
    @Query('from') queryFrom?: string,
    @Query('to') queryTo?: string,
    @Body() body?: { from?: string; to?: string },
  ) {
    if (!branchId)
      return { success: false, message: 'Missing x-kgara-branch-id header' };
    const from = body?.from || queryFrom;
    const to = body?.to || queryTo;
    await this.syncService.syncReceivables(branchId, from, to);
    return { success: true, message: 'Receivables synced successfully.' };
  }

  @Post('sync/payables')
  @RequirePermissions({
    resource: ErpResource.GARAGE,
    action: ErpAction.CREATE,
  })
  async syncPayables(
    @BranchId() branchId: string,
    @Query('from') queryFrom?: string,
    @Query('to') queryTo?: string,
    @Body() body?: { from?: string; to?: string },
  ) {
    if (!branchId)
      return { success: false, message: 'Missing x-kgara-branch-id header' };
    const from = body?.from || queryFrom;
    const to = body?.to || queryTo;
    await this.syncService.syncPayables(branchId, from, to);
    return { success: true, message: 'Payables synced successfully.' };
  }

  @Get('sync-runs')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  async getSyncRuns(
    @BranchId() branchId: string,
    @Query('take') take: string = '50',
  ) {
    const where: any = {};
    if (branchId) where.branchExternalId = branchId;

    return this.syncRunRepo.find({
      where,
      order: { requestStartedAt: 'DESC' },
      take: parseInt(take, 10) || 50,
    });
  }
}
