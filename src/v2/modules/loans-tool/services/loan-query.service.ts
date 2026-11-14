import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { applyMultiKeywordMultiFieldFilter } from '@/common/utils/query-builder.util';
import {
  applyDateBounds,
  applyListSummaries,
  applyTableFilters,
  applyTableSort,
  emptyOptionsPage,
  findTableColumnOptions,
  parseListFilterPayload,
  parseSummaryKeys,
  resolveTableColumn,
  SummaryMetric,
  TableOptionsPage,
} from '@/common/utils/table-query';
import {
  SEARCH_COLUMNS,
  SUMMARY_COLUMNS,
  TABLE_COLUMNS,
  toFilterPayload,
} from '../constants/loan-table.constants';
import { LoanEntity } from '../entities';
import {
  CashflowLoanBreakdownDto,
  CashflowProjectionResponseDto,
  LoanResponseDto,
  MonthlyCashflowProjectionDto,
  QueryLoanDto,
} from '../dto';
import { LoanMapper } from '../helpers/loan.mapper';
import { LoanAmortizationEngine, LoanStatus } from '@/v2/core/loans-core';
import { RbacCoreService } from '@/v2/core/rbac-core';
import {
  assertLoanOwnership,
  isLoanSuperAdmin,
} from '../helpers/loan-ownership.helper';

export interface LoanListPageResult {
  rows: LoanEntity[];
  total: number;
  page: number;
  pageSize: number;
  summaries: Record<string, SummaryMetric | null>;
}

@Injectable()
export class LoanQueryService {
  constructor(
    @InjectRepository(LoanEntity)
    private readonly loanRepo: Repository<LoanEntity>,
    private readonly rbacCoreService: RbacCoreService,
  ) {}

  async findAll(
    query: QueryLoanDto,
    userId?: string,
  ): Promise<LoanListPageResult> {
    const page = Math.max(1, Number(query.page || 1));
    const pageSize = Math.max(1, Math.min(200, Number(query.pageSize || 20)));

    const qb = this.loanRepo
      .createQueryBuilder('loan')
      .where('loan.isDeleted = :deleted', {
        deleted: query.deleted === 'only',
      });

    const isSuperAdmin = await isLoanSuperAdmin(this.rbacCoreService, userId);
    if (!isSuperAdmin && userId) {
      qb.andWhere('loan.createdBy = :userId', { userId });
    }

    if (query.status) {
      qb.andWhere('loan.status = :status', { status: query.status });
    }

    if (query.lenderName) {
      qb.andWhere('loan.lenderName ILIKE :lenderName', {
        lenderName: `%${query.lenderName}%`,
      });
    }

    const keyword = query.search?.trim();
    if (keyword) {
      applyMultiKeywordMultiFieldFilter(
        qb,
        SEARCH_COLUMNS,
        keyword,
        'global_search',
      );
    }

    applyTableFilters(
      qb,
      parseListFilterPayload(query),
      TABLE_COLUMNS,
      'filter',
    );
    applyDateBounds(
      qb,
      'loan.createdAt',
      query.date_from,
      query.date_to,
      'legacy',
    );
    applyTableSort(
      qb,
      query.sort,
      TABLE_COLUMNS,
      { sql: 'loan.startDate', direction: 'DESC' },
      'loan.id',
    );

    // Tổng theo summary_keys trên toàn bộ dòng khớp, nên phải gọi trước khi phân trang
    const summaries = await applyListSummaries(qb, {
      columns: SUMMARY_COLUMNS,
      keys: parseSummaryKeys(query.summary_keys),
      page,
      pageSize,
      tieBreaker: 'loan.id',
    });

    const [rows, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { rows, total, page, pageSize, summaries };
  }

  /** Gợi ý danh sách giá trị của một cột cho Popover Filter trên Header bảng V2. */
  async findColumnOptions(
    column: string,
    search: string | undefined,
    page: number,
    pageSize: number,
    filters: unknown,
    deleted?: 'only',
    userId?: string,
  ): Promise<TableOptionsPage> {
    const def = resolveTableColumn(TABLE_COLUMNS, column);
    if (!def) return emptyOptionsPage(page, pageSize);

    const qb = this.loanRepo
      .createQueryBuilder('loan')
      .where('loan.isDeleted = :deleted', { deleted: deleted === 'only' });

    const isSuperAdmin = await isLoanSuperAdmin(this.rbacCoreService, userId);
    if (!isSuperAdmin && userId) {
      qb.andWhere('loan.createdBy = :userId', { userId });
    }

    applyTableFilters(
      qb,
      toFilterPayload(filters),
      TABLE_COLUMNS,
      'col_opt',
      column,
    );
    return findTableColumnOptions(qb, def, search, page, pageSize);
  }

  async findOne(id: string, userId?: string): Promise<LoanResponseDto> {
    const loan = await this.loanRepo.findOne({
      where: { id, isDeleted: false },
      relations: ['payments'],
      order: { payments: { periodNumber: 'ASC' } },
    });

    if (!loan) {
      throw new NotFoundException(`Loan with ID "${id}" not found`);
    }

    const isSuperAdmin = await isLoanSuperAdmin(this.rbacCoreService, userId);
    assertLoanOwnership(loan, userId, isSuperAdmin);

    return LoanMapper.toDto(loan, true);
  }

  async getCashflowProjection(
    includeAllPeriods = false,
    userId?: string,
  ): Promise<CashflowProjectionResponseDto> {
    const isSuperAdmin = await isLoanSuperAdmin(this.rbacCoreService, userId);
    const whereCondition: any = { isDeleted: false, status: LoanStatus.ACTIVE };
    if (!isSuperAdmin && userId) {
      whereCondition.createdBy = userId;
    }

    const activeLoans = await this.loanRepo.find({
      where: whereCondition,
      relations: ['payments'],
    });

    const monthMap = new Map<
      string,
      {
        principalDue: number;
        interestDue: number;
        totalDue: number;
        scheduledPrincipalDue: number;
        scheduledInterestDue: number;
        scheduledTotalDue: number;
        actualPrincipalPaid: number;
        actualInterestPaid: number;
        actualTotalPaid: number;
        allPaid: boolean;
        endingBalances: Map<string, number>;
        activeLoanIds: Set<string>;
        breakdown: CashflowLoanBreakdownDto[];
      }
    >();

    for (const loan of activeLoans) {
      const scheduleResult =
        loan.payments && loan.payments.length > 0
          ? LoanAmortizationEngine.recalculateSchedule({
              principalAmount: Number(loan.principalAmount || 0),
              annualInterestRate: Number(loan.annualInterestRate || 0),
              tenorMonths: loan.tenorMonths,
              amortizationMethod: loan.amortizationMethod,
              startDate: loan.startDate,
              firstPaymentDate: loan.firstPaymentDate,
              remainingPrincipal: Number(loan.remainingPrincipal || 0),
              payments: loan.payments.map((p) => ({
                periodNumber: p.periodNumber,
                paymentDate: p.paymentDate,
                principalPaid: Number(p.principalPaid || 0),
                interestPaid: Number(p.interestPaid || 0),
                paymentRef: p.paymentRef,
              })),
            })
          : LoanAmortizationEngine.generateSchedule({
              principalAmount: Number(loan.principalAmount || 0),
              annualInterestRate: Number(loan.annualInterestRate || 0),
              tenorMonths: loan.tenorMonths,
              amortizationMethod: loan.amortizationMethod,
              startDate: loan.startDate,
              firstPaymentDate: loan.firstPaymentDate,
            });

      const selectedPeriods = includeAllPeriods
        ? scheduleResult.schedule
        : scheduleResult.schedule.filter(
            (p) => !p.isPaid && p.totalPaymentDue > 0,
          );

      for (const p of selectedPeriods) {
        const month = p.dueDate.substring(0, 7); // YYYY-MM
        let entry = monthMap.get(month);
        if (!entry) {
          entry = {
            principalDue: 0,
            interestDue: 0,
            totalDue: 0,
            scheduledPrincipalDue: 0,
            scheduledInterestDue: 0,
            scheduledTotalDue: 0,
            actualPrincipalPaid: 0,
            actualInterestPaid: 0,
            actualTotalPaid: 0,
            allPaid: true,
            endingBalances: new Map<string, number>(),
            activeLoanIds: new Set<string>(),
            breakdown: [],
          };
          monthMap.set(month, entry);
        }

        const isPeriodPaid = !!p.isPaid;
        if (!isPeriodPaid) {
          entry.allPaid = false;
          entry.principalDue += p.principalDue;
          entry.interestDue += p.interestDue;
          entry.totalDue += p.totalPaymentDue;
        }

        const pActualPrincipal = Number(p.actualPrincipalPaid || 0);
        const pActualInterest = Number(p.actualInterestPaid || 0);
        const pActualTotal = Number(
          p.actualTotalPaid || pActualPrincipal + pActualInterest,
        );

        entry.scheduledPrincipalDue += p.principalDue;
        entry.scheduledInterestDue += p.interestDue;
        entry.scheduledTotalDue += p.totalPaymentDue;
        entry.actualPrincipalPaid += pActualPrincipal;
        entry.actualInterestPaid += pActualInterest;
        entry.actualTotalPaid += pActualTotal;

        entry.endingBalances.set(loan.id, p.endingBalance);
        entry.activeLoanIds.add(loan.id);
        entry.breakdown.push({
          loanId: loan.id,
          loanName: loan.title || loan.loanCode,
          dueDate: p.dueDate,
          principalDue: Math.round(p.principalDue),
          interestDue: Math.round(p.interestDue),
          totalPayment: Math.round(p.totalPaymentDue),
          endingBalance: Math.round(p.endingBalance),
          scheduledPrincipal: Math.round(p.principalDue),
          scheduledInterest: Math.round(p.interestDue),
          scheduledTotal: Math.round(p.totalPaymentDue),
          actualPrincipalPaid: Math.round(pActualPrincipal),
          actualInterestPaid: Math.round(pActualInterest),
          actualTotalPaid: Math.round(pActualTotal),
          isPaid: isPeriodPaid,
        });
      }
    }

    const sortedMonths = Array.from(monthMap.keys()).sort();
    const monthlyProjections: MonthlyCashflowProjectionDto[] = [];
    let grandPrincipal = 0;
    let grandInterest = 0;
    let grandScheduledPrincipal = 0;
    let grandScheduledInterest = 0;
    let grandActualPrincipal = 0;
    let grandActualInterest = 0;

    for (const m of sortedMonths) {
      const data = monthMap.get(m)!;
      const cumBal = Array.from(data.endingBalances.values()).reduce(
        (acc, val) => acc + val,
        0,
      );

      grandPrincipal += data.principalDue;
      grandInterest += data.interestDue;
      grandScheduledPrincipal += data.scheduledPrincipalDue;
      grandScheduledInterest += data.scheduledInterestDue;
      grandActualPrincipal += data.actualPrincipalPaid;
      grandActualInterest += data.actualInterestPaid;

      monthlyProjections.push({
        month: m,
        principalDue: Math.round(data.principalDue),
        interestDue: Math.round(data.interestDue),
        totalPaymentDue: Math.round(data.totalDue),
        cumulativeRemainingPrincipal: Math.round(cumBal),
        activeLoanCount: data.activeLoanIds.size,
        scheduledPrincipalDue: Math.round(data.scheduledPrincipalDue),
        scheduledInterestDue: Math.round(data.scheduledInterestDue),
        scheduledTotalDue: Math.round(data.scheduledTotalDue),
        actualPrincipalPaid: Math.round(data.actualPrincipalPaid),
        actualInterestPaid: Math.round(data.actualInterestPaid),
        actualTotalPaid: Math.round(data.actualTotalPaid),
        isPaid:
          data.breakdown.length > 0 && data.breakdown.every((b) => b.isPaid),
        breakdown: data.breakdown,
      });
    }

    return {
      monthlyProjections,
      totalPrincipalDue: Math.round(grandPrincipal),
      totalInterestDue: Math.round(grandInterest),
      totalObligationDue: Math.round(grandPrincipal + grandInterest),
      totalScheduledPrincipal: Math.round(grandScheduledPrincipal),
      totalScheduledInterest: Math.round(grandScheduledInterest),
      totalScheduledObligation: Math.round(
        grandScheduledPrincipal + grandScheduledInterest,
      ),
      totalActualPrincipalPaid: Math.round(grandActualPrincipal),
      totalActualInterestPaid: Math.round(grandActualInterest),
      totalActualPaid: Math.round(grandActualPrincipal + grandActualInterest),
    };
  }
}
