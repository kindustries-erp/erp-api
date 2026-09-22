import {
  Controller,
  Get,
  Patch,
  Query,
  Param,
  Body,
  UseGuards,
  NotFoundException,
  Logger,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiProduces, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { KgaraBranch } from '../entities/kgara_branch.entity';
import { KgaraCase } from '../entities/kgara_case.entity';
import { KgaraGrossProfit } from '../entities/kgara_gross_profit.entity';
import { KgaraCaseSettlement } from '../entities/kgara_case_settlement.entity';
import { KgaraCaseLinkedInvoice } from '../entities/kgara_case_linked_invoice.entity';
import { KgaraClientService } from '../kgara-client.service';
import { KgaraCaseQueryService } from '../services/kgara-case-query.service';
import { extractNetPayableAmount } from '../kgara-sync.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { ErpResource, ErpAction } from '@/rbac-core/enums';
import { BranchId } from '../decorators/branch-id.decorator';

@ApiTags('greenway_cases')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('greenway')
export class KgaraCasesController {
  private readonly logger = new Logger(KgaraCasesController.name);

  constructor(
    @InjectRepository(KgaraBranch)
    private readonly branchRepo: Repository<KgaraBranch>,
    @InjectRepository(KgaraCase)
    private readonly caseRepo: Repository<KgaraCase>,
    @InjectRepository(KgaraGrossProfit)
    private readonly grossProfitRepo: Repository<KgaraGrossProfit>,
    @InjectRepository(KgaraCaseSettlement)
    private readonly settlementRepo: Repository<KgaraCaseSettlement>,
    @InjectRepository(KgaraCaseLinkedInvoice)
    private readonly linkedInvoiceRepo: Repository<KgaraCaseLinkedInvoice>,
    private readonly client: KgaraClientService,
    private readonly caseQueryService: KgaraCaseQueryService,
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

    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const fileName = `Bang_ke_phieu_dich_vu_ket_thuc_${y}${m}${d}_${hh}${mm}${ss}.xlsx`;

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
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
      const fromDate = from.includes('T') ? from : `${from} 00:00:00`;
      query.andWhere('case.ngayPhatSinh >= :fromDate', { fromDate });
    }
    if (to) {
      const toDate = to.includes('T') ? to : `${to} 23:59:59.999`;
      query.andWhere('case.ngayPhatSinh <= :toDate', { toDate });
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

    this.caseQueryService.applyCaseListFilters(query, filtersStr);

    if (sorts) {
      const sortList = Array.isArray(sorts) ? sorts : [sorts];
      let first = true;
      for (const s of sortList) {
        const isDesc = s.startsWith('-');
        const col = isDesc ? s.substring(1) : s;
        const dir: 'ASC' | 'DESC' = isDesc ? 'DESC' : 'ASC';
        const nulls = isDesc ? 'NULLS LAST' : 'NULLS FIRST';

        let targetCol: string | null = null;
        if (col === 'caseDate' || col === 'ngayPhatSinh')
          targetCol = 'case.ngayPhatSinh';
        else if (col === 'ngayTiepNhan') targetCol = 'case.ngayTiepNhan';
        else if (col === 'ngayHoanThanhCongViec' || col === 'completionDate')
          targetCol = 'case.ngayHoanThanhCongViec';
        else if (col === 'soChungTu' || col === 'code' || col === 'caseCode')
          targetCol = 'case.soChungTu';
        else if (col === 'bienSoXe' || col === 'licensePlate')
          targetCol = 'case.bienSoXe';
        else if (col === 'khachHangName' || col === 'customerName')
          targetCol = 'case.khachHangName';
        else if (col === 'khachHangCode' || col === 'customerCode')
          targetCol = 'case.khachHangCode';
        else if (col === 'doanhThu') targetCol = 'case.doanhThu';
        else if (
          col === 'chiPhi' ||
          col === 'costProgress' ||
          col === 'tongPhaiTra' ||
          col === 'totalPayable' ||
          col === 'tienConPhaiChi' ||
          col === 'conPhaiTra' ||
          col === 'remainingPayable'
        )
          targetCol = 'case.chiPhi';
        else if (col === 'loiNhuan') targetCol = 'case.loiNhuan';
        else if (
          col === 'tienCoThue' ||
          col === 'totalAmount' ||
          col === 'collectionProgress' ||
          col === 'tongPhaiThu' ||
          col === 'totalReceivable'
        )
          targetCol = 'case.tienCoThue';
        else if (col === 'tienDaThanhToan' || col === 'paidAmount')
          targetCol = 'case.tienDaThanhToan';
        else if (
          col === 'tienConPhaiThanhToan' ||
          col === 'balanceAmount' ||
          col === 'conPhaiThu' ||
          col === 'remainingReceivable'
        )
          targetCol = 'case.tienConPhaiThanhToan';
        else if (col === 'updatedAt') targetCol = 'case.updatedAt';
        else if (col === 'createdAt') targetCol = 'case.createdAt';
        else if (col === 'classification') targetCol = 'case.classification';
        else if (col === 'kgaraClassification')
          targetCol = 'case.kgaraClassification';
        else if (col === 'kgaraClassificationCode')
          targetCol = 'case.kgaraClassificationCode';

        if (targetCol) {
          if (first) {
            query.orderBy(targetCol, dir, nulls);
            first = false;
          } else {
            query.addOrderBy(targetCol, dir, nulls);
          }
        }
      }
      query.addOrderBy('case.soChungTu', 'DESC');
    } else {
      query
        .orderBy('case.ngayPhatSinh', 'DESC', 'NULLS LAST')
        .addOrderBy('case.ngayTiepNhan', 'DESC', 'NULLS LAST')
        .addOrderBy('case.soChungTu', 'DESC')
        .addOrderBy('case.updatedAt', 'DESC');
    }

    const take = parseInt(pageSize, 10) || 20;
    const skip = (parseInt(page, 10) - 1 || 0) * take;

    query.take(take).skip(skip);

    const [data, total] = await query.getManyAndCount();

    const caseIds = data.map((item) => item.id).filter(Boolean);
    const settlementsMap: Record<
      string,
      { receipts: number; payments: number }
    > = {};
    const linkedInvoiceCounts: Record<
      string,
      { total: number; outCount: number; inCount: number }
    > = {};

    if (caseIds.length > 0) {
      const settlementRows = await this.settlementRepo
        .createQueryBuilder('s')
        .select('s.caseId', 'caseId')
        .addSelect('s.settlementType', 'settlementType')
        .addSelect('SUM(s.amount)', 'totalAmount')
        .where('s.caseId IN (:...caseIds)', { caseIds })
        .groupBy('s.caseId')
        .addGroupBy('s.settlementType')
        .getRawMany();

      for (const row of settlementRows) {
        if (!settlementsMap[row.caseId]) {
          settlementsMap[row.caseId] = { receipts: 0, payments: 0 };
        }
        if (row.settlementType === 'RECEIPT') {
          settlementsMap[row.caseId].receipts += Number(row.totalAmount || 0);
        } else if (row.settlementType === 'PAYMENT') {
          settlementsMap[row.caseId].payments += Number(row.totalAmount || 0);
        }
      }

      const linkRows = await this.linkedInvoiceRepo
        .createQueryBuilder('l')
        .select('l.caseDbId', 'caseId')
        .addSelect('COUNT(*)', 'total')
        .addSelect(
          `SUM(CASE WHEN l.linkType = 'OUT' THEN 1 ELSE 0 END)`,
          'outCount',
        )
        .addSelect(
          `SUM(CASE WHEN l.linkType = 'IN' THEN 1 ELSE 0 END)`,
          'inCount',
        )
        .where('l.caseDbId IN (:...caseIds)', { caseIds })
        .groupBy('l.caseDbId')
        .getRawMany();

      for (const row of linkRows) {
        linkedInvoiceCounts[row.caseId] = {
          total: Number(row.total || 0),
          outCount: Number(row.outCount || 0),
          inCount: Number(row.inCount || 0),
        };
      }
    }

    const enrichedData = data.map((item) => {
      const gp = (item as any).grossProfit;
      const doanhThu = item.doanhThu ?? (gp ? Number(gp.doanhThu) : null);
      const chiPhi = item.chiPhi ?? (gp ? Number(gp.chiPhi) : null);
      const loiNhuan = item.loiNhuan ?? (gp ? Number(gp.loiNhuan) : null);
      const margin =
        doanhThu && Number(doanhThu) > 0 && loiNhuan != null
          ? (Number(loiNhuan) / Number(doanhThu)) * 100
          : null;

      const setInfo = settlementsMap[item.id];
      const hasSettlement = setInfo !== undefined;
      const targetRev = extractNetPayableAmount(item);
      const totalPaid = hasSettlement
        ? setInfo.receipts
        : Number(item.tienDaThanhToan) || 0;
      const remainingBal = Math.max(0, targetRev - totalPaid);
      const paidCost = hasSettlement ? setInfo.payments : 0;
      const linkInfo = linkedInvoiceCounts[item.id];

      return {
        ...item,
        doanhThu,
        chiPhi,
        loiNhuan,
        margin,
        tienCoThue: targetRev,
        tienDaThanhToan: totalPaid,
        tienConPhaiThanhToan: remainingBal,
        tienDaChi: paidCost,
        linkedInvoiceCount: linkInfo?.total || 0,
        linkedInvoiceOutCount: linkInfo?.outCount || 0,
        linkedInvoiceInCount: linkInfo?.inCount || 0,
      };
    });

    const currentPage = parseInt(page, 10) || 1;
    const totalPages = Math.ceil(total / take) || 1;

    // Calculate Grand Totals and Cumulative Totals
    let grandTotalRevenue = 0;
    let grandTotalCost = 0;
    let grandTotalProfit = 0;
    let grandTotalReceivable = 0;
    let grandTotalPaid = 0;
    let grandTotalBalance = 0;
    let grandTotalPaidCost = 0;
    let grandTotalRemainingPayable = 0;

    let cumulativeRevenue = 0;
    let cumulativeCost = 0;
    let cumulativeProfit = 0;
    let cumulativeReceivable = 0;
    let cumulativePaid = 0;
    let cumulativeBalance = 0;
    let cumulativePaidCost = 0;
    let cumulativeRemainingPayable = 0;

    try {
      const totalsQb = query.clone();
      if (totalsQb.expressionMap) {
        totalsQb.expressionMap.orderBys = {};
        totalsQb.expressionMap.selects = [];
      }
      totalsQb.offset?.(undefined);
      totalsQb.limit?.(undefined);
      totalsQb.skip?.(undefined);
      totalsQb.take?.(undefined);

      totalsQb
        .select(
          'COALESCE(SUM(COALESCE("case"."doanh_thu", "gp"."doanh_thu", "case"."tien_co_thue", 0)), 0)',
          'totalRevenue',
        )
        .addSelect(
          'COALESCE(SUM(COALESCE("case"."chi_phi", "gp"."chi_phi", 0)), 0)',
          'totalCost',
        )
        .addSelect(
          'COALESCE(SUM(COALESCE("case"."loi_nhuan", "gp"."loi_nhuan", COALESCE("case"."doanh_thu", "gp"."doanh_thu", "case"."tien_co_thue", 0) - COALESCE("case"."chi_phi", "gp"."chi_phi", 0))), 0)',
          'totalProfit',
        )
        .addSelect(
          'COALESCE(SUM(COALESCE("case"."tien_co_thue", 0)), 0)',
          'totalReceivable',
        )
        .addSelect(
          'COALESCE(SUM(COALESCE("case"."tien_da_thanh_toan", 0)), 0)',
          'totalPaid',
        )
        .addSelect(
          'COALESCE(SUM(COALESCE("case"."tien_con_phai_thanh_toan", 0)), 0)',
          'totalBalance',
        );

      const totalsRaw = await totalsQb.getRawOne();
      grandTotalRevenue = parseFloat(totalsRaw?.totalRevenue || '0') || 0;
      grandTotalCost = parseFloat(totalsRaw?.totalCost || '0') || 0;
      grandTotalProfit = parseFloat(totalsRaw?.totalProfit || '0') || 0;
      grandTotalReceivable = parseFloat(totalsRaw?.totalReceivable || '0') || 0;
      grandTotalPaid = parseFloat(totalsRaw?.totalPaid || '0') || 0;
      grandTotalBalance = parseFloat(totalsRaw?.totalBalance || '0') || 0;
      grandTotalRemainingPayable = Math.max(
        0,
        grandTotalCost - grandTotalPaidCost,
      );

      if (currentPage === 1) {
        cumulativeRevenue = enrichedData.reduce(
          (acc, curr) => acc + (Number(curr.doanhThu) || 0),
          0,
        );
        cumulativeCost = enrichedData.reduce(
          (acc, curr) => acc + (Number(curr.chiPhi) || 0),
          0,
        );
        cumulativeProfit = enrichedData.reduce(
          (acc, curr) => acc + (Number(curr.loiNhuan) || 0),
          0,
        );
        cumulativeReceivable = enrichedData.reduce(
          (acc, curr) => acc + (Number(curr.tienCoThue) || 0),
          0,
        );
        cumulativePaid = enrichedData.reduce(
          (acc, curr) => acc + (Number(curr.tienDaThanhToan) || 0),
          0,
        );
        cumulativeBalance = enrichedData.reduce(
          (acc, curr) => acc + (Number(curr.tienConPhaiThanhToan) || 0),
          0,
        );
        cumulativePaidCost = enrichedData.reduce(
          (acc, curr) => acc + (Number(curr.tienDaChi) || 0),
          0,
        );
        cumulativeRemainingPayable = Math.max(
          0,
          cumulativeCost - cumulativePaidCost,
        );
      } else if (currentPage >= totalPages && totalPages > 0) {
        cumulativeRevenue = grandTotalRevenue;
        cumulativeCost = grandTotalCost;
        cumulativeProfit = grandTotalProfit;
        cumulativeReceivable = grandTotalReceivable;
        cumulativePaid = grandTotalPaid;
        cumulativeBalance = grandTotalBalance;
        cumulativePaidCost = grandTotalPaidCost;
        cumulativeRemainingPayable = grandTotalRemainingPayable;
      } else {
        const cumQb = query.clone();
        if (cumQb.expressionMap) {
          cumQb.expressionMap.selects = [];
        }
        cumQb
          .select(
            'COALESCE("case"."doanh_thu", "gp"."doanh_thu", "case"."tien_co_thue", 0)',
            'rev',
          )
          .addSelect('COALESCE("case"."chi_phi", "gp"."chi_phi", 0)', 'cost')
          .addSelect(
            'COALESCE("case"."loi_nhuan", "gp"."loi_nhuan", COALESCE("case"."doanh_thu", "gp"."doanh_thu", "case"."tien_co_thue", 0) - COALESCE("case"."chi_phi", "gp"."chi_phi", 0))',
            'profit',
          )
          .addSelect('COALESCE("case"."tien_co_thue", 0)', 'receivable')
          .addSelect('COALESCE("case"."tien_da_thanh_toan", 0)', 'paid')
          .addSelect(
            'COALESCE("case"."tien_con_phai_thanh_toan", 0)',
            'balance',
          )
          .offset(0)
          .limit(currentPage * take);
        cumQb.skip?.(undefined);
        cumQb.take?.(undefined);

        const cumRows = await cumQb.getRawMany();
        for (const r of cumRows) {
          cumulativeRevenue += Number(r.rev || 0);
          cumulativeCost += Number(r.cost || 0);
          cumulativeProfit += Number(r.profit || 0);
          cumulativeReceivable += Number(r.receivable || 0);
          cumulativePaid += Number(r.paid || 0);
          cumulativeBalance += Number(r.balance || 0);
        }
        cumulativeRemainingPayable = Math.max(
          0,
          cumulativeCost - cumulativePaidCost,
        );
      }
    } catch (err) {
      this.logger.error('Failed to calculate case query totals', err);
    }

    return {
      data: enrichedData,
      pagination: {
        page: currentPage,
        pageSize: take,
        total,
      },
      totals: {
        grandTotalRevenue,
        grandTotalCost,
        grandTotalProfit,
        grandTotalReceivable,
        grandTotalPaid,
        grandTotalBalance,
        grandTotalRemainingPayable,
        cumulativeRevenue,
        cumulativeCost,
        cumulativeProfit,
        cumulativeReceivable,
        cumulativePaid,
        cumulativeBalance,
        cumulativeRemainingPayable,
      },
    };
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
    const selectExpr = this.caseQueryService.getCaseColumnSelectExpr(column);
    if (!selectExpr) {
      return { items: [], total: 0, page: 1, totalPages: 0 };
    }

    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safePageSize = Math.max(parseInt(pageSize, 10) || 20, 1);

    const query = this.caseRepo
      .createQueryBuilder('case')
      .leftJoin(
        KgaraGrossProfit,
        'gp',
        'gp.hdPhieuDichVuId = case.hdPhieuDichVuId OR gp.vuViecCode = case.soChungTu',
      )
      .select(`DISTINCT ${selectExpr}`, 'value');

    if (branchId) {
      query.andWhere('case.branchExternalId = :branchId', { branchId });
    }

    query.andWhere('case.kgaraDeletedAt IS NULL');
    query.andWhere(`${selectExpr} IS NOT NULL`);
    query.andWhere(`CAST(${selectExpr} AS TEXT) != ''`);

    this.caseQueryService.applyCaseOptionFilters(query, column, filtersStr);

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

  @Get('cases/gross-profit-report')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
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

    query
      .orderBy('case.ngayPhatSinh', 'DESC', 'NULLS LAST')
      .addOrderBy('gp.updatedAt', 'DESC');

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

  @Get('cases/by-code/:code')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
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
        const netPayable = extractNetPayableAmount(payload);
        if (netPayable > 0) {
          caseData.tienCoThue = netPayable;
          const settlements = await this.settlementRepo.find({
            where: { caseId: caseData.id },
          });
          const totalReceipts = settlements
            .filter((s) => s.settlementType === 'RECEIPT')
            .reduce((sum, s) => sum + Number(s.amount || 0), 0);
          caseData.tienDaThanhToan = totalReceipts;
          caseData.tienConPhaiThanhToan = Math.max(
            0,
            netPayable - totalReceipts,
          );
        }
        await this.caseRepo.save(caseData);
      }
    }
    return caseData;
  }

  @Get('cases/by-code/:code/gross-profit')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
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

  @Get('cases/external/:externalId')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  async getCaseByExternalId(
    @Param('externalId') externalId: string,
    @BranchId() branchId: string,
  ) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        externalId,
      );
    const whereConditions = isUuid
      ? [{ id: externalId }, { hdPhieuDichVuId: externalId }]
      : [{ hdPhieuDichVuId: externalId }, { soChungTu: externalId }];

    let caseData = await this.caseRepo.findOne({
      where: whereConditions,
    });
    if (!caseData && branchId) {
      const freshData = await this.client.getCaseDetail(externalId, branchId);
      if (freshData) {
        const payload = freshData.data || freshData;
        caseData = this.caseRepo.create({
          hdPhieuDichVuId: externalId,
          branchExternalId: branchId,
          rawData: payload,
        });
        await this.caseRepo.save(caseData);
      }
    }
    if (!caseData) {
      throw new NotFoundException(
        `Case with externalId ${externalId} not found`,
      );
    }
    return caseData;
  }

  @Get('cases/:id')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  async getCaseById(@Param('id') id: string) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      );
    const whereConditions = isUuid
      ? [{ id }, { soChungTu: id }, { hdPhieuDichVuId: id }]
      : [{ soChungTu: id }, { hdPhieuDichVuId: id }];

    const caseData = await this.caseRepo.findOne({ where: whereConditions });
    if (!caseData) {
      throw new NotFoundException(`Case with id ${id} not found`);
    }
    return caseData;
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
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      );
    const whereConditions = isUuid
      ? [{ id }, { soChungTu: id }, { hdPhieuDichVuId: id }]
      : [{ soChungTu: id }, { hdPhieuDichVuId: id }];

    const caseData = await this.caseRepo.findOne({
      where: whereConditions,
    });
    if (!caseData) {
      throw new NotFoundException(`Case with id ${id} not found`);
    }
    caseData.erpNotes = body.erpNotes;
    await this.caseRepo.save(caseData);
    return caseData;
  }

  @Patch('cases/:id/config')
  @RequirePermissions({
    resource: ErpResource.GARAGE,
    action: ErpAction.UPDATE,
  })
  async updateCaseConfig(
    @Param('id') id: string,
    @Body()
    body: {
      classification?: string | null;
      erpNotes?: string | null;
    },
  ) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      );
    const whereConditions = isUuid
      ? [{ id }, { soChungTu: id }, { hdPhieuDichVuId: id }]
      : [{ soChungTu: id }, { hdPhieuDichVuId: id }];

    const caseData = await this.caseRepo.findOne({
      where: whereConditions,
    });
    if (!caseData) {
      throw new NotFoundException(`Case with id ${id} not found`);
    }
    if (body.classification !== undefined) {
      caseData.classification = body.classification;
    }
    if (body.erpNotes !== undefined) {
      caseData.erpNotes = body.erpNotes;
    }
    await this.caseRepo.save(caseData);
    return caseData;
  }
}
