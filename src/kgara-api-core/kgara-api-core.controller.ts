import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Query,
  Body,
  Headers,
  UseGuards,
  Param,
  createParamDecorator,
  ExecutionContext,
  NotFoundException,
  Logger,
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
import { Repository, Brackets, SelectQueryBuilder } from 'typeorm';
import { KgaraBranch } from './entities/kgara_branch.entity';
import { KgaraCase } from './entities/kgara_case.entity';
import { KgaraReceivable } from './entities/kgara_receivable.entity';
import { KgaraPayable } from './entities/kgara_payable.entity';
import { KgaraCaseService } from './entities/kgara_case_service.entity';
import { KgaraCaseLinkedInvoice } from './entities/kgara_case_linked_invoice.entity';
import { GwSyncRun } from './entities/kgara_sync_run.entity';
import { KgaraGrossProfit } from './entities/kgara_gross_profit.entity';
import { KgaraSyncService } from './kgara-sync.service';
import { KgaraClientService } from './kgara-client.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('greenway')
export class KgaraApiCoreController {
  private readonly logger = new Logger(KgaraApiCoreController.name);

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
    @InjectRepository(KgaraGrossProfit)
    private grossProfitRepo: Repository<KgaraGrossProfit>,
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
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('filtersStr') filtersStr?: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    const query = this.caseRepo.createQueryBuilder('case');

    if (branchId) {
      query.andWhere('case.branchExternalId = :branchId', { branchId });
    }

    if (includeDeleted !== 'true') {
      query.andWhere('case.kgaraDeletedAt IS NULL');
    }

    if (from) {
      query.andWhere('case.ngayPhatSinh >= :from', { from });
    }
    if (to) {
      query.andWhere('case.ngayPhatSinh <= :to', { to });
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

    this.applyCaseListFilters(query, filtersStr);

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

  @Get('cases/column-options')
  async getCaseColumnOptions(
    @BranchId() branchId: string,
    @Query('column') column: string,
    @Query('search') search: string = '',
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20',
    @Query('filtersStr') filtersStr?: string,
  ) {
    const selectExpr = this.getCaseColumnSelectExpr(column);
    if (!selectExpr) {
      return { items: [], total: 0, page: 1, totalPages: 0 };
    }

    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safePageSize = Math.max(parseInt(pageSize, 10) || 20, 1);

    const query = this.caseRepo
      .createQueryBuilder('case')
      .select(`DISTINCT ${selectExpr}`, 'value');

    if (branchId) {
      query.andWhere('case.branchExternalId = :branchId', { branchId });
    }

    query.andWhere('case.kgaraDeletedAt IS NULL');
    query.andWhere(`${selectExpr} IS NOT NULL`);
    query.andWhere(`CAST(${selectExpr} AS TEXT) != ''`);

    this.applyCaseOptionFilters(query, column, filtersStr);

    if (search) {
      query.andWhere(`CAST(${selectExpr} AS TEXT) ILIKE :search`, {
        search: `%${search}%`,
      });
    }

    query.orderBy('value', 'ASC');

    const totalRaw = await query
      .clone()
      .orderBy()
      .select(`COUNT(DISTINCT ${selectExpr})`, 'cnt')
      .getRawOne();

    const total = parseInt(totalRaw?.cnt || '0', 10);

    const raw = await query
      .offset((safePage - 1) * safePageSize)
      .limit(safePageSize)
      .getRawMany();

    return {
      items: raw.map((r) => String(r.value)).filter(Boolean),
      total,
      page: safePage,
      totalPages: Math.ceil(total / safePageSize),
    };
  }

  private getCaseColumnSelectExpr(column: string): string | null {
    const mapping: Record<string, string> = {
      caseCode: '"case"."so_chung_tu"',
      licensePlate: '"case"."bien_so_xe"',
      customerCode: '"case"."khach_hang_code"',
      customerName: '"case"."khach_hang_name"',
      statusName: '"case"."ten_tinh_trang_dich_vu"',
      isInsuranceClaim:
        "CASE WHEN COALESCE((\"case\".\"raw_data\" ->> 'XeLamBaoHiem')::boolean, false) THEN 'yes' ELSE 'no' END",
      doanhThu: '"case"."doanh_thu"',
      chiPhi: '"case"."chi_phi"',
      loiNhuan: '"case"."loi_nhuan"',
      totalAmount: '"case"."tien_co_thue"',
      balanceAmount: '"case"."tien_con_phai_thanh_toan"',
      caseDate: 'TO_CHAR("case"."ngay_phat_sinh", \'YYYY-MM-DD\')',
      updatedAt: 'TO_CHAR("case"."updated_at", \'YYYY-MM-DD\')',
      dataAsOf: 'TO_CHAR("case"."data_as_of", \'YYYY-MM-DD\')',
      createdAt: 'TO_CHAR("case"."created_at", \'YYYY-MM-DD\')',
    };

    return mapping[column] || null;
  }

  private applyCaseOptionFilters(
    qb: SelectQueryBuilder<KgaraCase>,
    activeColumn: string,
    filtersStr?: string,
  ) {
    if (!filtersStr) return;

    try {
      const filters = JSON.parse(filtersStr) as Record<string, string[]>;

      for (const [column, values] of Object.entries(filters)) {
        if (column === activeColumn) continue;
        if (!values || values.length === 0) continue;

        const filterExpr = this.getCaseColumnSelectExpr(column);
        if (!filterExpr) continue;

        qb.andWhere(`CAST(${filterExpr} AS TEXT) IN (:...vals_${column})`, {
          [`vals_${column}`]: values,
        });
      }
    } catch {
      // ignore malformed filter payloads
    }
  }

  private applyCaseListFilters(
    qb: SelectQueryBuilder<KgaraCase>,
    filtersStr?: string,
  ) {
    if (!filtersStr) return;

    try {
      const filters = JSON.parse(filtersStr) as Record<string, string[]>;

      for (const [column, values] of Object.entries(filters)) {
        if (!values || values.length === 0) continue;

        const filterExpr = this.getCaseColumnSelectExpr(column);
        if (!filterExpr) continue;

        qb.andWhere(`CAST(${filterExpr} AS TEXT) IN (:...vals_${column})`, {
          [`vals_${column}`]: values,
        });
      }
    } catch {
      // ignore malformed filter payloads
    }
  }

  @Get('cases/gross-profit-report')
  async getGrossProfitReport(
    @BranchId() branchId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const query = this.grossProfitRepo
      .createQueryBuilder('gp')
      .leftJoinAndMapOne(
        'gp.caseData',
        KgaraCase,
        'case',
        'case.soChungTu = gp.vuViecCode',
      );

    if (branchId) {
      query.andWhere('gp.branchExternalId = :branchId', { branchId });
    }

    if (from) {
      query.andWhere('gp.reportFrom >= :from', { from });
    }
    if (to) {
      query.andWhere('gp.reportTo <= :to', { to });
    }

    query.orderBy('gp.updatedAt', 'DESC');

    const results = await query.getMany();

    let totalRevenue = 0;
    let totalCost = 0;
    let totalProfit = 0;

    const items = results.map((gp) => {
      const rev = Number(gp.doanhThu) || 0;
      const cost = Number(gp.chiPhi) || 0;
      const profit = Number(gp.loiNhuan) || 0;

      totalRevenue += rev;
      totalCost += cost;
      totalProfit += profit;

      return {
        id: gp.id,
        createdAt: gp.createdAt,
        updatedAt: gp.updatedAt,
        DoanhThu: rev,
        ChiPhi: cost,
        LoiNhuan: profit,
        VuViecCode: gp.vuViecCode,
        VuViecName: gp.vuViecName,
        TenKhachHang: gp.tenKhachHang,
        VuViecID: gp.hdPhieuDichVuId,
        caseData: (gp as any).caseData,
        ...(gp.rawData as object),
      };
    });

    return {
      results: {
        TongCong: {
          DoanhThu: totalRevenue,
          ChiPhi: totalCost,
          LaiGop: totalProfit,
        },
        Groups: [
          {
            Items: items,
          },
        ],
      },
    };
  }

  @Get('gross-profit/:id/linked-invoices')
  async getGrossProfitLinkedInvoices(@Param('id') id: string) {
    return this.linkedInvoiceRepo.find({
      where: { grossProfitId: id },
      order: { createdAt: 'DESC' },
    });
  }

  @Post('gross-profit/:id/linked-invoices')
  async addGrossProfitLinkedInvoice(
    @Param('id') id: string,
    @Body() body: { invoiceId: string; linkType: 'IN' | 'OUT'; note?: string },
  ) {
    const link = this.linkedInvoiceRepo.create({
      grossProfitId: id,
      invoiceId: body.invoiceId,
      linkType: body.linkType,
      note: body.note,
    });
    return this.linkedInvoiceRepo.save(link);
  }

  @Delete('gross-profit/:id/linked-invoices/:linkedId')
  async removeGrossProfitLinkedInvoice(
    @Param('id') id: string,
    @Param('linkedId') linkedId: string,
  ) {
    await this.linkedInvoiceRepo.delete({ id: linkedId, grossProfitId: id });
    return { success: true };
  }

  @Get('cases/by-code/:code')
  async getCaseByCode(@Param('code') code: string) {
    let caseData = await this.caseRepo.findOne({ where: { soChungTu: code } });
    if (!caseData) {
      throw new NotFoundException(`Case with code ${code} not found`);
    }

    if (
      !caseData.rawData?.ListPhieuDichVuChiTiet &&
      !caseData.rawData?.HoaDonChiTiet
    ) {
      const freshData = await this.client.getCaseDetail(
        caseData.hdPhieuDichVuId,
        caseData.branchExternalId!,
      );
      if (freshData) {
        const payload = freshData.data || freshData;
        caseData.rawData = { ...caseData.rawData, ...payload };
        await this.caseRepo.save(caseData);
      }
    }
    return caseData;
  }

  @Get('cases/by-code/:code/gross-profit')
  async getGrossProfitByCode(@Param('code') code: string) {
    const grossProfit = await this.grossProfitRepo.findOne({
      where: { vuViecCode: code },
    });
    if (!grossProfit) {
      return {
        id: null,
        DoanhThu: 0,
        ChiPhi: 0,
        LoiNhuan: 0,
        VuViecCode: code,
        VuViecName: null,
        VuViecID: null,
      };
    }
    const gp = grossProfit;
    const rev = Number(gp.doanhThu) || 0;
    const cost = Number(gp.chiPhi) || 0;
    const profit = Number(gp.loiNhuan) || 0;
    return {
      id: gp.id,
      createdAt: gp.createdAt,
      updatedAt: gp.updatedAt,
      DoanhThu: rev,
      ChiPhi: cost,
      LoiNhuan: profit,
      VuViecCode: gp.vuViecCode,
      VuViecName: gp.vuViecName,
      TenKhachHang: gp.tenKhachHang,
      VuViecID: gp.hdPhieuDichVuId,
      ...(gp.rawData as object),
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

  @Patch('cases/:id/erp-notes')
  async updateErpNotes(
    @Param('id') id: string,
    @Body() body: { erpNotes: string | null },
  ) {
    const caseData = await this.caseRepo.findOne({ where: { id } });
    if (!caseData) {
      throw new NotFoundException(`Case with id ${id} not found`);
    }
    caseData.erpNotes = body.erpNotes;
    await this.caseRepo.save(caseData);
    return caseData;
  }

  @Get('cases/external/:externalId')
  async getCaseByExternalId(
    @Param('externalId') externalId: string,
    @Query('branchId') branchId?: string,
  ) {
    let caseData = await this.caseRepo.findOne({
      where: { hdPhieuDichVuId: externalId },
    });

    if (!caseData && branchId) {
      await this.syncService.syncCaseDetail(branchId, externalId);
      caseData = await this.caseRepo.findOne({
        where: { hdPhieuDichVuId: externalId },
      });
    }

    if (!caseData) {
      throw new NotFoundException(
        `Case with external id ${externalId} not found`,
      );
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
    const result = await this.syncService.syncCasesForBranch(
      branchId,
      from,
      to,
    );
    return { success: true, message: 'Cases synced successfully.', ...result };
  }

  @Post('sync/gross-profit')
  async syncGrossProfit(
    @BranchId() branchId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!branchId) {
      return { success: false, message: 'Missing x-kgara-branch-id header' };
    }
    await this.syncService.syncGrossProfitForBranch(branchId, from, to);
    return { success: true, message: 'Gross profit synced successfully.' };
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
