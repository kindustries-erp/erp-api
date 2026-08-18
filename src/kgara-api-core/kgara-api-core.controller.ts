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
import { KgaraCaseSettlement } from './entities/kgara_case_settlement.entity';
import { KgaraSyncService } from './kgara-sync.service';
import { KgaraClientService } from './kgara-client.service';
import { DocumentTraceabilityService } from '../common/services/document-traceability.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Request as Req } from '@nestjs/common';

@UseGuards(JwtAuthGuard, CoreRbacGuard)
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
    @InjectRepository(KgaraCaseSettlement)
    private settlementRepo: Repository<KgaraCaseSettlement>,
    private syncService: KgaraSyncService,
    private client: KgaraClientService,
    private traceabilityService: DocumentTraceabilityService,
  ) {}

  @Get('branches')
  @RequirePermissions({ resource: 'garage', action: 'read' })
  async getBranches() {
    return this.branchRepo.find({ order: { name: 'ASC' } });
  }

  @Get('cases')
  @RequirePermissions({ resource: 'garage', action: 'read' })
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
    const query = this.caseRepo
      .createQueryBuilder('case')
      .leftJoinAndMapOne(
        'case.grossProfit',
        KgaraGrossProfit,
        'gp',
        'gp.hdPhieuDichVuId = case.hdPhieuDichVuId OR gp.vuViecCode = case.soChungTu',
      );

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

    const enrichedData = data.map((item) => {
      const gp = (item as any).grossProfit;
      const doanhThu = item.doanhThu ?? (gp ? Number(gp.doanhThu) : null);
      const chiPhi = item.chiPhi ?? (gp ? Number(gp.chiPhi) : null);
      const loiNhuan = item.loiNhuan ?? (gp ? Number(gp.loiNhuan) : null);
      const margin =
        doanhThu && Number(doanhThu) > 0 && loiNhuan != null
          ? (Number(loiNhuan) / Number(doanhThu)) * 100
          : null;
      return {
        ...item,
        doanhThu,
        chiPhi,
        loiNhuan,
        margin,
      };
    });

    return {
      data: enrichedData,
      pagination: {
        page: parseInt(page, 10) || 1,
        pageSize: take,
        total,
      },
    };
  }

  @Get('cases/column-options')
  @RequirePermissions({ resource: 'garage', action: 'read' })
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
      ngayHoanThanhCongViec:
        'TO_CHAR("case"."ngay_hoan_thanh_cong_viec", \'YYYY-MM-DD\')',
      completionDate:
        'TO_CHAR("case"."ngay_hoan_thanh_cong_viec", \'YYYY-MM-DD\')',
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
  @RequirePermissions({ resource: 'garage', action: 'read' })
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
  @RequirePermissions({ resource: 'garage', action: 'read' })
  async getGrossProfitLinkedInvoices(@Param('id') id: string) {
    return this.linkedInvoiceRepo.find({
      where: { grossProfitId: id },
      order: { createdAt: 'DESC' },
    });
  }

  @Post('gross-profit/:id/linked-invoices')
  @RequirePermissions({ resource: 'garage', action: 'create' })
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
  @RequirePermissions({ resource: 'garage', action: 'delete' })
  async removeGrossProfitLinkedInvoice(
    @Param('id') id: string,
    @Param('linkedId') linkedId: string,
  ) {
    await this.linkedInvoiceRepo.delete({ id: linkedId, grossProfitId: id });
    return { success: true };
  }

  @Get('cases/by-code/:code')
  @RequirePermissions({ resource: 'garage', action: 'read' })
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
  @RequirePermissions({ resource: 'garage', action: 'read' })
  async getGrossProfitByCode(@Param('code') code: string) {
    const grossProfit = await this.grossProfitRepo.findOne({
      where: { vuViecCode: code },
    });
    if (!grossProfit) {
      const caseData = await this.caseRepo.findOne({
        where: { soChungTu: code },
      });
      if (caseData) {
        const rev = Number(
          caseData.doanhThu ?? caseData.rawData?.DoanhThu ?? 0,
        );
        const cost = Number(caseData.chiPhi ?? caseData.rawData?.ChiPhi ?? 0);
        const profit = Number(
          caseData.loiNhuan ?? caseData.rawData?.LoiNhuan ?? rev - cost,
        );
        const margin = rev > 0 ? Number(((profit / rev) * 100).toFixed(1)) : 0;
        return {
          id: null,
          DoanhThu: rev,
          ChiPhi: cost,
          LoiNhuan: profit,
          BienLoiNhuan: margin,
          VuViecCode: code,
          VuViecName: null,
          VuViecID: caseData.hdPhieuDichVuId,
          ...(caseData.rawData as object),
        };
      }
      return {
        id: null,
        DoanhThu: 0,
        ChiPhi: 0,
        LoiNhuan: 0,
        BienLoiNhuan: 0,
        VuViecCode: code,
        VuViecName: null,
        VuViecID: null,
      };
    }
    const gp = grossProfit;
    const rev = Number(gp.doanhThu) || 0;
    const cost = Number(gp.chiPhi) || 0;
    const profit = Number(gp.loiNhuan) || rev - cost;
    const margin = rev > 0 ? Number(((profit / rev) * 100).toFixed(1)) : 0;
    return {
      id: gp.id,
      createdAt: gp.createdAt,
      updatedAt: gp.updatedAt,
      DoanhThu: rev,
      ChiPhi: cost,
      LoiNhuan: profit,
      BienLoiNhuan: margin,
      VuViecCode: gp.vuViecCode,
      VuViecName: gp.vuViecName,
      TenKhachHang: gp.tenKhachHang,
      VuViecID: gp.hdPhieuDichVuId,
      ...(gp.rawData as object),
    };
  }

  @Get('cases/:id')
  @RequirePermissions({ resource: 'garage', action: 'read' })
  async getCaseById(@Param('id') id: string) {
    const caseData = await this.caseRepo.findOne({ where: { id } });
    if (!caseData) {
      throw new NotFoundException(`Case with id ${id} not found`);
    }
    return caseData;
  }

  @Patch('cases/:id/erp-notes')
  @RequirePermissions({ resource: 'garage', action: 'update' })
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
  @RequirePermissions({ resource: 'garage', action: 'read' })
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
  @RequirePermissions({ resource: 'garage', action: 'create' })
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
  @RequirePermissions({ resource: 'garage', action: 'create' })
  async syncBranches() {
    await this.syncService.syncBranches();
    return { success: true, message: 'Branches synced successfully.' };
  }

  @Post('sync/cases/incremental')
  @RequirePermissions({ resource: 'garage', action: 'create' })
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
  @RequirePermissions({ resource: 'garage', action: 'create' })
  async syncCases(
    @BranchId() branchId: string,
    @Body() body: { from?: string; to?: string },
  ) {
    if (!branchId) {
      return { success: false, message: 'Missing x-kgara-branch-id header' };
    }
    return this.syncService.syncCasesForBranch(branchId, body.from, body.to);
  }

  @Post('sync/gross-profit')
  @RequirePermissions({ resource: 'garage', action: 'create' })
  async syncGrossProfit(
    @BranchId() branchId: string,
    @Body() body: { from?: string; to?: string },
  ) {
    if (!branchId) {
      return { success: false, message: 'Missing x-kgara-branch-id header' };
    }
    return this.syncService.syncGrossProfitForBranch(
      branchId,
      body.from,
      body.to,
    );
  }

  @Post('sync/cases/:id/detail')
  @RequirePermissions({ resource: 'garage', action: 'create' })
  async syncCaseDetail(@Param('id') id: string, @BranchId() branchId: string) {
    if (!branchId) {
      return { success: false, message: 'Missing x-kgara-branch-id header' };
    }
    return this.syncService.syncCaseDetail(branchId, id);
  }

  @Post('sync/receivables')
  @RequirePermissions({ resource: 'garage', action: 'create' })
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
  @RequirePermissions({ resource: 'garage', action: 'create' })
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
  @RequirePermissions({ resource: 'garage', action: 'read' })
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
  @RequirePermissions({ resource: 'garage', action: 'read' })
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
  @RequirePermissions({ resource: 'garage', action: 'read' })
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
  @RequirePermissions({ resource: 'garage', action: 'read' })
  async getReceivables(@BranchId() branchId: string) {
    const where: any = {};
    if (branchId) where.branchExternalId = branchId;
    return this.receivableRepo.find({ where, order: { updatedAt: 'DESC' } });
  }

  @Get('payables')
  @RequirePermissions({ resource: 'garage', action: 'read' })
  async getPayables(@BranchId() branchId: string) {
    const where: any = {};
    if (branchId) where.branchExternalId = branchId;
    return this.payableRepo.find({ where, order: { updatedAt: 'DESC' } });
  }

  @Get('cases/:id/services')
  @RequirePermissions({ resource: 'garage', action: 'read' })
  async getCaseServices(@Param('id') id: string) {
    return this.caseServiceRepo.find({ where: { hdPhieuDichVuId: id } });
  }

  @Get('cases/:id/payments')
  @RequirePermissions({ resource: 'garage', action: 'read' })
  async getCasePayments(@Param('id') id: string) {
    // Return empty array since KGara V2 sync doesn't fetch detailed payment transactions.
    return [];
  }

  @Get('sync-runs')
  @RequirePermissions({ resource: 'garage', action: 'read' })
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
  @RequirePermissions({ resource: 'garage', action: 'read' })
  async getLinkedInvoices(@Param('id') id: string) {
    return this.linkedInvoiceRepo.query(
      `SELECT l.*, 
              i.invoice_no as "invoiceNo", 
              i.seller_name as "sellerName", 
              i.buyer_name as "buyerName",
              i.direction as "direction",
              i.total_amount as "totalAmount",
              i.pre_vat_amount as "preVatAmount",
              i.vat_amount as "vatAmount",
              i.description as "description"
       FROM kgara_case_linked_invoice l
       LEFT JOIN erp_invoices i ON l."invoiceId" = i.id
       WHERE l."caseDbId"::text = $1
       ORDER BY l."createdAt" DESC`,
      [id],
    );
  }

  @Post('cases/:id/linked-invoices')
  @RequirePermissions({ resource: 'garage', action: 'create' })
  async addLinkedInvoice(
    @Param('id') id: string,
    @Body() body: { invoiceId: string; linkType: 'IN' | 'OUT'; note?: string },
  ) {
    const existing = await this.linkedInvoiceRepo.findOne({
      where: { caseDbId: id, invoiceId: body.invoiceId },
    });
    let link = existing;
    if (!existing) {
      link = this.linkedInvoiceRepo.create({
        caseDbId: id,
        invoiceId: body.invoiceId,
        linkType: body.linkType,
        note: body.note,
      });
      link = await this.linkedInvoiceRepo.save(link);
    }

    // Auto-sync: If the case already has ON_SYSTEM settlements matching the linkType direction
    try {
      const isOut = body.linkType === 'OUT';
      const targetSettlementType = isOut ? 'RECEIPT' : 'PAYMENT';
      const settlements = await this.settlementRepo.find({
        where: {
          caseId: id,
          sourceChannel: 'ON_SYSTEM',
          settlementType: targetSettlementType,
        },
      });

      for (const s of settlements) {
        if (s.bankTransactionId) {
          const netOff = await this.settlementRepo.manager.query(
            `SELECT id FROM erp_invoice_voucher_netoff WHERE invoice_id = $1 AND bank_transaction_id = $2 LIMIT 1`,
            [body.invoiceId, s.bankTransactionId],
          );
          if (!netOff || netOff.length === 0) {
            await this.settlementRepo.manager.query(
              `INSERT INTO erp_invoice_voucher_netoff (id, invoice_id, bank_transaction_id, net_off_amount, created_at, updated_at)
               VALUES (gen_random_uuid(), $1, $2, $3, now(), now())`,
              [body.invoiceId, s.bankTransactionId, Number(s.amount || 0)],
            );
          }
        }
      }
    } catch (syncErr) {
      this.logger.warn(
        `Could not sync case settlements to invoice netoff: ${syncErr}`,
      );
    }

    return link;
  }

  @Get('invoices/:invoiceId/linked-cases')
  @RequirePermissions({ resource: 'garage', action: 'read' })
  async getLinkedCases(@Param('invoiceId') invoiceId: string) {
    return this.linkedInvoiceRepo.query(
      `SELECT l.*, 
              c.so_chung_tu as "soChungTu",
              c.bien_so_xe as "bienSoXe",
              c.khach_hang_name as "khachHangName"
       FROM kgara_case_linked_invoice l
       LEFT JOIN kgara_cases c ON l."caseDbId" = c.id
       WHERE l."invoiceId"::text = $1
       ORDER BY l."createdAt" DESC`,
      [invoiceId],
    );
  }

  @Delete('cases/:id/linked-invoices/:linkedId')
  @RequirePermissions({ resource: 'garage', action: 'delete' })
  async removeLinkedInvoice(
    @Param('id') id: string,
    @Param('linkedId') linkedId: string,
  ) {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(linkedId) || !uuidRegex.test(id)) {
      return { success: true, message: 'Ignored non-persisted temporary ID' };
    }

    const link = await this.linkedInvoiceRepo.findOne({
      where: { id: linkedId, caseDbId: id },
    });
    if (link) {
      try {
        const settlements = await this.settlementRepo.find({
          where: { caseId: id, sourceChannel: 'ON_SYSTEM' },
        });
        const txnIds = settlements
          .map((s) => s.bankTransactionId)
          .filter((tid): tid is string => !!tid);
        if (txnIds.length > 0) {
          await this.linkedInvoiceRepo.manager.query(
            `DELETE FROM erp_invoice_voucher_netoff WHERE invoice_id = $1 AND bank_transaction_id = ANY($2::uuid[])`,
            [link.invoiceId, txnIds],
          );
        }
      } catch (delSyncErr) {
        this.logger.warn(`Could not clean up invoice netoff: ${delSyncErr}`);
      }
      await this.linkedInvoiceRepo.delete({ id: linkedId, caseDbId: id });
    }
    return { success: true };
  }

  @Get('cases/:id/traceability-graph')
  @RequirePermissions({ resource: 'garage', action: 'read' })
  async getCaseTraceabilityGraph(@Param('id') id: string, @Req() req: any) {
    return this.traceabilityService.getGarageCaseTraceabilityGraph(
      id,
      req.user,
    );
  }

  @Get('cases/:id/financial-summary')
  @RequirePermissions({ resource: 'garage', action: 'read' })
  async getCaseFinancialSummary(@Param('id') id: string) {
    const c = await this.caseRepo.findOne({
      where: [{ id }, { soChungTu: id }, { hdPhieuDichVuId: id }],
    });
    if (!c) throw new NotFoundException('Không tìm thấy phiếu dịch vụ');

    const gp = await this.grossProfitRepo.findOne({
      where: [
        { hdPhieuDichVuId: c.hdPhieuDichVuId },
        { vuViecCode: c.soChungTu || undefined },
      ],
    });

    const isCompleted = c.tinhTrangDichVu === 3;
    const totalPayable = Number(
      c.tienCoThue ??
        c.rawData?.TongTienThanhToan ??
        c.doanhThu ??
        gp?.doanhThu ??
        0,
    );
    const targetRevenue = totalPayable;
    const targetCost = Number(c.chiPhi ?? gp?.chiPhi ?? 0);
    const expectedProfit = isCompleted
      ? Number(c.loiNhuan ?? gp?.loiNhuan ?? targetRevenue - targetCost)
      : null;

    // Direct Settlements is the single source of truth for cashflow & payments
    const settlements = await this.settlementRepo.find({
      where: { caseId: c.id },
      order: { createdAt: 'DESC' },
    });

    let directReceiptOnSystem = 0;
    let directReceiptOffSystem = 0;
    let directPaymentOnSystem = 0;
    let directPaymentOffSystem = 0;

    for (const s of settlements) {
      const amt = Number(s.amount || 0);
      if (s.settlementType === 'RECEIPT') {
        if (s.sourceChannel === 'ON_SYSTEM') {
          directReceiptOnSystem += amt;
        } else {
          directReceiptOffSystem += amt;
        }
      } else {
        if (s.sourceChannel === 'ON_SYSTEM') {
          directPaymentOnSystem += amt;
        } else {
          directPaymentOffSystem += amt;
        }
      }
    }

    const totalCollected = directReceiptOnSystem + directReceiptOffSystem;
    const remainingReceivable = Math.max(0, targetRevenue - totalCollected);
    const isOverCollected = totalCollected > targetRevenue && targetRevenue > 0;
    const overCollectedAmount = isOverCollected
      ? totalCollected - targetRevenue
      : 0;

    const totalPaid = directPaymentOnSystem + directPaymentOffSystem;
    const remainingPayable = Math.max(0, targetCost - totalPaid);

    const realizedCashProfit = totalCollected - totalPaid;
    const kgaraPaidAmount = Number(c.tienDaThanhToan || 0);
    const reconciliationDiscrepancy = Math.abs(
      kgaraPaidAmount - totalCollected,
    );
    const hasDiscrepancy = reconciliationDiscrepancy > 1000;

    return {
      caseId: c.id,
      soChungTu: c.soChungTu,
      tinhTrangDichVu: c.tinhTrangDichVu,
      tenTinhTrangDichVu: c.tenTinhTrangDichVu,
      isCompleted,
      targetRevenue,
      targetCost,
      expectedProfit,
      breakdown: {
        receipts: {
          directReceiptOnSystem,
          directReceiptOffSystem,
          totalCollected,
          remainingReceivable,
          isOverCollected,
          overCollectedAmount,
        },
        payments: {
          directPaymentOnSystem,
          directPaymentOffSystem,
          totalPaid,
          remainingPayable,
        },
        realizedCashProfit,
      },
      reconciliation: {
        kgaraPaidAmount,
        erpCollectedAmount: totalCollected,
        discrepancy: reconciliationDiscrepancy,
        hasDiscrepancy,
        status: hasDiscrepancy ? 'MISMATCH' : 'MATCHED',
      },
    };
  }

  @Get('cases/:id/settlements')
  @RequirePermissions({ resource: 'garage', action: 'read' })
  async getCaseSettlements(@Param('id') id: string) {
    return this.settlementRepo.query(
      `SELECT s.id::text as "id", 
              s.case_id::text as "caseId",
              s.bank_transaction_id::text as "bankTransactionId",
              s.settlement_type::text as "settlementType",
              s.source_channel::text as "sourceChannel",
              s.category::text as "category",
              s.amount::numeric as "amount",
              s.trans_date as "transDate",
              s.partner_name::text as "partnerName",
              s.note::text as "note",
              s.created_at as "createdAt",
              t.reference_number::text as "referenceNumber",
              t.source_type::text as "sourceType",
              t.correspondent_name::text as "correspondentName",
              b.bank_name::text as "bankName",
              b.account_number::text as "accountNumber",
              c.name::text as "cashBookName"
       FROM kgara_case_settlements s
       LEFT JOIN erp_bank_transactions t ON s.bank_transaction_id = t.id
       LEFT JOIN erp_bank_accounts b ON t.bank_account_id = b.id
       LEFT JOIN erp_cash_books c ON t.cash_book_id = c.id
       WHERE s.case_id::text = $1
       ORDER BY s.created_at DESC`,
      [id],
    );
  }

  @Post('cases/:id/settlements')
  @RequirePermissions({ resource: 'garage', action: 'create' })
  async addCaseSettlement(
    @Param('id') id: string,
    @Body()
    body: {
      bankTransactionId?: string;
      settlementType: 'RECEIPT' | 'PAYMENT';
      sourceChannel?: 'ON_SYSTEM' | 'OFF_SYSTEM_MANUAL';
      category?: string;
      amount: number;
      transDate?: string;
      partnerName?: string;
      note?: string;
    },
  ) {
    const sourceChannel =
      body.sourceChannel ||
      (body.bankTransactionId ? 'ON_SYSTEM' : 'OFF_SYSTEM_MANUAL');

    const settlement = this.settlementRepo.create({
      caseId: id,
      bankTransactionId: body.bankTransactionId || undefined,
      settlementType: body.settlementType,
      sourceChannel,
      category: body.category,
      amount: body.amount,
      transDate: body.transDate,
      partnerName: body.partnerName,
      note: body.note,
    });
    const saved = await this.settlementRepo.save(settlement);

    // Auto-cấn trừ 2 chiều: Nếu giao dịch là ON_SYSTEM (Sao kê ngân hàng / Sổ quỹ)
    // Tự động tìm hóa đơn liên kết của vụ việc có hướng tương ứng và cấn trừ vào Hóa đơn
    if (sourceChannel === 'ON_SYSTEM' && body.bankTransactionId) {
      try {
        const isOut = body.settlementType === 'RECEIPT';
        const targetDirection = isOut ? 'OUT' : 'IN';
        const linkedInvoices = await this.linkedInvoiceRepo.query(
          `SELECT DISTINCT i.id, i.total_amount as "totalAmount"
           FROM erp_invoices i
           LEFT JOIN kgara_case_linked_invoice l ON l."invoiceId" = i.id
           WHERE (l."caseDbId"::text = $1 OR i.settlement_order = $1)
             AND (i.direction = $2 OR l."linkType" = $2)
             AND i.is_deleted = false`,
          [id, targetDirection],
        );

        for (const inv of linkedInvoices) {
          const netOff = await this.settlementRepo.manager.query(
            `SELECT id FROM erp_invoice_voucher_netoff WHERE invoice_id = $1 AND bank_transaction_id = $2 LIMIT 1`,
            [inv.id, body.bankTransactionId],
          );
          if (!netOff || netOff.length === 0) {
            await this.settlementRepo.manager.query(
              `INSERT INTO erp_invoice_voucher_netoff (id, invoice_id, bank_transaction_id, net_off_amount, created_at, updated_at)
               VALUES (gen_random_uuid(), $1, $2, $3, now(), now())`,
              [inv.id, body.bankTransactionId, Number(body.amount || 0)],
            );
          }
        }
      } catch (syncErr) {
        this.logger.warn(
          `Could not sync case settlement to invoice netoff: ${syncErr}`,
        );
      }
    }

    return saved;
  }

  @Delete('cases/:id/settlements/:settlementId')
  @RequirePermissions({ resource: 'garage', action: 'delete' })
  async removeCaseSettlement(
    @Param('id') id: string,
    @Param('settlementId') settlementId: string,
  ) {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(settlementId) || !uuidRegex.test(id)) {
      return { success: true, message: 'Ignored non-persisted temporary ID' };
    }

    const settlement = await this.settlementRepo.findOne({
      where: { id: settlementId, caseId: id },
    });

    if (settlement && settlement.bankTransactionId) {
      try {
        const linkedInvoices = await this.linkedInvoiceRepo.query(
          `SELECT DISTINCT i.id
           FROM erp_invoices i
           LEFT JOIN kgara_case_linked_invoice l ON l."invoiceId" = i.id
           WHERE (l."caseDbId"::text = $1 OR i.settlement_order = $1)
             AND i.is_deleted = false`,
          [id],
        );
        const invIds = linkedInvoices.map((i: any) => i.id).filter(Boolean);
        if (invIds.length > 0) {
          await this.settlementRepo.manager.query(
            `DELETE FROM erp_invoice_voucher_netoff WHERE bank_transaction_id = $1 AND invoice_id = ANY($2::uuid[])`,
            [settlement.bankTransactionId, invIds],
          );
        }
      } catch (delSyncErr) {
        this.logger.warn(
          `Could not clean up invoice netoff on settlement delete: ${delSyncErr}`,
        );
      }
    }

    await this.settlementRepo.delete({ id: settlementId, caseId: id });
    return { success: true };
  }
}
