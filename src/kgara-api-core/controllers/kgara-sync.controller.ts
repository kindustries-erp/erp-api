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
import { KgaraAuthService } from '../kgara-auth.service';
import { KgaraAccountKey } from '../enums/kgara-account.enum';
import { resolveBranchAccount } from '../helpers/kgara-branch-account.helper';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { ErpResource, ErpAction } from '@/rbac-core/enums';
import { BranchId } from '../decorators/branch-id.decorator';
import { SyncAllDto } from '../dto/sync-all.dto';
import { SyncAllBranchesDto } from '../dto/sync-all-branches.dto';
import { KgaraBulkSyncService } from '../services/kgara-bulk-sync.service';

@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('greenway')
export class KgaraSyncController {
  constructor(
    @InjectRepository(GwSyncRun)
    private readonly syncRunRepo: Repository<GwSyncRun>,
    @InjectRepository(KgaraBranch)
    private readonly branchRepo: Repository<KgaraBranch>,
    private readonly syncService: KgaraSyncService,
    private readonly authService: KgaraAuthService,
    private readonly bulkSyncService: KgaraBulkSyncService,
  ) {}

  /**
   * Tra tài khoản Kgara của chi nhánh. Không đoán khi CN2 có nhiều tài khoản:
   * trả lỗi yêu cầu tham số `account`.
   */
  private async resolveAccountForBranch(
    branchId: string,
    explicitAccount?: string,
  ): Promise<{ accountKey: KgaraAccountKey } | { error: string }> {
    const rows = await this.branchRepo.find({
      where: { externalId: branchId },
    });
    const result = resolveBranchAccount(rows, explicitAccount);
    if (result.ok) return { accountKey: result.accountKey };
    if (result.reason === 'INVALID_ACCOUNT') {
      return { error: `account không hợp lệ: ${explicitAccount}` };
    }
    return {
      error: `Chi nhánh ${branchId} có nhiều tài khoản Kgara (MAIN/OJ): cần tham số account`,
    };
  }

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

    const resolved = await this.resolveAccountForBranch(
      branchId,
      body?.account || queryAccount,
    );
    if ('error' in resolved) {
      return { success: false, message: resolved.error };
    }
    const accountKey = resolved.accountKey;

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

  @Post('sync/all-branches')
  @RequirePermissions({
    resource: ErpResource.GARAGE,
    action: ErpAction.CREATE,
  })
  startAllBranchesSync(@Body() body: SyncAllBranchesDto) {
    return this.bulkSyncService.start({
      scope: body.scope,
      from: body.from,
      to: body.to,
      includeDetails: body.includeDetails,
      forceDetails: body.forceDetails,
    });
  }

  @Get('sync/all-branches/status')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  getAllBranchesSyncStatus() {
    return this.bulkSyncService.getStatus();
  }

  @Post('sync/branches')
  @RequirePermissions({
    resource: ErpResource.GARAGE,
    action: ErpAction.CREATE,
  })
  async syncBranches(@Query('account') queryAccount?: string) {
    const accountKeys =
      queryAccount === KgaraAccountKey.OJ ||
      queryAccount === KgaraAccountKey.MAIN
        ? [queryAccount as KgaraAccountKey]
        : this.authService.getConfiguredAccounts();

    const result = await this.syncService.syncBranchesForAccounts(accountKeys);
    const failed = result.accounts.filter((a) => !a.ok);

    return {
      success: result.success,
      accounts: result.accounts,
      message: result.success
        ? 'Branches synced successfully.'
        : `Đồng bộ chi nhánh lỗi cho: ${failed.map((a) => `${a.accountKey} (${a.error})`).join('; ')}`,
    };
  }

  @Post('sync/cases/incremental')
  @RequirePermissions({
    resource: ErpResource.GARAGE,
    action: ErpAction.CREATE,
  })
  async syncCasesIncremental(
    @BranchId() branchId: string,
    @Query('account') queryAccount?: string,
  ) {
    if (!branchId) {
      return { success: false, message: 'Missing x-kgara-branch-id header' };
    }
    const resolved = await this.resolveAccountForBranch(branchId, queryAccount);
    if ('error' in resolved) {
      return { success: false, message: resolved.error };
    }
    const accountKey = resolved.accountKey;

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
    const resolved = await this.resolveAccountForBranch(
      branchId,
      body?.account || queryAccount,
    );
    if ('error' in resolved) {
      return { success: false, message: resolved.error };
    }
    const accountKey = resolved.accountKey;

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
    const resolved = await this.resolveAccountForBranch(
      branchId,
      body?.account || queryAccount,
    );
    if ('error' in resolved) {
      return { success: false, message: resolved.error };
    }
    const accountKey = resolved.accountKey;

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
  async syncCaseDetail(
    @Param('id') id: string,
    @BranchId() branchId: string,
    @Query('account') queryAccount?: string,
  ) {
    if (!branchId) {
      return { success: false, message: 'Missing x-kgara-branch-id header' };
    }
    // Không truyền account thì dùng account đã lưu trên phiếu (service tự xử lý)
    let accountKey: KgaraAccountKey | undefined;
    if (queryAccount) {
      const resolved = await this.resolveAccountForBranch(
        branchId,
        queryAccount,
      );
      if ('error' in resolved) {
        return { success: false, message: resolved.error };
      }
      accountKey = resolved.accountKey;
    }
    return this.syncService.syncCaseDetail(branchId, id, accountKey);
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
    @Query('account') queryAccount?: string,
    @Body()
    body?: {
      branchId?: string;
      from?: string;
      to?: string;
      force?: boolean;
      concurrency?: number;
      account?: string;
    },
  ) {
    const effectiveBranchId =
      body?.branchId || queryBranchId || headerBranchId || undefined;
    const from = body?.from || queryFrom;
    const to = body?.to || queryTo;
    const force = body?.force ?? (queryForce === 'true' || queryForce === '1');
    const concurrency = body?.concurrency;

    // Không truyền account: mỗi phiếu dùng account của chính nó
    let accountKey: KgaraAccountKey | undefined;
    const explicitAccount = body?.account || queryAccount;
    if (explicitAccount) {
      const resolved = await this.resolveAccountForBranch(
        effectiveBranchId ?? '',
        explicitAccount,
      );
      if ('error' in resolved) {
        return { success: false, message: resolved.error };
      }
      accountKey = resolved.accountKey;
    }

    const result = await this.syncService.syncCaseDetailsBatch(
      effectiveBranchId,
      {
        from,
        to,
        force,
        concurrency,
        accountKey,
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
