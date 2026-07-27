import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Body,
  Headers,
  UseGuards,
  Param,
  createParamDecorator,
  ExecutionContext,
  NotFoundException,
} from '@nestjs/common';

export const BranchId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return (
      request.headers['x-kgara-branch-id'] ||
      request.headers['x-greenway-branch-id']
    );
  },
);
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { KgaraBranch } from './entities/kgara_branch.entity';
import { KgaraCase } from './entities/kgara_case.entity';
import { KgaraReceivable } from './entities/kgara_receivable.entity';
import { KgaraPayable } from './entities/kgara_payable.entity';
import { KgaraCaseService } from './entities/kgara_case_service.entity';
import { KgaraCaseLinkedInvoice } from './entities/kgara_case_linked_invoice.entity';
import { GwSyncRun } from './entities/kgara_sync_run.entity';
import { KgaraSyncService } from './kgara-sync.service';
import { KgaraClientService } from './kgara-client.service';
import { AuthGuard } from '@nestjs/passport';

@Controller(['kgara', 'greenway'])
// @UseGuards(AuthGuard('jwt')) // TODO: Enable auth when configuring full global auth
export class KgaraApiCoreController {
  constructor(
    @InjectRepository(KgaraBranch)
    private branchRepo: Repository<KgaraBranch>,
    @InjectRepository(KgaraCase)
    private caseRepo: Repository<KgaraCase>,
    @InjectRepository(KgaraReceivable)
    private receivableRepo: Repository<KgaraReceivable>,
    @InjectRepository(KgaraPayable)
    private payableRepo: Repository<KgaraPayable>,
    @InjectRepository(KgaraCaseService)
    private caseServiceRepo: Repository<KgaraCaseService>,
    @InjectRepository(KgaraCaseLinkedInvoice)
    private linkedInvoiceRepo: Repository<KgaraCaseLinkedInvoice>,
    @InjectRepository(GwSyncRun)
    private syncRunRepo: Repository<GwSyncRun>,
    private syncService: KgaraSyncService,
    private client: KgaraClientService,
  ) {}

  @Get('branches')
  async getBranches() {
    return this.branchRepo.find({ order: { name: 'ASC' } });
  }

  @Get('cases')
  async getCases(
    @BranchId() branchId: string,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20',
    @Query('q') q: string = '',
  ) {
    const query = this.caseRepo.createQueryBuilder('case');

    if (branchId) {
      query.andWhere('case.branchExternalId = :branchId', { branchId });
    }

    if (q) {
      query.andWhere(
        new Brackets((qb) => {
          qb.where('case.soChungTu ILIKE :q', { q: `%${q}%` })
            .orWhere('case.bienSoXe ILIKE :q', { q: `%${q}%` })
            .orWhere('case.khachHangName ILIKE :q', { q: `%${q}%` })
            .orWhere('case.khachHangCode ILIKE :q', { q: `%${q}%` });
        }),
      );
    }

    query.orderBy('case.updatedAt', 'DESC');

    const take = parseInt(pageSize, 10) || 20;
    const skip = (parseInt(page, 10) - 1 || 0) * take;

    query.take(take).skip(skip);

    const [data, total] = await query.getManyAndCount();

    return {
      data,
      pagination: {
        page: parseInt(page, 10) || 1,
        pageSize: take,
        total,
      },
    };
  }

  @Get('cases/:id')
  async getCaseById(@Param('id') id: string) {
    const caseData = await this.caseRepo.findOne({ where: { id } });
    if (!caseData) {
      throw new NotFoundException(`Case with id ${id} not found`);
    }
    return caseData;
  }

  @Post('sync/all')
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
  async syncBranches() {
    await this.syncService.syncBranches();
    return { success: true, message: 'Branches synced successfully.' };
  }

  @Post('sync/cases/incremental')
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
  async syncCases(
    @BranchId() branchId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!branchId) {
      return { success: false, message: 'Missing x-kgara-branch-id header' };
    }
    await this.syncService.syncCasesForBranch(branchId, from, to);
    return { success: true, message: 'Cases synced successfully.' };
  }

  @Post('sync/cases/:id/detail')
  async syncCaseDetail(@BranchId() branchId: string, @Param('id') id: string) {
    if (!branchId)
      return { success: false, message: 'Missing x-kgara-branch-id header' };
    const data = await this.syncService.syncCaseDetail(id, branchId);
    return { success: true, data };
  }

  @Post('sync/receivables')
  async syncReceivables(
    @BranchId() branchId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!branchId)
      return { success: false, message: 'Missing x-kgara-branch-id header' };
    await this.syncService.syncReceivables(branchId, from, to);
    return { success: true, message: 'Receivables synced successfully.' };
  }

  @Post('sync/payables')
  async syncPayables(
    @BranchId() branchId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!branchId)
      return { success: false, message: 'Missing x-kgara-branch-id header' };
    await this.syncService.syncPayables(branchId, from, to);
    return { success: true, message: 'Payables synced successfully.' };
  }

  @Get('reports/gross-profit-detail')
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
  async getReceivables(@BranchId() branchId: string) {
    const where: any = {};
    if (branchId) where.branchExternalId = branchId;
    return this.receivableRepo.find({ where, order: { updatedAt: 'DESC' } });
  }

  @Get('payables')
  async getPayables(@BranchId() branchId: string) {
    const where: any = {};
    if (branchId) where.branchExternalId = branchId;
    return this.payableRepo.find({ where, order: { updatedAt: 'DESC' } });
  }

  @Get('cases/:id/services')
  async getCaseServices(@Param('id') id: string) {
    return this.caseServiceRepo.find({ where: { hdPhieuDichVuId: id } });
  }

  @Get('cases/:id/payments')
  async getCasePayments(@Param('id') id: string) {
    // Return empty array since KGara V2 sync doesn't fetch detailed payment transactions.
    return [];
  }

  @Get('sync-runs')
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

  @Get('cases/:id/linked-invoices')
  async getLinkedInvoices(@Param('id') id: string) {
    return this.linkedInvoiceRepo.query(
      `SELECT l.*, 
              i.invoice_no as "invoiceNo", 
              i.seller_name as "sellerName", 
              i.buyer_name as "buyerName"
       FROM kgara_case_linked_invoice l
       LEFT JOIN erp_invoices i ON l."invoiceId" = i.id
       WHERE l."caseDbId" = $1
       ORDER BY l."createdAt" DESC`,
      [id],
    );
  }

  @Post('cases/:id/linked-invoices')
  async addLinkedInvoice(
    @Param('id') id: string,
    @Body() body: { invoiceId: string; linkType: 'IN' | 'OUT'; note?: string },
  ) {
    const link = this.linkedInvoiceRepo.create({
      caseDbId: id,
      invoiceId: body.invoiceId,
      linkType: body.linkType,
      note: body.note,
    });
    return this.linkedInvoiceRepo.save(link);
  }

  @Get('invoices/:invoiceId/linked-cases')
  async getLinkedCases(@Param('invoiceId') invoiceId: string) {
    return this.linkedInvoiceRepo.query(
      `SELECT l.*, 
              c.so_chung_tu as "soChungTu",
              c.bien_so_xe as "bienSoXe",
              c.khach_hang_name as "khachHangName"
       FROM kgara_case_linked_invoice l
       LEFT JOIN kgara_cases c ON l."caseDbId" = c.id
       WHERE l."invoiceId" = $1
       ORDER BY l."createdAt" DESC`,
      [invoiceId],
    );
  }

  @Delete('cases/:id/linked-invoices/:linkedId')
  async removeLinkedInvoice(
    @Param('id') id: string,
    @Param('linkedId') linkedId: string,
  ) {
    await this.linkedInvoiceRepo.delete({ id: linkedId, caseDbId: id });
    return { success: true };
  }
}
