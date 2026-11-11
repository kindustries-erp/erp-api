import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoanEntity } from '../entities';
import {
  CashflowProjectionResponseDto,
  LoanListResponseDto,
  LoanResponseDto,
  MonthlyCashflowProjectionDto,
  QueryLoanDto,
} from '../dto';
import { LoanMapper } from '../helpers/loan.mapper';
import { LoanAmortizationEngine, LoanStatus } from '@/v2/core/loans-core';

@Injectable()
export class LoanQueryService {
  constructor(
    @InjectRepository(LoanEntity)
    private readonly loanRepo: Repository<LoanEntity>,
  ) {}

  async findAll(query: QueryLoanDto): Promise<LoanListResponseDto> {
    const page = Math.max(1, Number(query.page || 1));
    const pageSize = Math.max(1, Math.min(100, Number(query.pageSize || 20)));

    const qb = this.loanRepo
      .createQueryBuilder('loan')
      .where('loan.isDeleted = :isDeleted', { isDeleted: false });

    if (query.status) {
      qb.andWhere('loan.status = :status', { status: query.status });
    }

    if (query.lenderName) {
      qb.andWhere('loan.lenderName ILIKE :lenderName', {
        lenderName: `%${query.lenderName}%`,
      });
    }

    if (query.search) {
      qb.andWhere(
        '(loan.loanCode ILIKE :search OR loan.title ILIKE :search OR loan.lenderName ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('loan.startDate', 'DESC');
    qb.skip((page - 1) * pageSize).take(pageSize);

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((item) => LoanMapper.toDto(item, false)),
      total,
      page,
      pageSize,
    };
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
          };
          monthMap.set(month, entry);
        }
        entry.principalDue += p.principalDue;
        entry.interestDue += p.interestDue;
        entry.totalDue += p.totalPaymentDue;
        entry.endingBalances.set(loan.id, p.endingBalance);
        entry.activeLoanIds.add(loan.id);
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
