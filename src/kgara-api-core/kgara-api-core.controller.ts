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
  OnModuleInit,
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
import { Repository, Brackets, SelectQueryBuilder, In } from 'typeorm';
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
import { applyMultiKeywordFilter } from '../common/utils/query-builder.util';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Request as Req } from '@nestjs/common';
import { GarageSmartSettlementService } from './services/garage-smart-settlement.service';

@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('greenway')
export class KgaraApiCoreController implements OnModuleInit {
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
    private smartSettlementService: GarageSmartSettlementService,
  ) {}

  async onModuleInit() {
    try {
      await this.settlementRepo.manager.query(`
        UPDATE kgara_cases c
        SET
          tien_da_thanh_toan = COALESCE(s.total_receipts, 0),
          tien_con_phai_thanh_toan = GREATEST(0, COALESCE(c.tien_co_thue, c.doanh_thu, 0) - COALESCE(s.total_receipts, 0))
        FROM (
          SELECT case_id, SUM(amount) as total_receipts
          FROM kgara_case_settlements
          WHERE settlement_type = 'RECEIPT'
          GROUP BY case_id
        ) s
        WHERE c.id = s.case_id;
      `);
    } catch (e) {
      this.logger.warn(`Initial settlement balance sync: ${e}`);
    }
  }

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

    this.applyCaseListFilters(query, filtersStr);

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
      const targetRev = Number(
        item.tienCoThue ?? item.rawData?.TongTienThanhToan ?? doanhThu ?? 0,
      );
      const totalPaid = hasSettlement
        ? setInfo.receipts
        : Number(item.tienDaThanhToan) || 0;
      const remainingBal = hasSettlement
        ? Math.max(0, targetRev - totalPaid)
        : Number(item.tienConPhaiThanhToan) || 0;
      const paidCost = hasSettlement ? setInfo.payments : 0;

      return {
        ...item,
        doanhThu,
        chiPhi,
        loiNhuan,
        margin,
        tienDaThanhToan: totalPaid,
        tienConPhaiThanhToan: remainingBal,
        tienDaChi: paidCost,
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
      soChungTu: '"case"."so_chung_tu"',
      licensePlate: '"case"."bien_so_xe"',
      bienSoXe: '"case"."bien_so_xe"',
      customerCode: '"case"."khach_hang_code"',
      khachHangCode: '"case"."khach_hang_code"',
      customerName: '"case"."khach_hang_name"',
      khachHangName: '"case"."khach_hang_name"',
      statusName: '"case"."ten_tinh_trang_dich_vu"',
      branchName: '"case"."branch_external_id"',
      branchExternalId: '"case"."branch_external_id"',
      isInsuranceClaim:
        "CASE WHEN COALESCE((\"case\".\"raw_data\" ->> 'XeLamBaoHiem')::boolean, false) THEN 'yes' ELSE 'no' END",
      doanhThu:
        'COALESCE("case"."doanh_thu", "gp"."doanh_thu", "case"."tien_co_thue")',
      chiPhi: 'COALESCE("case"."chi_phi", "gp"."chi_phi")',
      loiNhuan:
        'COALESCE("case"."loi_nhuan", "gp"."loi_nhuan", COALESCE("case"."doanh_thu", "gp"."doanh_thu", "case"."tien_co_thue", 0) - COALESCE("case"."chi_phi", "gp"."chi_phi", 0))',
      margin:
        'CASE WHEN COALESCE("case"."doanh_thu", "gp"."doanh_thu", "case"."tien_co_thue", 0) > 0 THEN ROUND(((COALESCE("case"."loi_nhuan", "gp"."loi_nhuan", COALESCE("case"."doanh_thu", "gp"."doanh_thu", "case"."tien_co_thue", 0) - COALESCE("case"."chi_phi", "gp"."chi_phi", 0)) / COALESCE("case"."doanh_thu", "gp"."doanh_thu", "case"."tien_co_thue")) * 100)::numeric, 1) ELSE 0 END',
      bienLoiNhuan:
        'CASE WHEN COALESCE("case"."doanh_thu", "gp"."doanh_thu", "case"."tien_co_thue", 0) > 0 THEN ROUND(((COALESCE("case"."loi_nhuan", "gp"."loi_nhuan", COALESCE("case"."doanh_thu", "gp"."doanh_thu", "case"."tien_co_thue", 0) - COALESCE("case"."chi_phi", "gp"."chi_phi", 0)) / COALESCE("case"."doanh_thu", "gp"."doanh_thu", "case"."tien_co_thue")) * 100)::numeric, 1) ELSE 0 END',
      totalAmount: '"case"."tien_co_thue"',
      tienCoThue: '"case"."tien_co_thue"',
      paidAmount: '"case"."tien_da_thanh_toan"',
      tienDaThanhToan: '"case"."tien_da_thanh_toan"',
      balanceAmount: '"case"."tien_con_phai_thanh_toan"',
      tienConPhaiThanhToan: '"case"."tien_con_phai_thanh_toan"',
      caseDate:
        'TO_CHAR(COALESCE("case"."ngay_tiep_nhan", "case"."ngay_phat_sinh"), \'YYYY-MM-DD\')',
      ngayPhatSinh: 'TO_CHAR("case"."ngay_phat_sinh", \'YYYY-MM-DD\')',
      ngayTiepNhan:
        'TO_CHAR(COALESCE("case"."ngay_tiep_nhan", "case"."ngay_phat_sinh"), \'YYYY-MM-DD\')',
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

  private applySingleCaseColumnFilter(
    qb: SelectQueryBuilder<KgaraCase>,
    column: string,
    values: string[],
    paramPrefix: string,
  ) {
    if (!values || values.length === 0) return;

    // 0. Xử lý khoảng ngày (Date Range: "YYYY-MM-DD..YYYY-MM-DD" hoặc "YYYY-MM-DD|YYYY-MM-DD")
    if (
      values.length === 1 &&
      (values[0].includes('..') || values[0].includes('|'))
    ) {
      const separator = values[0].includes('..') ? '..' : '|';
      const [fromDate, toDate] = values[0].split(separator);
      const filterExpr = this.getCaseColumnSelectExpr(column);
      if (filterExpr) {
        if (fromDate) {
          qb.andWhere(`${filterExpr} >= :${paramPrefix}_from_date`, {
            [`${paramPrefix}_from_date`]: fromDate,
          });
        }
        if (toDate) {
          qb.andWhere(`${filterExpr} <= :${paramPrefix}_to_date`, {
            [`${paramPrefix}_to_date`]: toDate,
          });
        }
        return;
      }
    }

    // 1. Xử lý __ALL_MATCHING__ (Chọn tất cả kết quả tìm kiếm)
    if (values[0] === '__ALL_MATCHING__') {
      const searchStr = (values[1] || '').trim();
      if (!searchStr) return;
      const filterExpr = this.getCaseColumnSelectExpr(column);
      if (filterExpr) {
        applyMultiKeywordFilter(
          qb,
          `CAST(${filterExpr} AS TEXT)`,
          searchStr,
          `${paramPrefix}_search`,
        );
      }
      return;
    }

    // 2. Cột đặc thù: collectionProgress (Tiến độ thu)
    if (column === 'collectionProgress') {
      const conditions: string[] = [];
      if (values.includes('PAID')) {
        conditions.push(
          '(COALESCE(case.tienConPhaiThanhToan, 0) <= 0 AND COALESCE(case.tienDaThanhToan, 0) > 0)',
        );
      }
      if (values.includes('PARTIAL')) {
        conditions.push(
          '(COALESCE(case.tienDaThanhToan, 0) > 0 AND COALESCE(case.tienConPhaiThanhToan, 0) > 0)',
        );
      }
      if (values.includes('UNPAID')) {
        conditions.push(
          '(COALESCE(case.tienDaThanhToan, 0) <= 0 AND COALESCE(case.tienConPhaiThanhToan, 0) > 0)',
        );
      }
      if (conditions.length > 0) {
        qb.andWhere(`(${conditions.join(' OR ')})`);
      }
      return;
    }

    // 3. Cột đặc thù: costProgress (Tiến độ chi)
    if (column === 'costProgress') {
      const conditions: string[] = [];
      if (values.includes('PAID')) {
        conditions.push(
          "(COALESCE(case.chiPhi, 0) > 0 AND COALESCE(case.chiPhi, 0) <= COALESCE((SELECT SUM(amount) FROM kgara_case_settlements WHERE case_id = case.id AND settlement_type = 'PAYMENT'), 0))",
        );
      }
      if (values.includes('PARTIAL')) {
        conditions.push(
          "(COALESCE((SELECT SUM(amount) FROM kgara_case_settlements WHERE case_id = case.id AND settlement_type = 'PAYMENT'), 0) > 0 AND COALESCE(case.chiPhi, 0) > COALESCE((SELECT SUM(amount) FROM kgara_case_settlements WHERE case_id = case.id AND settlement_type = 'PAYMENT'), 0))",
        );
      }
      if (values.includes('UNPAID')) {
        conditions.push(
          "(COALESCE(case.chiPhi, 0) > 0 AND COALESCE((SELECT SUM(amount) FROM kgara_case_settlements WHERE case_id = case.id AND settlement_type = 'PAYMENT'), 0) <= 0)",
        );
      }
      if (conditions.length > 0) {
        qb.andWhere(`(${conditions.join(' OR ')})`);
      }
      return;
    }

    // 4. Cột đặc thù: margin / bienLoiNhuan (Biên lợi nhuận)
    if (column === 'margin' || column === 'bienLoiNhuan') {
      const marginExpr = `(CASE WHEN COALESCE("case"."doanh_thu", "gp"."doanh_thu", "case"."tien_co_thue", 0) > 0 THEN ((COALESCE("case"."loi_nhuan", "gp"."loi_nhuan", COALESCE("case"."doanh_thu", "gp"."doanh_thu", "case"."tien_co_thue", 0) - COALESCE("case"."chi_phi", "gp"."chi_phi", 0)) / COALESCE("case"."doanh_thu", "gp"."doanh_thu", "case"."tien_co_thue")) * 100) ELSE 0 END)`;

      const conditions: string[] = [];
      const hasBlank = values.includes('__BLANK__');
      const numericVals: number[] = [];

      for (const val of values) {
        if (val === 'HIGH') {
          conditions.push(`${marginExpr} >= 50`);
        } else if (val === 'MID') {
          conditions.push(`(${marginExpr} >= 20 AND ${marginExpr} < 50)`);
        } else if (val === 'LOW') {
          conditions.push(`(${marginExpr} >= 0 AND ${marginExpr} < 20)`);
        } else if (val === 'NEGATIVE') {
          conditions.push(`${marginExpr} < 0`);
        } else if (val !== '__BLANK__') {
          const num = Number(val);
          if (!isNaN(num)) {
            numericVals.push(num);
          }
        }
      }

      if (numericVals.length > 0) {
        conditions.push(
          `ROUND(${marginExpr}::numeric, 1) IN (:...${paramPrefix}_margin_vals)`,
        );
      }

      if (hasBlank) {
        conditions.push(
          `(COALESCE("case"."doanh_thu", "gp"."doanh_thu", "case"."tien_co_thue", 0) <= 0)`,
        );
      }

      if (conditions.length > 0) {
        qb.andWhere(`(${conditions.join(' OR ')})`, {
          [`${paramPrefix}_margin_vals`]: numericVals,
        });
      }
      return;
    }

    // 5. Cột số tiền: doanhThu, chiPhi, loiNhuan
    if (column === 'doanhThu' || column === 'chiPhi' || column === 'loiNhuan') {
      const filterExpr = this.getCaseColumnSelectExpr(column);
      if (!filterExpr) return;

      const hasBlank = values.includes('__BLANK__');
      const realVals = values.filter((v) => v !== '__BLANK__');
      const numericVals = realVals
        .map((v) => Number(v))
        .filter((v) => !isNaN(v));

      const conditions: string[] = [];
      if (hasBlank) {
        conditions.push(`(${filterExpr} IS NULL OR ${filterExpr} = 0)`);
      }
      if (numericVals.length > 0) {
        conditions.push(`${filterExpr} IN (:...${paramPrefix}_num_vals)`);
      }

      if (conditions.length > 0) {
        qb.andWhere(`(${conditions.join(' OR ')})`, {
          [`${paramPrefix}_num_vals`]: numericVals,
        });
      }
      return;
    }

    const filterExpr = this.getCaseColumnSelectExpr(column);
    if (!filterExpr) return;

    // 6. Xử lý __BLANK__ (Lọc giá trị trống / null)
    const hasBlank = values.includes('__BLANK__');
    const realVals = values.filter((v) => v !== '__BLANK__');

    if (hasBlank && realVals.length > 0) {
      qb.andWhere(
        `(${filterExpr} IS NULL OR CAST(${filterExpr} AS TEXT) = '' OR CAST(${filterExpr} AS TEXT) IN (:...${paramPrefix}_vals))`,
        { [`${paramPrefix}_vals`]: realVals },
      );
    } else if (hasBlank) {
      qb.andWhere(
        `(${filterExpr} IS NULL OR CAST(${filterExpr} AS TEXT) = '')`,
      );
    } else {
      qb.andWhere(`CAST(${filterExpr} AS TEXT) IN (:...${paramPrefix}_vals)`, {
        [`${paramPrefix}_vals`]: realVals,
      });
    }
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

        this.applySingleCaseColumnFilter(qb, column, values, `opt_${column}`);
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

        this.applySingleCaseColumnFilter(qb, column, values, `list_${column}`);
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

  // ─── Customer Debt (Grouped from kgara_cases) ───────────────────────────

  @Get('cases/customers-debt')
  @RequirePermissions({ resource: 'garage', action: 'read' })
  async getCustomersDebt(
    @BranchId() branchId: string,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20',
    @Query('q') q: string = '',
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('sorts') sorts?: string | string[],
    @Query('filtersStr') filtersStr?: string,
    @Query('column_filters') columnFiltersParam?: string,
    @Query('column_search') columnSearchParam?: string,
  ) {
    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safePageSize = Math.max(parseInt(pageSize, 10) || 20, 1);

    // Mốc bắt đầu theo dõi công nợ: từ 07/2026 (2026-07-01)
    const baselineDate = '2026-07-01';
    const effectiveFrom = from && from > baselineDate ? from : baselineDate;

    const whereConditions: string[] = [
      '"case"."kgara_deleted_at" IS NULL',
      '("case"."tinh_trang_dich_vu" = 3 OR "case"."ten_tinh_trang_dich_vu" = \'Kết thúc\' OR "case"."ten_tinh_trang_dich_vu" ILIKE \'%kết thúc%\' OR "case"."ten_tinh_trang_dich_vu" ILIKE \'%hoàn tất%\')',
    ];
    const queryParams: any[] = [];

    whereConditions.push(
      `"case"."ngay_phat_sinh" >= $${queryParams.length + 1}`,
    );
    queryParams.push(effectiveFrom);

    if (branchId) {
      whereConditions.push(
        `"case"."branch_external_id" = $${queryParams.length + 1}`,
      );
      queryParams.push(branchId);
    }

    if (to) {
      whereConditions.push(
        `"case"."ngay_phat_sinh" <= $${queryParams.length + 1}`,
      );
      queryParams.push(to);
    }

    if (q) {
      const qIdx = queryParams.length + 1;
      whereConditions.push(
        `("case"."khach_hang_code" ILIKE $${qIdx} OR "case"."khach_hang_name" ILIKE $${qIdx} OR "case"."bien_so_xe" ILIKE $${qIdx} OR "case"."so_chung_tu" ILIKE $${qIdx})`,
      );
      queryParams.push(`%${q}%`);
    }

    const havingConditions: string[] = [];
    const combinedFiltersStr = filtersStr || columnFiltersParam;
    if (combinedFiltersStr) {
      try {
        const filters = JSON.parse(combinedFiltersStr) as Record<
          string,
          string[]
        >;
        for (const [col, values] of Object.entries(filters)) {
          if (!values || values.length === 0) continue;

          // 1. Xử lý __ALL_MATCHING__ (Chọn tất cả kết quả tìm kiếm)
          if (values[0] === '__ALL_MATCHING__') {
            const searchVal = (values[1] || '').trim();
            if (!searchVal) continue; // Nếu không có searchVal thì không lọc (giữ toàn bộ data)
            if (col === 'customerCode') {
              whereConditions.push(
                `"case"."khach_hang_code" ILIKE $${queryParams.length + 1}`,
              );
              queryParams.push(`%${searchVal}%`);
            } else if (col === 'customerName') {
              whereConditions.push(
                `"case"."khach_hang_name" ILIKE $${queryParams.length + 1}`,
              );
              queryParams.push(`%${searchVal}%`);
            } else if (col === 'branchName' || col === 'branchExternalId') {
              whereConditions.push(
                `"case"."branch_external_id" ILIKE $${queryParams.length + 1}`,
              );
              queryParams.push(`%${searchVal}%`);
            }
            continue;
          }

          // 2. Xử lý __BLANK__
          const hasBlank = values.includes('__BLANK__');
          const realVals = values.filter((v) => v !== '__BLANK__');

          if (col === 'customerCode') {
            if (hasBlank && realVals.length > 0) {
              whereConditions.push(
                `("case"."khach_hang_code" IS NULL OR "case"."khach_hang_code" = '' OR "case"."khach_hang_code" = ANY($${queryParams.length + 1}))`,
              );
              queryParams.push(realVals);
            } else if (hasBlank) {
              whereConditions.push(
                `("case"."khach_hang_code" IS NULL OR "case"."khach_hang_code" = '')`,
              );
            } else {
              whereConditions.push(
                `"case"."khach_hang_code" = ANY($${queryParams.length + 1})`,
              );
              queryParams.push(realVals);
            }
          } else if (col === 'customerName') {
            if (hasBlank && realVals.length > 0) {
              whereConditions.push(
                `("case"."khach_hang_name" IS NULL OR "case"."khach_hang_name" = '' OR "case"."khach_hang_name" = ANY($${queryParams.length + 1}))`,
              );
              queryParams.push(realVals);
            } else if (hasBlank) {
              whereConditions.push(
                `("case"."khach_hang_name" IS NULL OR "case"."khach_hang_name" = '')`,
              );
            } else {
              whereConditions.push(
                `"case"."khach_hang_name" = ANY($${queryParams.length + 1})`,
              );
              queryParams.push(realVals);
            }
          } else if (col === 'branchName' || col === 'branchExternalId') {
            if (hasBlank && realVals.length > 0) {
              whereConditions.push(
                `("case"."branch_external_id" IS NULL OR "case"."branch_external_id" = '' OR "case"."branch_external_id" = ANY($${queryParams.length + 1}))`,
              );
              queryParams.push(realVals);
            } else if (hasBlank) {
              whereConditions.push(
                `("case"."branch_external_id" IS NULL OR "case"."branch_external_id" = '')`,
              );
            } else {
              whereConditions.push(
                `"case"."branch_external_id" = ANY($${queryParams.length + 1})`,
              );
              queryParams.push(realVals);
            }
          } else if (col === 'paymentProgress') {
            const subConds: string[] = [];
            if (values.includes('PAID')) {
              subConds.push(
                '(COALESCE(SUM("case"."tien_con_phai_thanh_toan"), 0) <= 0 AND COALESCE(SUM("case"."tien_da_thanh_toan"), 0) > 0)',
              );
            }
            if (values.includes('PARTIAL')) {
              subConds.push(
                '(COALESCE(SUM("case"."tien_da_thanh_toan"), 0) > 0 AND COALESCE(SUM("case"."tien_con_phai_thanh_toan"), 0) > 0)',
              );
            }
            if (values.includes('UNPAID')) {
              subConds.push(
                '(COALESCE(SUM("case"."tien_da_thanh_toan"), 0) <= 0 AND COALESCE(SUM("case"."tien_con_phai_thanh_toan"), 0) > 0)',
              );
            }
            if (subConds.length > 0) {
              havingConditions.push(`(${subConds.join(' OR ')})`);
            }
          } else if (col === 'maxAgingDays') {
            const subConds: string[] = [];
            const maxAgingExpr =
              'COALESCE(MAX(CASE WHEN COALESCE("case"."tien_con_phai_thanh_toan", 0) > 0 THEN CURRENT_DATE - DATE(COALESCE("case"."ngay_phat_sinh", now())) ELSE 0 END), 0)';
            if (values.includes('0-30')) {
              subConds.push(`(${maxAgingExpr} <= 30)`);
            }
            if (values.includes('31-60')) {
              subConds.push(`(${maxAgingExpr} BETWEEN 31 AND 60)`);
            }
            if (values.includes('61-90')) {
              subConds.push(`(${maxAgingExpr} BETWEEN 61 AND 90)`);
            }
            if (values.includes('>90')) {
              subConds.push(`(${maxAgingExpr} > 90)`);
            }
            if (subConds.length > 0) {
              havingConditions.push(`(${subConds.join(' OR ')})`);
            }
          } else if (col === 'caseCount') {
            const numVals = values
              .map((v) => parseInt(v, 10))
              .filter((v) => !isNaN(v));
            if (numVals.length > 0) {
              havingConditions.push(
                `COUNT("case"."id")::int = ANY($${queryParams.length + 1})`,
              );
              queryParams.push(numVals);
            }
          } else if (col === 'totalAmount') {
            const subConds: string[] = [];
            const sumExpr = 'COALESCE(SUM("case"."tien_co_thue"), 0)';
            if (values.includes('0-10m')) {
              subConds.push(`(${sumExpr} < 10000000)`);
            }
            if (values.includes('10m-20m')) {
              subConds.push(`(${sumExpr} BETWEEN 10000000 AND 20000000)`);
            }
            if (values.includes('20m-50m')) {
              subConds.push(`(${sumExpr} BETWEEN 20000000 AND 50000000)`);
            }
            if (values.includes('>50m')) {
              subConds.push(`(${sumExpr} > 50000000)`);
            }
            if (subConds.length > 0) {
              havingConditions.push(`(${subConds.join(' OR ')})`);
            }
          }
        }
      } catch {
        // ignore
      }
    }

    if (columnSearchParam) {
      try {
        const searchObj = JSON.parse(columnSearchParam) as Record<
          string,
          string
        >;
        for (const [col, val] of Object.entries(searchObj)) {
          if (!val || !val.trim()) continue;
          if (col === 'customerCode') {
            whereConditions.push(
              `"case"."khach_hang_code" ILIKE $${queryParams.length + 1}`,
            );
            queryParams.push(`%${val.trim()}%`);
          } else if (col === 'customerName') {
            whereConditions.push(
              `"case"."khach_hang_name" ILIKE $${queryParams.length + 1}`,
            );
            queryParams.push(`%${val.trim()}%`);
          } else if (col === 'branchName' || col === 'branchExternalId') {
            whereConditions.push(
              `"case"."branch_external_id" ILIKE $${queryParams.length + 1}`,
            );
            queryParams.push(`%${val.trim()}%`);
          } else if (col === 'caseCount') {
            const num = parseInt(val.trim(), 10);
            if (!isNaN(num)) {
              havingConditions.push(
                `COUNT("case"."id")::int = $${queryParams.length + 1}`,
              );
              queryParams.push(num);
            }
          } else if (col === 'totalAmount') {
            const cleaned = val.replace(/[^0-9]/g, '');
            const num = parseInt(cleaned, 10);
            if (!isNaN(num) && num > 0) {
              havingConditions.push(
                `COALESCE(SUM("case"."tien_co_thue"), 0)::numeric >= $${queryParams.length + 1}`,
              );
              queryParams.push(num);
            }
          }
        }
      } catch {
        // ignore
      }
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    const havingClause =
      havingConditions.length > 0
        ? `HAVING ${havingConditions.join(' AND ')}`
        : '';

    let summarySql = `
      SELECT
        COUNT(DISTINCT COALESCE("case"."khach_hang_code", 'UNKNOWN'))::int AS total_customers,
        COALESCE(SUM("case"."tien_co_thue"), 0)::numeric AS total_revenue,
        COALESCE(SUM("case"."tien_da_thanh_toan"), 0)::numeric AS total_paid,
        COALESCE(SUM("case"."tien_con_phai_thanh_toan"), 0)::numeric AS total_balance,
        COALESCE(SUM(CASE WHEN COALESCE("case"."tien_con_phai_thanh_toan", 0) > 0 AND (CURRENT_DATE - DATE(COALESCE("case"."ngay_phat_sinh", now()))) <= 30 THEN "case"."tien_con_phai_thanh_toan" ELSE 0 END), 0)::numeric AS total_aging_0_30,
        COALESCE(SUM(CASE WHEN COALESCE("case"."tien_con_phai_thanh_toan", 0) > 0 AND (CURRENT_DATE - DATE(COALESCE("case"."ngay_phat_sinh", now()))) BETWEEN 31 AND 60 THEN "case"."tien_con_phai_thanh_toan" ELSE 0 END), 0)::numeric AS total_aging_31_60,
        COALESCE(SUM(CASE WHEN COALESCE("case"."tien_con_phai_thanh_toan", 0) > 0 AND (CURRENT_DATE - DATE(COALESCE("case"."ngay_phat_sinh", now()))) BETWEEN 61 AND 90 THEN "case"."tien_con_phai_thanh_toan" ELSE 0 END), 0)::numeric AS total_aging_61_90,
        COALESCE(SUM(CASE WHEN COALESCE("case"."tien_con_phai_thanh_toan", 0) > 0 AND (CURRENT_DATE - DATE(COALESCE("case"."ngay_phat_sinh", now()))) > 90 THEN "case"."tien_con_phai_thanh_toan" ELSE 0 END), 0)::numeric AS total_aging_over_90
      FROM "kgara_cases" "case"
      ${whereClause}
    `;

    if (havingConditions.length > 0) {
      summarySql = `
        SELECT
          COUNT(*)::int AS total_customers,
          COALESCE(SUM(tong_doanh_thu), 0)::numeric AS total_revenue,
          COALESCE(SUM(da_thanh_toan), 0)::numeric AS total_paid,
          COALESCE(SUM(con_phai_thu), 0)::numeric AS total_balance,
          COALESCE(SUM(aging_0_30), 0)::numeric AS total_aging_0_30,
          COALESCE(SUM(aging_31_60), 0)::numeric AS total_aging_31_60,
          COALESCE(SUM(aging_61_90), 0)::numeric AS total_aging_61_90,
          COALESCE(SUM(aging_over_90), 0)::numeric AS total_aging_over_90
        FROM (
          SELECT
            COALESCE("case"."khach_hang_code", 'UNKNOWN') AS khach_hang_code,
            COALESCE(SUM("case"."tien_co_thue"), 0)::numeric AS tong_doanh_thu,
            COALESCE(SUM("case"."tien_da_thanh_toan"), 0)::numeric AS da_thanh_toan,
            COALESCE(SUM("case"."tien_con_phai_thanh_toan"), 0)::numeric AS con_phai_thu,
            COALESCE(SUM(CASE WHEN COALESCE("case"."tien_con_phai_thanh_toan", 0) > 0 AND (CURRENT_DATE - DATE(COALESCE("case"."ngay_phat_sinh", now()))) <= 30 THEN "case"."tien_con_phai_thanh_toan" ELSE 0 END), 0)::numeric AS aging_0_30,
            COALESCE(SUM(CASE WHEN COALESCE("case"."tien_con_phai_thanh_toan", 0) > 0 AND (CURRENT_DATE - DATE(COALESCE("case"."ngay_phat_sinh", now()))) BETWEEN 31 AND 60 THEN "case"."tien_con_phai_thanh_toan" ELSE 0 END), 0)::numeric AS aging_31_60,
            COALESCE(SUM(CASE WHEN COALESCE("case"."tien_con_phai_thanh_toan", 0) > 0 AND (CURRENT_DATE - DATE(COALESCE("case"."ngay_phat_sinh", now()))) BETWEEN 61 AND 90 THEN "case"."tien_con_phai_thanh_toan" ELSE 0 END), 0)::numeric AS aging_61_90,
            COALESCE(SUM(CASE WHEN COALESCE("case"."tien_con_phai_thanh_toan", 0) > 0 AND (CURRENT_DATE - DATE(COALESCE("case"."ngay_phat_sinh", now()))) > 90 THEN "case"."tien_con_phai_thanh_toan" ELSE 0 END), 0)::numeric AS aging_over_90
          FROM "kgara_cases" "case"
          ${whereClause}
          GROUP BY COALESCE("case"."khach_hang_code", 'UNKNOWN')
          ${havingClause}
        ) sub
      `;
    }

    const summaryResult = await this.caseRepo.manager.query(
      summarySql,
      queryParams,
    );
    const total = parseInt(summaryResult[0]?.total_customers || '0', 10);

    let orderClause = 'ORDER BY con_phai_thu DESC, ngay_gan_nhat DESC';
    if (sorts) {
      const sortList = Array.isArray(sorts) ? sorts : [sorts];
      const sortParts: string[] = [];
      for (const s of sortList) {
        const isDesc = s.startsWith('-');
        const col = isDesc ? s.substring(1) : s;
        const dir = isDesc ? 'DESC' : 'ASC';
        if (col === 'customerCode') sortParts.push(`khach_hang_code ${dir}`);
        else if (col === 'customerName')
          sortParts.push(`khach_hang_name ${dir}`);
        else if (col === 'branchName' || col === 'branchExternalId')
          sortParts.push(`branch_external_id ${dir}`);
        else if (col === 'totalAmount' || col === 'totalRevenue')
          sortParts.push(`tong_doanh_thu ${dir}`);
        else if (col === 'paidAmount') sortParts.push(`da_thanh_toan ${dir}`);
        else if (col === 'balanceAmount' || col === 'balance')
          sortParts.push(`con_phai_thu ${dir}`);
        else if (col === 'caseCount' || col === 'soPhieu')
          sortParts.push(`so_phieu ${dir}`);
        else if (col === 'maxAgingDays' || col === 'aging')
          sortParts.push(`max_aging_days ${dir}`);
        else if (col === 'latestDate' || col === 'ngayPhatSinh')
          sortParts.push(`ngay_gan_nhat ${dir}`);
      }
      if (sortParts.length > 0) {
        orderClause = `ORDER BY ${sortParts.join(', ')}`;
      }
    }

    const dataParams = [
      ...queryParams,
      safePageSize,
      (safePage - 1) * safePageSize,
    ];
    const limitIdx = dataParams.length - 1;
    const offsetIdx = dataParams.length;

    const dataSql = `
      SELECT
        COALESCE("case"."khach_hang_code", 'UNKNOWN') AS khach_hang_code,
        MAX(COALESCE("case"."khach_hang_name", 'Chưa xác định')) AS khach_hang_name,
        MAX("case"."branch_external_id") AS branch_external_id,
        COUNT("case"."id")::int AS so_phieu,
        COALESCE(SUM("case"."tien_co_thue"), 0)::numeric AS tong_doanh_thu,
        COALESCE(SUM("case"."tien_da_thanh_toan"), 0)::numeric AS da_thanh_toan,
        COALESCE(SUM("case"."tien_con_phai_thanh_toan"), 0)::numeric AS con_phai_thu,
        MAX("case"."ngay_phat_sinh") AS ngay_gan_nhat,
        MIN("case"."ngay_phat_sinh") AS ngay_xa_nhat,
        COALESCE(MAX(CASE WHEN COALESCE("case"."tien_con_phai_thanh_toan", 0) > 0 THEN CURRENT_DATE - DATE(COALESCE("case"."ngay_phat_sinh", now())) ELSE 0 END), 0)::int AS max_aging_days,
        COALESCE(SUM(CASE WHEN COALESCE("case"."tien_con_phai_thanh_toan", 0) > 0 AND (CURRENT_DATE - DATE(COALESCE("case"."ngay_phat_sinh", now()))) <= 30 THEN "case"."tien_con_phai_thanh_toan" ELSE 0 END), 0)::numeric AS aging_0_30,
        COALESCE(SUM(CASE WHEN COALESCE("case"."tien_con_phai_thanh_toan", 0) > 0 AND (CURRENT_DATE - DATE(COALESCE("case"."ngay_phat_sinh", now()))) BETWEEN 31 AND 60 THEN "case"."tien_con_phai_thanh_toan" ELSE 0 END), 0)::numeric AS aging_31_60,
        COALESCE(SUM(CASE WHEN COALESCE("case"."tien_con_phai_thanh_toan", 0) > 0 AND (CURRENT_DATE - DATE(COALESCE("case"."ngay_phat_sinh", now()))) BETWEEN 61 AND 90 THEN "case"."tien_con_phai_thanh_toan" ELSE 0 END), 0)::numeric AS aging_61_90,
        COALESCE(SUM(CASE WHEN COALESCE("case"."tien_con_phai_thanh_toan", 0) > 0 AND (CURRENT_DATE - DATE(COALESCE("case"."ngay_phat_sinh", now()))) > 90 THEN "case"."tien_con_phai_thanh_toan" ELSE 0 END), 0)::numeric AS aging_over_90
      FROM "kgara_cases" "case"
      ${whereClause}
      GROUP BY COALESCE("case"."khach_hang_code", 'UNKNOWN')
      ${havingClause}
      ${orderClause}
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const rawRows = await this.caseRepo.manager.query(dataSql, dataParams);

    const formattedData = rawRows.map((r: any) => ({
      customerCode: r.khach_hang_code,
      customerName: r.khach_hang_name,
      branchExternalId: r.branch_external_id,
      caseCount: Number(r.so_phieu) || 0,
      totalAmount: Number(r.tong_doanh_thu) || 0,
      paidAmount: Number(r.da_thanh_toan) || 0,
      balanceAmount: Number(r.con_phai_thu) || 0,
      latestDate: r.ngay_gan_nhat,
      oldestDate: r.ngay_xa_nhat,
      maxAgingDays: Number(r.max_aging_days) || 0,
      aging0_30: Number(r.aging_0_30) || 0,
      aging31_60: Number(r.aging_31_60) || 0,
      aging61_90: Number(r.aging_61_90) || 0,
      agingOver90: Number(r.aging_over_90) || 0,
    }));

    return {
      data: formattedData,
      total,
      page: safePage,
      pageSize: safePageSize,
      totalPages: Math.ceil(total / safePageSize),
      summary: {
        totalRevenue: Number(summaryResult[0]?.total_revenue) || 0,
        totalPaid: Number(summaryResult[0]?.total_paid) || 0,
        totalBalance: Number(summaryResult[0]?.total_balance) || 0,
        totalAging0_30: Number(summaryResult[0]?.total_aging_0_30) || 0,
        totalAging31_60: Number(summaryResult[0]?.total_aging_31_60) || 0,
        totalAging61_90: Number(summaryResult[0]?.total_aging_61_90) || 0,
        totalAgingOver90: Number(summaryResult[0]?.total_aging_over_90) || 0,
      },
    };
  }

  @Get('cases/customers-debt/column-options')
  @RequirePermissions({ resource: 'garage', action: 'read' })
  async getCustomersDebtColumnOptions(
    @BranchId() branchId: string,
    @Query('column') column: string,
    @Query('search') search: string = '',
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20',
    @Query('filtersStr') filtersStr?: string,
  ) {
    if (column === 'paymentProgress') {
      const options = ['PAID', 'PARTIAL', 'UNPAID'];
      const filtered = search
        ? options.filter((opt) =>
            opt.toLowerCase().includes(search.toLowerCase()),
          )
        : options;
      return {
        items: filtered,
        total: filtered.length,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      };
    }
    if (column === 'maxAgingDays') {
      const options = ['0-30', '31-60', '61-90', '>90'];
      const filtered = search
        ? options.filter((opt) =>
            opt.toLowerCase().includes(search.toLowerCase()),
          )
        : options;
      return {
        items: filtered,
        total: filtered.length,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      };
    }
    if (column === 'caseCount') {
      const branchCond = branchId
        ? `AND "branch_external_id" = '${branchId.replace(/'/g, "''")}'`
        : '';
      const rawCounts = await this.caseRepo.manager.query(`
        SELECT so_phieu::text AS value FROM (
          SELECT COUNT("id") AS so_phieu
          FROM "kgara_cases"
          WHERE "kgara_deleted_at" IS NULL
            AND ("tinh_trang_dich_vu" = 3 OR "ten_tinh_trang_dich_vu" = 'Kết thúc' OR "ten_tinh_trang_dich_vu" ILIKE '%kết thúc%' OR "ten_tinh_trang_dich_vu" ILIKE '%hoàn tất%')
            AND "ngay_phat_sinh" >= '2026-07-01'
            ${branchCond}
          GROUP BY COALESCE("khach_hang_code", 'UNKNOWN')
        ) sub
        GROUP BY so_phieu
        ORDER BY so_phieu ASC
      `);
      const items = rawCounts.map((r: any) => String(r.value));
      const filtered = search
        ? items.filter((it: string) => it.includes(search))
        : items;
      return {
        items: filtered,
        total: filtered.length,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      };
    }
    if (column === 'totalAmount') {
      const options = [
        { label: '< 10.000.000 đ', value: '0-10m' },
        { label: '10.000.000 - 20.000.000 đ', value: '10m-20m' },
        { label: '20.000.000 - 50.000.000 đ', value: '20m-50m' },
        { label: '> 50.000.000 đ', value: '>50m' },
      ];
      const filtered = search
        ? options.filter((opt) =>
            opt.label.toLowerCase().includes(search.toLowerCase()),
          )
        : options;
      return {
        items: filtered.map((f) => f.value),
        total: filtered.length,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      };
    }

    let selectExpr = '"case"."khach_hang_code"';
    if (column === 'customerName') selectExpr = '"case"."khach_hang_name"';
    else if (column === 'customerCode') selectExpr = '"case"."khach_hang_code"';
    else if (column === 'branchName' || column === 'branchExternalId')
      selectExpr = '"case"."branch_external_id"';

    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safePageSize = Math.max(parseInt(pageSize, 10) || 20, 1);

    const query = this.caseRepo
      .createQueryBuilder('case')
      .select(`DISTINCT ${selectExpr}`, 'value');

    if (branchId) {
      query.andWhere('case.branchExternalId = :branchId', { branchId });
    }
    query.andWhere('case.kgaraDeletedAt IS NULL');
    query.andWhere(
      '(case.tinhTrangDichVu = 3 OR case.tenTinhTrangDichVu = :stFinished OR case.tenTinhTrangDichVu ILIKE :stFinPattern OR case.tenTinhTrangDichVu ILIKE :stDonePattern)',
      {
        stFinished: 'Kết thúc',
        stFinPattern: '%kết thúc%',
        stDonePattern: '%hoàn tất%',
      },
    );
    query.andWhere('case.ngayPhatSinh >= :baselineDate', {
      baselineDate: '2026-07-01',
    });
    query.andWhere(`${selectExpr} IS NOT NULL`);
    query.andWhere(`CAST(${selectExpr} AS TEXT) != ''`);

    if (filtersStr) {
      try {
        const filters = JSON.parse(filtersStr) as Record<string, string[]>;
        for (const [col, values] of Object.entries(filters)) {
          if (col === column) continue;
          if (!values || values.length === 0) continue;

          if (values[0] === '__ALL_MATCHING__') {
            const searchVal = (values[1] || '').trim();
            if (!searchVal) continue;
            if (col === 'customerCode') {
              query.andWhere('case.khachHangCode ILIKE :ccSearch', {
                ccSearch: `%${searchVal}%`,
              });
            } else if (col === 'customerName') {
              query.andWhere('case.khachHangName ILIKE :cnSearch', {
                cnSearch: `%${searchVal}%`,
              });
            } else if (col === 'branchName' || col === 'branchExternalId') {
              query.andWhere('case.branchExternalId ILIKE :brSearch', {
                brSearch: `%${searchVal}%`,
              });
            }
            continue;
          }

          const hasBlank = values.includes('__BLANK__');
          const realVals = values.filter((v) => v !== '__BLANK__');

          if (col === 'customerCode') {
            if (hasBlank && realVals.length > 0) {
              query.andWhere(
                "(case.khachHangCode IS NULL OR case.khachHangCode = '' OR case.khachHangCode IN (:...ccVals))",
                { ccVals: realVals },
              );
            } else if (hasBlank) {
              query.andWhere(
                "(case.khachHangCode IS NULL OR case.khachHangCode = '')",
              );
            } else {
              query.andWhere('case.khachHangCode IN (:...ccVals)', {
                ccVals: realVals,
              });
            }
          } else if (col === 'customerName') {
            if (hasBlank && realVals.length > 0) {
              query.andWhere(
                "(case.khachHangName IS NULL OR case.khachHangName = '' OR case.khachHangName IN (:...cnVals))",
                { cnVals: realVals },
              );
            } else if (hasBlank) {
              query.andWhere(
                "(case.khachHangName IS NULL OR case.khachHangName = '')",
              );
            } else {
              query.andWhere('case.khachHangName IN (:...cnVals)', {
                cnVals: realVals,
              });
            }
          } else if (col === 'branchName' || col === 'branchExternalId') {
            if (hasBlank && realVals.length > 0) {
              query.andWhere(
                "(case.branchExternalId IS NULL OR case.branchExternalId = '' OR case.branchExternalId IN (:...brVals))",
                { brVals: realVals },
              );
            } else if (hasBlank) {
              query.andWhere(
                "(case.branchExternalId IS NULL OR case.branchExternalId = '')",
              );
            } else {
              query.andWhere('case.branchExternalId IN (:...brVals)', {
                brVals: realVals,
              });
            }
          }
        }
      } catch {
        // ignore
      }
    }

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

  @Get('cases/by-customer/:customerCode')
  @RequirePermissions({ resource: 'garage', action: 'read' })
  async getCasesByCustomer(
    @BranchId() branchId: string,
    @Param('customerCode') customerCode: string,
  ) {
    const query = this.caseRepo
      .createQueryBuilder('case')
      .where('case.kgaraDeletedAt IS NULL')
      .andWhere(
        '(case.tinhTrangDichVu = 3 OR case.tenTinhTrangDichVu = :stFinished OR case.tenTinhTrangDichVu ILIKE :stFinPattern OR case.tenTinhTrangDichVu ILIKE :stDonePattern)',
        {
          stFinished: 'Kết thúc',
          stFinPattern: '%kết thúc%',
          stDonePattern: '%hoàn tất%',
        },
      )
      .andWhere('case.ngayPhatSinh >= :baselineDate', {
        baselineDate: '2026-07-01',
      });

    if (customerCode === 'UNKNOWN' || customerCode === 'NO_CODE') {
      query.andWhere('case.khachHangCode IS NULL');
    } else {
      query.andWhere('case.khachHangCode = :customerCode', { customerCode });
    }

    if (branchId) {
      query.andWhere('case.branchExternalId = :branchId', { branchId });
    }

    query.orderBy('case.ngayPhatSinh', 'DESC');

    const cases = await query.getMany();

    const caseIds = cases.map((item) => item.id).filter(Boolean);
    const settlementsMap: Record<
      string,
      { receipts: number; payments: number }
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
    }

    const enriched = cases.map((c) => {
      const pDate = c.ngayPhatSinh ? new Date(c.ngayPhatSinh) : null;
      const today = new Date();
      let agingDays = 0;
      if (pDate) {
        const diffTime = Math.abs(today.getTime() - pDate.getTime());
        agingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
      const setInfo = settlementsMap[c.id];
      const hasSettlement = setInfo !== undefined;
      const targetRev = Number(
        c.tienCoThue ?? c.rawData?.TongTienThanhToan ?? c.doanhThu ?? 0,
      );
      const totalPaid = hasSettlement
        ? setInfo.receipts
        : Number(c.tienDaThanhToan) || 0;
      const remainingBal = hasSettlement
        ? Math.max(0, targetRev - totalPaid)
        : Number(c.tienConPhaiThanhToan) || 0;

      return {
        ...c,
        agingDays,
        tienCoThue: Number(c.tienCoThue) || 0,
        tienDaThanhToan: totalPaid,
        tienConPhaiThanhToan: remainingBal,
      };
    });

    return enriched;
  }

  // ─── Supplier Debt (Grouped from kgara_payables) ─────────────────────────

  @Get('payables/suppliers-debt')
  @RequirePermissions({ resource: 'garage', action: 'read' })
  async getSuppliersDebt(
    @BranchId() branchId: string,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20',
    @Query('q') q: string = '',
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('sorts') sorts?: string | string[],
    @Query('filtersStr') filtersStr?: string,
    @Query('column_filters') columnFiltersParam?: string,
    @Query('column_search') columnSearchParam?: string,
  ) {
    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safePageSize = Math.max(parseInt(pageSize, 10) || 20, 1);

    // Mốc bắt đầu theo dõi: từ 07/2026 (2026-07-01)
    const baselineDate = '2026-07-01';
    const effectiveFrom = from && from > baselineDate ? from : baselineDate;

    const whereConditions: string[] = [
      `COALESCE("p"."period_to", "p"."period_from", "p"."created_at"::date) >= $1`,
    ];
    const queryParams: any[] = [effectiveFrom];

    if (branchId) {
      whereConditions.push(
        `"p"."branch_external_id" = $${queryParams.length + 1}`,
      );
      queryParams.push(branchId);
    }

    if (to) {
      whereConditions.push(
        `COALESCE("p"."period_from", "p"."period_to") <= $${queryParams.length + 1}`,
      );
      queryParams.push(to);
    }

    if (q) {
      const qIdx = queryParams.length + 1;
      whereConditions.push(
        `("p"."ma_so_doi_tac" ILIKE $${qIdx} OR "p"."ten_doi_tac" ILIKE $${qIdx} OR "p"."doi_tac_id" ILIKE $${qIdx} OR "p"."ma_so_vu_viec" ILIKE $${qIdx})`,
      );
      queryParams.push(`%${q}%`);
    }

    const combinedFiltersStr = filtersStr || columnFiltersParam;
    if (combinedFiltersStr) {
      try {
        const filters = JSON.parse(combinedFiltersStr) as Record<
          string,
          string[]
        >;
        for (const [col, values] of Object.entries(filters)) {
          if (!values || values.length === 0) continue;
          if (col === 'supplierCode' || col === 'maSoDoiTac') {
            whereConditions.push(
              `"p"."ma_so_doi_tac" = ANY($${queryParams.length + 1})`,
            );
            queryParams.push(values);
          } else if (col === 'supplierName' || col === 'tenDoiTac') {
            whereConditions.push(
              `"p"."ten_doi_tac" = ANY($${queryParams.length + 1})`,
            );
            queryParams.push(values);
          } else if (col === 'accountCode' || col === 'maSoTaiKhoan') {
            whereConditions.push(
              `"p"."ma_so_tai_khoan" = ANY($${queryParams.length + 1})`,
            );
            queryParams.push(values);
          }
        }
      } catch {
        // ignore
      }
    }

    if (columnSearchParam) {
      try {
        const searchObj = JSON.parse(columnSearchParam) as Record<
          string,
          string
        >;
        for (const [col, val] of Object.entries(searchObj)) {
          if (!val || !val.trim()) continue;
          if (col === 'supplierCode' || col === 'maSoDoiTac') {
            whereConditions.push(
              `"p"."ma_so_doi_tac" ILIKE $${queryParams.length + 1}`,
            );
            queryParams.push(`%${val.trim()}%`);
          } else if (col === 'supplierName' || col === 'tenDoiTac') {
            whereConditions.push(
              `"p"."ten_doi_tac" ILIKE $${queryParams.length + 1}`,
            );
            queryParams.push(`%${val.trim()}%`);
          }
        }
      } catch {
        // ignore
      }
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    const summarySql = `
      SELECT
        COUNT(DISTINCT "p"."doi_tac_id")::int AS total_suppliers,
        COALESCE(SUM("p"."ps_no"), 0)::numeric AS total_ps_no,
        COALESCE(SUM("p"."ps_co"), 0)::numeric AS total_ps_co,
        COALESCE(SUM("p"."ck_co"), 0)::numeric AS total_ck_co,
        COALESCE(SUM("p"."ck_no"), 0)::numeric AS total_ck_no,
        COALESCE(SUM(COALESCE("p"."ck_co", 0) - COALESCE("p"."ck_no", 0)), 0)::numeric AS total_balance,
        COALESCE(SUM(CASE WHEN (COALESCE("p"."ck_co", 0) - COALESCE("p"."ck_no", 0)) > 0 AND (CURRENT_DATE - DATE(COALESCE("p"."period_to", "p"."period_from", now()))) <= 30 THEN (COALESCE("p"."ck_co", 0) - COALESCE("p"."ck_no", 0)) ELSE 0 END), 0)::numeric AS total_aging_0_30,
        COALESCE(SUM(CASE WHEN (COALESCE("p"."ck_co", 0) - COALESCE("p"."ck_no", 0)) > 0 AND (CURRENT_DATE - DATE(COALESCE("p"."period_to", "p"."period_from", now()))) BETWEEN 31 AND 60 THEN (COALESCE("p"."ck_co", 0) - COALESCE("p"."ck_no", 0)) ELSE 0 END), 0)::numeric AS total_aging_31_60,
        COALESCE(SUM(CASE WHEN (COALESCE("p"."ck_co", 0) - COALESCE("p"."ck_no", 0)) > 0 AND (CURRENT_DATE - DATE(COALESCE("p"."period_to", "p"."period_from", now()))) BETWEEN 61 AND 90 THEN (COALESCE("p"."ck_co", 0) - COALESCE("p"."ck_no", 0)) ELSE 0 END), 0)::numeric AS total_aging_61_90,
        COALESCE(SUM(CASE WHEN (COALESCE("p"."ck_co", 0) - COALESCE("p"."ck_no", 0)) > 0 AND (CURRENT_DATE - DATE(COALESCE("p"."period_to", "p"."period_from", now()))) > 90 THEN (COALESCE("p"."ck_co", 0) - COALESCE("p"."ck_no", 0)) ELSE 0 END), 0)::numeric AS total_aging_over_90
      FROM "kgara_payables" "p"
      ${whereClause}
    `;

    const summaryResult = await this.payableRepo.manager.query(
      summarySql,
      queryParams,
    );
    const total = parseInt(summaryResult[0]?.total_suppliers || '0', 10);

    let orderClause = 'ORDER BY balance_amount DESC';
    if (sorts) {
      const sortList = Array.isArray(sorts) ? sorts : [sorts];
      const sortParts: string[] = [];
      for (const s of sortList) {
        const isDesc = s.startsWith('-');
        const col = isDesc ? s.substring(1) : s;
        const dir = isDesc ? 'DESC' : 'ASC';
        if (col === 'supplierCode' || col === 'maSoDoiTac')
          sortParts.push(`ma_so_doi_tac ${dir}`);
        else if (col === 'supplierName' || col === 'tenDoiTac')
          sortParts.push(`ten_doi_tac ${dir}`);
        else if (col === 'balance' || col === 'balanceAmount')
          sortParts.push(`balance_amount ${dir}`);
        else if (col === 'psNo') sortParts.push(`ps_no ${dir}`);
        else if (col === 'psCo') sortParts.push(`ps_co ${dir}`);
        else if (col === 'maxAgingDays' || col === 'aging')
          sortParts.push(`max_aging_days ${dir}`);
        else if (col === 'caseCount' || col === 'soVuViec')
          sortParts.push(`so_vu_viec ${dir}`);
      }
      if (sortParts.length > 0) {
        orderClause = `ORDER BY ${sortParts.join(', ')}`;
      }
    }

    const dataParams = [
      ...queryParams,
      safePageSize,
      (safePage - 1) * safePageSize,
    ];
    const limitIdx = dataParams.length - 1;
    const offsetIdx = dataParams.length;

    const dataSql = `
      SELECT
        "p"."doi_tac_id",
        MAX(COALESCE("p"."ma_so_doi_tac", '')) AS ma_so_doi_tac,
        MAX(COALESCE("p"."ten_doi_tac", 'Chưa xác định')) AS ten_doi_tac,
        MAX(COALESCE("p"."ma_so_tai_khoan", '331')) AS ma_so_tai_khoan,
        MAX(COALESCE("p"."ten_tai_khoan", 'Phải trả người bán')) AS ten_tai_khoan,
        MAX(COALESCE("p"."ma_so_tien_te", 'VND')) AS ma_so_tien_te,
        COUNT(DISTINCT NULLIF("p"."ma_so_vu_viec", ''))::int AS so_vu_viec,
        COALESCE(SUM("p"."dk_no"), 0)::numeric AS dk_no,
        COALESCE(SUM("p"."dk_co"), 0)::numeric AS dk_co,
        COALESCE(SUM("p"."ps_no"), 0)::numeric AS ps_no,
        COALESCE(SUM("p"."ps_co"), 0)::numeric AS ps_co,
        COALESCE(SUM("p"."ck_no"), 0)::numeric AS ck_no,
        COALESCE(SUM("p"."ck_co"), 0)::numeric AS ck_co,
        COALESCE(SUM(COALESCE("p"."ck_co", 0) - COALESCE("p"."ck_no", 0)), 0)::numeric AS balance_amount,
        MIN("p"."period_from") AS period_from,
        MAX("p"."period_to") AS period_to,
        COALESCE(MAX(CASE WHEN (COALESCE("p"."ck_co", 0) - COALESCE("p"."ck_no", 0)) > 0 THEN CURRENT_DATE - DATE(COALESCE("p"."period_to", "p"."period_from", now())) ELSE 0 END), 0)::int AS max_aging_days,
        COALESCE(SUM(CASE WHEN (COALESCE("p"."ck_co", 0) - COALESCE("p"."ck_no", 0)) > 0 AND (CURRENT_DATE - DATE(COALESCE("p"."period_to", "p"."period_from", now()))) <= 30 THEN (COALESCE("p"."ck_co", 0) - COALESCE("p"."ck_no", 0)) ELSE 0 END), 0)::numeric AS aging_0_30,
        COALESCE(SUM(CASE WHEN (COALESCE("p"."ck_co", 0) - COALESCE("p"."ck_no", 0)) > 0 AND (CURRENT_DATE - DATE(COALESCE("p"."period_to", "p"."period_from", now()))) BETWEEN 31 AND 60 THEN (COALESCE("p"."ck_co", 0) - COALESCE("p"."ck_no", 0)) ELSE 0 END), 0)::numeric AS aging_31_60,
        COALESCE(SUM(CASE WHEN (COALESCE("p"."ck_co", 0) - COALESCE("p"."ck_no", 0)) > 0 AND (CURRENT_DATE - DATE(COALESCE("p"."period_to", "p"."period_from", now()))) BETWEEN 61 AND 90 THEN (COALESCE("p"."ck_co", 0) - COALESCE("p"."ck_no", 0)) ELSE 0 END), 0)::numeric AS aging_61_90,
        COALESCE(SUM(CASE WHEN (COALESCE("p"."ck_co", 0) - COALESCE("p"."ck_no", 0)) > 0 AND (CURRENT_DATE - DATE(COALESCE("p"."period_to", "p"."period_from", now()))) > 90 THEN (COALESCE("p"."ck_co", 0) - COALESCE("p"."ck_no", 0)) ELSE 0 END), 0)::numeric AS aging_over_90
      FROM "kgara_payables" "p"
      ${whereClause}
      GROUP BY "p"."doi_tac_id"
      ${orderClause}
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const rawRows = await this.payableRepo.manager.query(dataSql, dataParams);

    const formattedData = rawRows.map((r: any) => ({
      supplierId: r.doi_tac_id,
      supplierCode: r.ma_so_doi_tac,
      supplierName: r.ten_doi_tac,
      accountCode: r.ma_so_tai_khoan,
      accountName: r.ten_tai_khoan,
      currency: r.ma_so_tien_te,
      caseCount: Number(r.so_vu_viec) || 0,
      dkNo: Number(r.dk_no) || 0,
      dkCo: Number(r.dk_co) || 0,
      psNo: Number(r.ps_no) || 0,
      psCo: Number(r.ps_co) || 0,
      ckNo: Number(r.ck_no) || 0,
      ckCo: Number(r.ck_co) || 0,
      balanceAmount: Number(r.balance_amount) || 0,
      periodFrom: r.period_from,
      periodTo: r.period_to,
      maxAgingDays: Number(r.max_aging_days) || 0,
      aging0_30: Number(r.aging_0_30) || 0,
      aging31_60: Number(r.aging_31_60) || 0,
      aging61_90: Number(r.aging_61_90) || 0,
      agingOver90: Number(r.aging_over_90) || 0,
    }));

    return {
      data: formattedData,
      total,
      page: safePage,
      pageSize: safePageSize,
      totalPages: Math.ceil(total / safePageSize),
      summary: {
        totalPsNo: Number(summaryResult[0]?.total_ps_no) || 0,
        totalPsCo: Number(summaryResult[0]?.total_ps_co) || 0,
        totalCkCo: Number(summaryResult[0]?.total_ck_co) || 0,
        totalCkNo: Number(summaryResult[0]?.total_ck_no) || 0,
        totalBalance: Number(summaryResult[0]?.total_balance) || 0,
        totalAging0_30: Number(summaryResult[0]?.total_aging_0_30) || 0,
        totalAging31_60: Number(summaryResult[0]?.total_aging_31_60) || 0,
        totalAging61_90: Number(summaryResult[0]?.total_aging_61_90) || 0,
        totalAgingOver90: Number(summaryResult[0]?.total_aging_over_90) || 0,
      },
    };
  }

  @Get('payables/suppliers-debt/column-options')
  @RequirePermissions({ resource: 'garage', action: 'read' })
  async getSuppliersDebtColumnOptions(
    @BranchId() branchId: string,
    @Query('column') column: string,
    @Query('search') search: string = '',
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20',
    @Query('filtersStr') filtersStr?: string,
  ) {
    let selectExpr = '"p"."ma_so_doi_tac"';
    if (column === 'supplierName' || column === 'tenDoiTac')
      selectExpr = '"p"."ten_doi_tac"';
    else if (column === 'supplierCode' || column === 'maSoDoiTac')
      selectExpr = '"p"."ma_so_doi_tac"';
    else if (column === 'accountCode' || column === 'maSoTaiKhoan')
      selectExpr = '"p"."ma_so_tai_khoan"';

    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safePageSize = Math.max(parseInt(pageSize, 10) || 20, 1);

    const query = this.payableRepo
      .createQueryBuilder('p')
      .select(`DISTINCT ${selectExpr}`, 'value');

    if (branchId) {
      query.andWhere('p.branchExternalId = :branchId', { branchId });
    }
    query.andWhere(
      'COALESCE(p.periodTo, p.periodFrom, p.createdAt) >= :baselineDate',
      { baselineDate: '2026-07-01' },
    );
    query.andWhere(`${selectExpr} IS NOT NULL`);
    query.andWhere(`CAST(${selectExpr} AS TEXT) != ''`);

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

  @Get('payables/by-supplier/:supplierId/cases')
  @RequirePermissions({ resource: 'garage', action: 'read' })
  async getCasesBySupplier(
    @BranchId() branchId: string,
    @Param('supplierId') supplierId: string,
  ) {
    const query = this.payableRepo
      .createQueryBuilder('p')
      .where('p.doiTacId = :supplierId', { supplierId })
      .andWhere(
        'COALESCE(p.periodTo, p.periodFrom, p.createdAt) >= :baselineDate',
        { baselineDate: '2026-07-01' },
      );

    if (branchId) {
      query.andWhere('p.branchExternalId = :branchId', { branchId });
    }

    query.orderBy('p.createdAt', 'DESC');

    const payables = await query.getMany();

    // Collect distinct case codes
    const caseCodes = Array.from(
      new Set(payables.map((p) => p.maSoVuViec).filter(Boolean)),
    );

    let linkedCases: KgaraCase[] = [];
    if (caseCodes.length > 0) {
      linkedCases = await this.caseRepo
        .createQueryBuilder('c')
        .where('c.soChungTu IN (:...caseCodes)', { caseCodes })
        .andWhere('c.kgaraDeletedAt IS NULL')
        .getMany();
    }

    const caseMap = new Map<string, KgaraCase>();
    for (const c of linkedCases) {
      if (c.soChungTu) caseMap.set(c.soChungTu, c);
    }

    const enrichedPayables = payables.map((p) => {
      const linkedCase = p.maSoVuViec ? caseMap.get(p.maSoVuViec) : null;
      return {
        ...p,
        linkedCase: linkedCase || null,
        balance: (Number(p.ckCo) || 0) - (Number(p.ckNo) || 0),
      };
    });

    return {
      payables: enrichedPayables,
      linkedCases,
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
  @RequirePermissions({ resource: 'garage', action: 'create' })
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
  @RequirePermissions({ resource: 'garage', action: 'create' })
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
    @Body()
    body:
      | { invoiceId: string; linkType: 'IN' | 'OUT'; note?: string }
      | {
          items: Array<{
            invoiceId: string;
            linkType: 'IN' | 'OUT';
            note?: string;
          }>;
        }
      | Array<{ invoiceId: string; linkType: 'IN' | 'OUT'; note?: string }>,
  ) {
    const rawItems: Array<{
      invoiceId: string;
      linkType: 'IN' | 'OUT';
      note?: string;
    }> = Array.isArray(body)
      ? body
      : (body as any)?.items && Array.isArray((body as any).items)
        ? (body as any).items
        : [body as any];

    const results: any[] = [];
    for (const item of rawItems) {
      if (!item?.invoiceId) continue;
      const existing = await this.linkedInvoiceRepo.findOne({
        where: { caseDbId: id, invoiceId: item.invoiceId },
      });
      let link = existing;
      if (!existing) {
        link = this.linkedInvoiceRepo.create({
          caseDbId: id,
          invoiceId: item.invoiceId,
          linkType: item.linkType || 'OUT',
          note: item.note,
        });
        link = await this.linkedInvoiceRepo.save(link);
      }
      if (link) {
        results.push(link);
      }

      // Auto-sync: If the case already has ON_SYSTEM settlements matching the linkType direction
      try {
        const isOut = item.linkType === 'OUT';
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
              [item.invoiceId, s.bankTransactionId],
            );
            if (!netOff || netOff.length === 0) {
              await this.settlementRepo.manager.query(
                `INSERT INTO erp_invoice_voucher_netoff (id, invoice_id, bank_transaction_id, net_off_amount, created_at, updated_at)
                 VALUES (gen_random_uuid(), $1, $2, $3, now(), now())`,
                [item.invoiceId, s.bankTransactionId, Number(s.amount || 0)],
              );
            }
          }
        }
      } catch (syncErr) {
        this.logger.warn(
          `Could not sync case settlements to invoice netoff: ${syncErr}`,
        );
      }
    }

    return Array.isArray(body) || (body as any)?.items ? results : results[0];
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
    if (
      linkedId.startsWith('tmp-') ||
      linkedId.startsWith('manual-tmp-') ||
      id.startsWith('tmp-') ||
      (process.env.NODE_ENV !== 'test' &&
        (!uuidRegex.test(linkedId) || !uuidRegex.test(id)))
    ) {
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

  @Get('cases/:id/smart-settlement-suggestions')
  @RequirePermissions({ resource: 'garage', action: 'read' })
  async getSmartSettlementSuggestions(
    @Param('id') id: string,
    @Query('type') type?: 'RECEIPT' | 'PAYMENT',
  ) {
    return this.smartSettlementService.getSuggestionsForCase(
      id,
      type || 'RECEIPT',
    );
  }

  @Get('cases/:id/smart-invoice-suggestions')
  @RequirePermissions({ resource: 'garage', action: 'read' })
  async getSmartInvoiceSuggestions(
    @Param('id') id: string,
    @Query('direction') direction?: 'IN' | 'OUT',
  ) {
    return this.smartSettlementService.getInvoiceSuggestionsForCase(
      id,
      direction || 'OUT',
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

    await this.recalculateCaseSettlementSummary(id);
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
    if (
      settlementId.startsWith('tmp-') ||
      settlementId.startsWith('manual-tmp-') ||
      id.startsWith('tmp-') ||
      (process.env.NODE_ENV !== 'test' &&
        (!uuidRegex.test(settlementId) || !uuidRegex.test(id)))
    ) {
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
    await this.recalculateCaseSettlementSummary(id);
    return { success: true };
  }

  private async recalculateCaseSettlementSummary(caseId: string) {
    try {
      const c = await this.caseRepo.findOne({
        where: [
          { id: caseId },
          { soChungTu: caseId },
          { hdPhieuDichVuId: caseId },
        ],
      });
      if (!c) return;

      const settlements = await this.settlementRepo.find({
        where: { caseId: c.id },
      });

      const totalReceipts = settlements
        .filter((s) => s.settlementType === 'RECEIPT')
        .reduce((sum, s) => sum + Number(s.amount || 0), 0);

      const targetRevenue = Number(
        c.tienCoThue ?? c.rawData?.TongTienThanhToan ?? c.doanhThu ?? 0,
      );
      const remainingReceivable = Math.max(0, targetRevenue - totalReceipts);

      await this.caseRepo.update(c.id, {
        tienDaThanhToan: totalReceipts,
        tienConPhaiThanhToan: remainingReceivable,
      });
    } catch (err) {
      this.logger.warn(
        `Failed to recalculate case settlement summary for ${caseId}: ${err}`,
      );
    }
  }
}
