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
} from '@nestjs/common';
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
import { BranchId } from '../decorators/branch-id.decorator';

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
        else if (col === 'chiPhi') targetCol = 'case.chiPhi';
        else if (col === 'loiNhuan') targetCol = 'case.loiNhuan';
        else if (col === 'tienCoThue' || col === 'totalAmount')
          targetCol = 'case.tienCoThue';
        else if (col === 'tienDaThanhToan' || col === 'paidAmount')
          targetCol = 'case.tienDaThanhToan';
        else if (col === 'tienConPhaiThanhToan' || col === 'balanceAmount')
          targetCol = 'case.tienConPhaiThanhToan';
        else if (col === 'updatedAt') targetCol = 'case.updatedAt';
        else if (col === 'createdAt') targetCol = 'case.createdAt';
        else if (col === 'classification') targetCol = 'case.classification';

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
    const caseData = await this.caseRepo.findOne({
      where: [{ id }, { soChungTu: id }, { hdPhieuDichVuId: id }],
    });
    if (!caseData) {
      throw new NotFoundException(`Case with id ${id} not found`);
    }
    caseData.erpNotes = body.erpNotes;
    await this.caseRepo.save(caseData);
    return caseData;
  }

  @Patch('cases/:id/config')
  @RequirePermissions({ resource: 'garage', action: 'update' })
  async updateCaseConfig(
    @Param('id') id: string,
    @Body()
    body: {
      classification?: string | null;
      erpNotes?: string | null;
    },
  ) {
    const caseData = await this.caseRepo.findOne({
      where: [{ id }, { soChungTu: id }, { hdPhieuDichVuId: id }],
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

  @Get('cases/external/:externalId')
  @RequirePermissions({ resource: 'garage', action: 'read' })
  async getCaseByExternalId(
    @Param('externalId') externalId: string,
    @BranchId() branchId: string,
  ) {
    let caseData = await this.caseRepo.findOne({
      where: [{ id: externalId }, { hdPhieuDichVuId: externalId }],
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
}
