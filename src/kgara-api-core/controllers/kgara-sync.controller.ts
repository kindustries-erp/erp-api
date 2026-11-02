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
import { KgaraBranch } from '../entities/kgara_branch.entity';
import { KgaraSyncService } from '../kgara-sync.service';
import { KgaraAccountKey } from '../enums/kgara-account.enum';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { ErpResource, ErpAction } from '@/rbac-core/enums';
import { BranchId } from '../decorators/branch-id.decorator';
import { SyncAllDto } from '../dto/sync-all.dto';

@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('greenway')
export class KgaraSyncController {
  constructor(
    @InjectRepository(GwSyncRun)
    private readonly syncRunRepo: Repository<GwSyncRun>,
    @InjectRepository(KgaraBranch)
    private readonly branchRepo: Repository<KgaraBranch>,
    private readonly syncService: KgaraSyncService,
  ) {}

  @Post('sync/all')
  @RequirePermissions({
    resource: ErpResource.GARAGE,
    action: ErpAction.CREATE,
  })
  async syncAll(
    @BranchId() headerBranchId: string,
    @Query('branch_id') queryBranchId?: string,
    @Query('account') queryAccount?: string,
    @Body() body?: SyncAllDto,
  ) {
    const branchId = body?.branchId || queryBranchId || headerBranchId;
    if (!branchId) {
      return { success: false, message: 'Missing branchId' };
    }

    const branch = await this.branchRepo.findOne({
      where: { externalId: branchId },
    });
    const accountKey =
      (branch?.accountKey as KgaraAccountKey) ||
      (body?.account as KgaraAccountKey) ||
      (queryAccount as KgaraAccountKey) ||
      KgaraAccountKey.MAIN;

    const result = await this.syncService.syncAllInOne(branchId, {
      from: body?.from,
      to: body?.to,
      includeDetails: body?.includeDetails,
      forceDetails: body?.forceDetails,
      accountKey,
    });

    return {
      success: true,
      data: result,
      message: 'All-In-One sync completed successfully.',
    };
  }

  @Post('sync/branches')
  @RequirePermissions({
    resource: ErpResource.GARAGE,
    action: ErpAction.CREATE,
  })
  async syncBranches(@Query('account') queryAccount?: string) {
    if (queryAccount === 'OJ') {
      await this.syncService.syncBranches(KgaraAccountKey.OJ);
    } else if (queryAccount === 'MAIN') {
      await this.syncService.syncBranches(KgaraAccountKey.MAIN);
    } else {
      for (const acc of [KgaraAccountKey.MAIN, KgaraAccountKey.OJ]) {
        try {
          await this.syncService.syncBranches(acc);
        } catch (e: any) {
          // continue
        }
      }
    }
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
    const branch = await this.branchRepo.findOne({
      where: { externalId: branchId },
    });
    const accountKey =
      (branch?.accountKey as KgaraAccountKey) || KgaraAccountKey.MAIN;

    const watermark = await this.syncService.getIncrementalWatermark(
      branchId,
      '/api/v1/gr/cases/list',
      accountKey,
    );
    await this.syncService.syncCasesForBranch(
      branchId,
      undefined,
      undefined,
      watermark,
      accountKey,
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
    @Body() body?: { from?: string; to?: string; account?: string },
    @Query('from') queryFrom?: string,
    @Query('to') queryTo?: string,
    @Query('account') queryAccount?: string,
  ) {
    if (!branchId) {
      return { success: false, message: 'Missing x-kgara-branch-id header' };
    }
    const from = body?.from || queryFrom;
    const to = body?.to || queryTo;
    const branch = await this.branchRepo.findOne({
      where: { externalId: branchId },
    });
    const accountKey =
      (branch?.accountKey as KgaraAccountKey) ||
      (body?.account as KgaraAccountKey) ||
      (queryAccount as KgaraAccountKey) ||
      KgaraAccountKey.MAIN;

    return this.syncService.syncCasesForBranch(
      branchId,
      from,
      to,
      undefined,
      accountKey,
    );
  }

  @Post('sync/gross-profit')
  @RequirePermissions({
    resource: ErpResource.GARAGE,
    action: ErpAction.CREATE,
  })
  async syncGrossProfit(
    @BranchId() branchId: string,
    @Body() body?: { from?: string; to?: string; account?: string },
    @Query('from') queryFrom?: string,
    @Query('to') queryTo?: string,
    @Query('account') queryAccount?: string,
  ) {
    if (!branchId) {
      return { success: false, message: 'Missing x-kgara-branch-id header' };
    }
    const from = body?.from || queryFrom;
    const to = body?.to || queryTo;
    const branch = await this.branchRepo.findOne({
      where: { externalId: branchId },
    });
    const accountKey =
      (branch?.accountKey as KgaraAccountKey) ||
      (body?.account as KgaraAccountKey) ||
      (queryAccount as KgaraAccountKey) ||
      KgaraAccountKey.MAIN;

    return this.syncService.syncGrossProfitForBranch(
      branchId,
      from,
      to,
      accountKey,
    );
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

  @Post('sync/case-details')
  @RequirePermissions({
    resource: ErpResource.GARAGE,
    action: ErpAction.CREATE,
  })
  async syncCaseDetailsBatch(
    @BranchId() headerBranchId: string,
    @Query('branch_id') queryBranchId?: string,
    @Query('from') queryFrom?: string,
    @Query('to') queryTo?: string,
    @Query('force') queryForce?: string,
    @Body()
    body?: {
      branchId?: string;
      from?: string;
      to?: string;
      force?: boolean;
      concurrency?: number;
    },
  ) {
    const effectiveBranchId =
      body?.branchId || queryBranchId || headerBranchId || undefined;
    const from = body?.from || queryFrom;
    const to = body?.to || queryTo;
    const force = body?.force ?? (queryForce === 'true' || queryForce === '1');
    const concurrency = body?.concurrency;

    const result = await this.syncService.syncCaseDetailsBatch(
      effectiveBranchId,
      {
        from,
        to,
        force,
        concurrency,
      },
    );

    return {
      success: true,
      data: result,
      message: `Đã đồng bộ chi tiết cho ${result.totalCasesProcessed} phiếu dịch vụ (${result.totalLinesSynced} dòng chi tiết).`,
    };
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
