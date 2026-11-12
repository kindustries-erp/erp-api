import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { applyMultiKeywordMultiFieldFilter } from '@/common/utils/query-builder.util';
import {
  applyDateBounds,
  applyListSummaries,
  applyTableFilters,
  applyTableSort,
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
  ) {}

  async findAll(query: QueryLoanDto): Promise<LoanListPageResult> {
    const page = Math.max(1, Number(query.page || 1));
    const pageSize = Math.max(1, Math.min(200, Number(query.pageSize || 20)));

    const qb = this.loanRepo
      .createQueryBuilder('loan')
      .where('loan.isDeleted = :deleted', {
        deleted: query.deleted === 'only',
      });

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
  ): Promise<TableOptionsPage> {
    const def = resolveTableColumn(TABLE_COLUMNS, column);
    if (!def) return { items: [], total: 0, next: null };

    const qb = this.loanRepo
      .createQueryBuilder('loan')
      .where('loan.isDeleted = :deleted', { deleted: deleted === 'only' });

    applyTableFilters(
      qb,
      toFilterPayload(filters),
      TABLE_COLUMNS,
      'col_opt',
      column,
    );
    return findTableColumnOptions(qb, def, search, page, pageSize);
  }

  async findOne(id: string): Promise<LoanResponseDto> {
    const loan = await this.loanRepo.findOne({
      where: { id, isDeleted: false },
      relations: ['payments'],
      order: { payments: { periodNumber: 'ASC' } },
    });

    if (!loan) {
      throw new NotFoundException(`Loan with ID "${id}" not found`);
    }

    return LoanMapper.toDto(loan, true);
  }

  async getCashflowProjection(): Promise<CashflowProjectionResponseDto> {
    const activeLoans = await this.loanRepo.find({
      where: { isDeleted: false, status: LoanStatus.ACTIVE },
    });

    const monthMap = new Map<
      string,
      {
        principalDue: number;
        interestDue: number;
        totalDue: number;
        endingBalances: Map<string, number>;
        activeLoanIds: Set<string>;
        breakdown: CashflowLoanBreakdownDto[];
      }
    >();

    for (const loan of activeLoans) {
      const schedule = LoanAmortizationEngine.generateSchedule({
        principalAmount: Number(loan.principalAmount || 0),
        annualInterestRate: Number(loan.annualInterestRate || 0),
        tenorMonths: loan.tenorMonths,
        amortizationMethod: loan.amortizationMethod,
        startDate: loan.startDate,
        firstPaymentDate: loan.firstPaymentDate,
      }).schedule;

      for (const p of schedule) {
        const month = p.dueDate.substring(0, 7); // YYYY-MM
        let entry = monthMap.get(month);
        if (!entry) {
          entry = {
            principalDue: 0,
            interestDue: 0,
            totalDue: 0,
            endingBalances: new Map<string, number>(),
            activeLoanIds: new Set<string>(),
            breakdown: [],
          };
          monthMap.set(month, entry);
        }
        entry.principalDue += p.principalDue;
        entry.interestDue += p.interestDue;
        entry.totalDue += p.totalPaymentDue;
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
        });
      }
    }

    const sortedMonths = Array.from(monthMap.keys()).sort();
    const monthlyProjections: MonthlyCashflowProjectionDto[] = [];
    let grandPrincipal = 0;
    let grandInterest = 0;

    for (const m of sortedMonths) {
      const data = monthMap.get(m)!;
      const cumBal = Array.from(data.endingBalances.values()).reduce(
        (acc, val) => acc + val,
        0,
      );

      grandPrincipal += data.principalDue;
      grandInterest += data.interestDue;

      monthlyProjections.push({
        month: m,
        principalDue: Math.round(data.principalDue),
        interestDue: Math.round(data.interestDue),
        totalPaymentDue: Math.round(data.totalDue),
        cumulativeRemainingPrincipal: Math.round(cumBal),
        activeLoanCount: data.activeLoanIds.size,
        breakdown: data.breakdown,
      });
    }

    return {
      monthlyProjections,
      totalPrincipalDue: Math.round(grandPrincipal),
      totalInterestDue: Math.round(grandInterest),
      totalObligationDue: Math.round(grandPrincipal + grandInterest),
    };
  }
}
