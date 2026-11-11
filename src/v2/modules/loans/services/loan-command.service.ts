import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { LoanEntity, LoanPaymentEntity } from '../entities';
import { CreateLoanDto, RecordPaymentDto, UpdateLoanDto } from '../dto';
import { LoanResponseDto } from '../dto/loan-response.dto';
import { LoanMapper } from '../helpers/loan.mapper';
import { LoanStatus } from '@/v2/core/loans-core';

@Injectable()
export class LoanCommandService {
  constructor(private readonly dataSource: DataSource) {}

  private generateLoanCode(): string {
    const timestamp = Date.now().toString().slice(-6);
    return `LOAN-${timestamp}`;
  }

  async create(dto: CreateLoanDto, userId?: string): Promise<LoanResponseDto> {
    const repo = this.dataSource.getRepository(LoanEntity);

    const loan = repo.create({
      loanCode: dto.loanCode || this.generateLoanCode(),
      title: dto.title,
      lenderName: dto.lenderName,
      partnerId: dto.partnerId || null,
      principalAmount: String(dto.principalAmount),
      annualInterestRate: String(dto.annualInterestRate),
      tenorMonths: dto.tenorMonths,
      amortizationMethod: dto.amortizationMethod,
      startDate: dto.startDate,
      firstPaymentDate: dto.firstPaymentDate || dto.startDate,
      totalPaidPrincipal: '0',
      totalPaidInterest: '0',
      remainingPrincipal: String(dto.principalAmount),
      status: dto.status || LoanStatus.ACTIVE,
      notes: dto.notes || null,
      createdBy: userId || null,
    });

    const saved = await repo.save(loan);
    return LoanMapper.toDto(saved, true);
  }

  async createBatch(
    dtos: CreateLoanDto[],
    userId?: string,
  ): Promise<LoanResponseDto[]> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(LoanEntity);
      const results: LoanResponseDto[] = [];

      for (let i = 0; i < dtos.length; i++) {
        const dto = dtos[i];
        const loan = repo.create({
          loanCode: dto.loanCode || `${this.generateLoanCode()}-${i + 1}`,
          title: dto.title,
          lenderName: dto.lenderName,
          partnerId: dto.partnerId || null,
          principalAmount: String(dto.principalAmount),
          annualInterestRate: String(dto.annualInterestRate),
          tenorMonths: dto.tenorMonths,
          amortizationMethod: dto.amortizationMethod,
          startDate: dto.startDate,
          firstPaymentDate: dto.firstPaymentDate || dto.startDate,
          totalPaidPrincipal: '0',
          totalPaidInterest: '0',
          remainingPrincipal: String(dto.principalAmount),
          status: dto.status || LoanStatus.ACTIVE,
          notes: dto.notes || null,
          createdBy: userId || null,
        });

        const saved = await repo.save(loan);
        results.push(LoanMapper.toDto(saved, true));
      }

      return results;
    });
  }

  async update(id: string, dto: UpdateLoanDto): Promise<LoanResponseDto> {
    const repo = this.dataSource.getRepository(LoanEntity);
    const loan = await repo.findOne({ where: { id, isDeleted: false } });

    if (!loan) {
      throw new NotFoundException(`Loan with ID "${id}" not found`);
    }

    if (dto.title) loan.title = dto.title;
    if (dto.lenderName) loan.lenderName = dto.lenderName;
    if (dto.notes !== undefined) loan.notes = dto.notes || null;
    if (dto.status) loan.status = dto.status;

    const saved = await repo.save(loan);
    return LoanMapper.toDto(saved, true);
  }

  async remove(id: string): Promise<void> {
    const repo = this.dataSource.getRepository(LoanEntity);
    const loan = await repo.findOne({ where: { id, isDeleted: false } });

    if (!loan) {
      throw new NotFoundException(`Loan with ID "${id}" not found`);
    }

    loan.isDeleted = true;
    await repo.save(loan);
  }

  async recordPayment(
    loanId: string,
    dto: RecordPaymentDto,
    userId?: string,
  ): Promise<LoanResponseDto> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const loan = await qr.manager.findOne(LoanEntity, {
        where: { id: loanId, isDeleted: false },
        lock: { mode: 'pessimistic_write' },
      });

      if (!loan) {
        throw new NotFoundException(`Loan with ID "${loanId}" not found`);
      }

      const totalPaid = dto.principalPaid + dto.interestPaid;
      if (totalPaid <= 0) {
        throw new BadRequestException(
          'Total payment amount must be greater than 0',
        );
      }

      const payment = qr.manager.create(LoanPaymentEntity, {
        loanId,
        periodNumber: dto.periodNumber,
        paymentDate: dto.paymentDate,
        principalPaid: String(dto.principalPaid),
        interestPaid: String(dto.interestPaid),
        totalPaid: String(totalPaid),
        paymentRef: dto.paymentRef || null,
        notes: dto.notes || null,
        createdBy: userId || null,
      });

      await qr.manager.save(payment);

      const curPaidPrincipal = Number(loan.totalPaidPrincipal || 0);
      const curPaidInterest = Number(loan.totalPaidInterest || 0);
      const principalOrig = Number(loan.principalAmount || 0);

      const newPaidPrincipal = curPaidPrincipal + dto.principalPaid;
      const newPaidInterest = curPaidInterest + dto.interestPaid;
      const newRemaining = Math.max(0, principalOrig - newPaidPrincipal);

      loan.totalPaidPrincipal = String(newPaidPrincipal);
      loan.totalPaidInterest = String(newPaidInterest);
      loan.remainingPrincipal = String(newRemaining);

      if (newRemaining <= 0) {
        loan.status = LoanStatus.COMPLETED;
      }

      const updatedLoan = await qr.manager.save(loan);
      await qr.commitTransaction();

      return LoanMapper.toDto(updatedLoan, true);
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }
}
