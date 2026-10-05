import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets, DataSource } from 'typeorm';
import { KgaraCase } from '../entities/kgara_case.entity';
import { KgaraGrossProfit } from '../entities/kgara_gross_profit.entity';
import { KgaraCaseSettlement } from '../entities/kgara_case_settlement.entity';
import { KgaraCaseLinkedInvoice } from '../entities/kgara_case_linked_invoice.entity';
import { extractNetPayableAmount } from '../kgara-sync.service';
import { EntityCustomFieldsHelper } from '../../module-config/helpers/entity-custom-fields.helper';
import {
  getCaseColumnSelectExpr,
  applyCaseOptionFilters,
  applyCaseListFilters,
} from '../helpers/kgara-case-filter.helper';
import {
  applyMultiKeywordFilter,
  applyMultiKeywordMultiFieldFilter,
} from '../../common/utils/query-builder.util';

export interface FindCasesParams {
  branchId?: string;
  page?: string | number;
  pageSize?: string | number;
  q?: string;
  from?: string;
  to?: string;
  filtersStr?: string;
  includeDeleted?: string;
  sorts?: string | string[];
}

export interface CaseColumnOptionsParams {
  branchId?: string;
  column: string;
  search?: string;
  page?: string | number;
  pageSize?: string | number;
  filtersStr?: string;
}

export interface GrossProfitReportParams {
  branchId?: string;
  from?: string;
  to?: string;
}

/**
 * Sub-Service quản lý toàn bộ câu truy vấn Danh sách Vụ việc, Distinct Options & Báo cáo Lãi gộp
 * Tách biệt theo chuẩn /api-service-refactor để giải phóng Controller khỏi logic TypeORM QueryBuilder.
 */
@Injectable()
export class KgaraCaseListQueryService {
  private readonly logger = new Logger(KgaraCaseListQueryService.name);

  constructor(
    @InjectRepository(KgaraCase)
    private readonly caseRepo: Repository<KgaraCase>,
    @InjectRepository(KgaraGrossProfit)
    private readonly grossProfitRepo: Repository<KgaraGrossProfit>,
    @InjectRepository(KgaraCaseSettlement)
    private readonly settlementRepo: Repository<KgaraCaseSettlement>,
    @InjectRepository(KgaraCaseLinkedInvoice)
    private readonly linkedInvoiceRepo: Repository<KgaraCaseLinkedInvoice>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Truy vấn danh sách vụ việc phân trang, tổng hợp thanh toán, hóa đơn liên kết & tính lũy kế
   */
  async findCases(params: FindCasesParams) {
    const {
      branchId,
      page = 1,
      pageSize = 20,
      q = '',
      from,
      to,
      filtersStr,
      includeDeleted,
      sorts,
    } = params;

    const query = this.caseRepo
      .createQueryBuilder('case')
      .leftJoinAndSelect('case.category', 'cat')
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

    applyCaseListFilters(query, filtersStr);

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

    const take = parseInt(String(pageSize), 10) || 20;
    const skip = (parseInt(String(page), 10) - 1 || 0) * take;

    const baseQuery = query.clone();

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

    const currentPage = parseInt(String(page), 10) || 1;
    const totalPages = Math.ceil(total / take) || 1;

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
      const totalsQb = baseQuery.clone();
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
          'COALESCE(SUM(COALESCE("case"."doanh_thu", "gp"."doanh_thu", 0)), 0)',
          'totalRevenue',
        )
        .addSelect(
          'COALESCE(SUM(COALESCE("case"."chi_phi", "gp"."chi_phi", 0)), 0)',
          'totalCost',
        )
        .addSelect(
          'COALESCE(SUM(COALESCE("case"."loi_nhuan", "gp"."loi_nhuan", CASE WHEN "case"."doanh_thu" IS NOT NULL OR "gp"."doanh_thu" IS NOT NULL THEN COALESCE("case"."doanh_thu", "gp"."doanh_thu", 0) - COALESCE("case"."chi_phi", "gp"."chi_phi", 0) ELSE 0 END)), 0)',
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
        const cumQb = baseQuery.clone();
        if (cumQb.expressionMap) {
          cumQb.expressionMap.selects = [];
        }
        cumQb
          .select('COALESCE("case"."doanh_thu", "gp"."doanh_thu", 0)', 'rev')
          .addSelect('COALESCE("case"."chi_phi", "gp"."chi_phi", 0)', 'cost')
          .addSelect(
            'COALESCE("case"."loi_nhuan", "gp"."loi_nhuan", CASE WHEN "case"."doanh_thu" IS NOT NULL OR "gp"."doanh_thu" IS NOT NULL THEN COALESCE("case"."doanh_thu", "gp"."doanh_thu", 0) - COALESCE("case"."chi_phi", "gp"."chi_phi", 0) ELSE 0 END)',
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

    await EntityCustomFieldsHelper.enrichMany(
      this.dataSource,
      'GARAGE_CASE',
      enrichedData,
    );

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

  /**
   * Lấy danh sách Distinct Options cho một cột vụ việc, hỗ trợ tìm kiếm phân tách `;` và exact `""`
   */
  async getCaseColumnOptions(params: CaseColumnOptionsParams) {
    const {
      branchId,
      column,
      search = '',
      page = 1,
      pageSize = 20,
      filtersStr,
    } = params;

    const selectExpr = getCaseColumnSelectExpr(column);
    if (!selectExpr) {
      return { items: [], total: 0, page: 1, totalPages: 0 };
    }

    const safePage = Math.max(parseInt(String(page), 10) || 1, 1);
    const safePageSize = Math.max(parseInt(String(pageSize), 10) || 20, 1);

    if (column === 'caseCode' || column === 'soChungTu') {
      const query = this.caseRepo
        .createQueryBuilder('case')
        .select('"case"."so_chung_tu"', 'value')
        .addSelect('MAX("case"."bien_so_xe")', 'extra');

      if (branchId) {
        query.andWhere('case.branchExternalId = :branchId', { branchId });
      }

      query.andWhere('case.kgaraDeletedAt IS NULL');
      query.andWhere('"case"."so_chung_tu" IS NOT NULL');
      query.andWhere('"case"."so_chung_tu" != \'\'');

      applyCaseOptionFilters(query, column, filtersStr);

      if (search) {
        const cleanSearch = search.replace(/[^a-zA-Z0-9;]/g, '');
        query.andWhere(
          new Brackets((sqb) => {
            applyMultiKeywordMultiFieldFilter(
              sqb,
              ['"case"."so_chung_tu"', '"case"."bien_so_xe"'],
              search,
              'opt_case_search',
            );
            if (
              cleanSearch &&
              cleanSearch.toLowerCase() !== search.toLowerCase()
            ) {
              sqb.orWhere(
                new Brackets((innerSqb) => {
                  applyMultiKeywordFilter(
                    innerSqb,
                    "REGEXP_REPLACE(LOWER(\"case\".\"bien_so_xe\"), '[^a-z0-9]', '', 'g')",
                    cleanSearch.toLowerCase(),
                    'opt_case_search_clean',
                  );
                }),
              );
            }
          }),
        );
      }

      query.groupBy('"case"."so_chung_tu"');
      query.orderBy('value', 'ASC');

      const countQb = query.clone();
      if (countQb.expressionMap) {
        countQb.expressionMap.orderBys = {};
        countQb.expressionMap.groupBys = [];
      }
      countQb.offset?.(undefined);
      countQb.limit?.(undefined);
      const totalRaw = await countQb
        .select('COUNT(DISTINCT "case"."so_chung_tu")', 'cnt')
        .getRawOne();
      const total = parseInt(totalRaw?.cnt || '0', 10);

      const raw = await query
        .offset((safePage - 1) * safePageSize)
        .limit(safePageSize)
        .getRawMany();

      return {
        items: raw.map((r) => {
          const val = String(r.value || '').trim();
          const extra = r.extra ? String(r.extra).trim() : '';
          return {
            value: val,
            label: extra ? `${val} (${extra})` : val,
          };
        }),
        total,
        page: safePage,
        totalPages: Math.ceil(total / safePageSize),
      };
    }

    const query = this.caseRepo
      .createQueryBuilder('case')
      .leftJoin('case.category', 'cat')
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

    applyCaseOptionFilters(query, column, filtersStr);

    if (search) {
      applyMultiKeywordFilter(
        query,
        `CAST(${selectExpr} AS TEXT)`,
        search,
        'opt_search',
      );
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

  /**
   * Báo cáo lợi nhuận gộp theo vụ việc
   */
  async getGrossProfitReport(params: GrossProfitReportParams) {
    const { branchId, from, to } = params;

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
}
