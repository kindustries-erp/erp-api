import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KgaraReceivable } from '../entities/kgara_receivable.entity';
import { KgaraPayable } from '../entities/kgara_payable.entity';
import { KgaraCaseService } from '../entities/kgara_case_service.entity';
import { KgaraClientService } from '../kgara-client.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { ErpResource, ErpAction } from '@/rbac-core/enums';
import { BranchId } from '../decorators/branch-id.decorator';

@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('greenway')
export class KgaraReportsController {
  constructor(
    @InjectRepository(KgaraReceivable)
    private readonly receivableRepo: Repository<KgaraReceivable>,
    @InjectRepository(KgaraPayable)
    private readonly payableRepo: Repository<KgaraPayable>,
    @InjectRepository(KgaraCaseService)
    private readonly caseServiceRepo: Repository<KgaraCaseService>,
    private readonly client: KgaraClientService,
  ) {}

  @Get('reports/gross-profit-detail')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  async getGrossProfitDetail(
    @BranchId() branchId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    if (!branchId)
      return { success: false, message: 'Missing x-kgara-branch-id header' };
    return this.client.getGrossProfitDetail(branchId, from, to);
  }

  @Get('reports/gross-profit-detail/journal')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  async getGrossProfitJournal(
    @BranchId() branchId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('vuViecID') vuViecID?: string,
  ) {
    if (!branchId)
      return { success: false, message: 'Missing x-kgara-branch-id header' };
    return this.client.getGrossProfitJournal(branchId, from, to, vuViecID);
  }

  @Get('dashboard')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  async getDashboard(
    @BranchId() branchId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!branchId)
      return { success: false, message: 'Missing x-kgara-branch-id header' };
    return this.client.getDashboard(branchId, from, to);
  }

  @Get('receivables')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  async getReceivables(@BranchId() branchId: string) {
    const where: any = {};
    if (branchId) where.branchExternalId = branchId;
    return this.receivableRepo.find({ where, order: { updatedAt: 'DESC' } });
  }

  @Get('payables')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  async getPayables(@BranchId() branchId: string) {
    const where: any = {};
    if (branchId) where.branchExternalId = branchId;
    return this.payableRepo.find({ where, order: { updatedAt: 'DESC' } });
  }

  @Get('cases/:id/services')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  async getCaseServices(@Param('id') id: string) {
    return this.caseServiceRepo.find({ where: { hdPhieuDichVuId: id } });
  }

  @Get('cases/:id/payments')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  async getCasePayments(@Param('id') id: string) {
    // Return empty array since KGara V2 sync doesn't fetch detailed payment transactions.
    return [];
  }
}
