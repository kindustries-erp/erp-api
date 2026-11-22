import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, Not } from 'typeorm';
import { LoanEntity, LoanPaymentEntity } from '../entities';
import {
  CreateLoanDto,
  RecordPaymentDto,
  UpdateLoanDto,
  UpdatePaymentDto,
} from '../dto';
import { LoanResponseDto } from '../dto/loan-response.dto';
import { LoanMapper } from '../helpers/loan.mapper';
import { LoanStatus } from '@/v2/core/loans-core';
import { RbacCoreService } from '@/v2/core/rbac-core';
import {
  assertLoanOwnership,
  generateLoanCode,
  isLoanSuperAdmin,
  resolveFirstPaymentDate,
} from '../helpers/loan-ownership.helper';

@Injectable()
export class LoanCommandService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly rbacCoreService: RbacCoreService,
  ) {}

  /** Mỗi kỳ của một khoản vay chỉ được có một thanh toán (gọi sau khi đã khóa khoản vay). */
  private async assertPeriodAvailable(
    manager: EntityManager,
    loanId: string,
    periodNumber: number,
    excludePaymentId?: string,
  ): Promise<void> {
    const where = excludePaymentId
      ? { loanId, periodNumber, id: Not(excludePaymentId) }
      : { loanId, periodNumber };
    const existing = await manager.count(LoanPaymentEntity, { where });
    if (existing > 0) {
      throw new ConflictException(`Kỳ ${periodNumber} đã có thanh toán`);
    }
  }

  async create(dto: CreateLoanDto, userId?: string): Promise<LoanResponseDto> {
    const repo = this.dataSource.getRepository(LoanEntity);

    const loan = repo.create({
      loanCode: dto.loanCode || generateLoanCode(),
      title: dto.title,
      lenderName: dto.lenderName,
      partnerId: dto.partnerId || null,
      principalAmount: String(dto.principalAmount),
      annualInterestRate: String(dto.annualInterestRate),
      tenorMonths: dto.tenorMonths,
      amortizationMethod: dto.amortizationMethod,
      startDate: dto.startDate,
      firstPaymentDate: resolveFirstPaymentDate(
        dto.startDate,
        dto.firstPaymentDate,
      ),
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
          loanCode: dto.loanCode || `${generateLoanCode()}-${i + 1}`,
          title: dto.title,
          lenderName: dto.lenderName,
          partnerId: dto.partnerId || null,
          principalAmount: String(dto.principalAmount),
          annualInterestRate: String(dto.annualInterestRate),
          tenorMonths: dto.tenorMonths,
          amortizationMethod: dto.amortizationMethod,
          startDate: dto.startDate,
          firstPaymentDate: resolveFirstPaymentDate(
            dto.startDate,
            dto.firstPaymentDate,
          ),
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

  async update(
    id: string,
    dto: UpdateLoanDto,
    userId?: string,
  ): Promise<LoanResponseDto> {
    const repo = this.dataSource.getRepository(LoanEntity);
    const loan = await repo.findOne({ where: { id, isDeleted: false } });

    if (!loan) {
      throw new NotFoundException(`Loan with ID "${id}" not found`);
    }

    const isSuperAdmin = await isLoanSuperAdmin(this.rbacCoreService, userId);
    assertLoanOwnership(loan, userId, isSuperAdmin);

    if (dto.loanCode !== undefined && dto.loanCode.trim()) {
      loan.loanCode = dto.loanCode.trim();
    }
    if (dto.title !== undefined) loan.title = dto.title;
    if (dto.lenderName !== undefined) loan.lenderName = dto.lenderName;
    if (dto.partnerId !== undefined) loan.partnerId = dto.partnerId || null;
    if (dto.principalAmount !== undefined) {
      loan.principalAmount = String(dto.principalAmount);
      const paidPrincipal = Number(loan.totalPaidPrincipal || 0);
      loan.remainingPrincipal = String(
        Math.max(0, dto.principalAmount - paidPrincipal),
      );
    }
    if (dto.annualInterestRate !== undefined) {
      loan.annualInterestRate = String(dto.annualInterestRate);
    }
    if (dto.tenorMonths !== undefined) loan.tenorMonths = dto.tenorMonths;
    if (dto.amortizationMethod !== undefined) {
      loan.amortizationMethod = dto.amortizationMethod;
    }
    if (dto.startDate !== undefined) {
      const prevStart = loan.startDate;
      loan.startDate = dto.startDate;
      if (
        dto.firstPaymentDate === undefined &&
        (!loan.firstPaymentDate ||
          loan.firstPaymentDate === prevStart ||
          loan.firstPaymentDate < dto.startDate)
      ) {
        loan.firstPaymentDate = dto.startDate;
      }
    }
    if (dto.firstPaymentDate !== undefined) {
      loan.firstPaymentDate = resolveFirstPaymentDate(
        loan.startDate,
        dto.firstPaymentDate,
      );
    }
    if (dto.notes !== undefined) loan.notes = dto.notes || null;
    if (dto.status !== undefined) loan.status = dto.status;

    const saved = await repo.save(loan);
    return LoanMapper.toDto(saved, true);
  }

  async remove(id: string, userId?: string): Promise<void> {
    const repo = this.dataSource.getRepository(LoanEntity);
    const loan = await repo.findOne({ where: { id, isDeleted: false } });

    if (!loan) {
      throw new NotFoundException(`Loan with ID "${id}" not found`);
    }

    const isSuperAdmin = await isLoanSuperAdmin(this.rbacCoreService, userId);
    assertLoanOwnership(loan, userId, isSuperAdmin);

    loan.isDeleted = true;
    await repo.save(loan);
  }

  /** Xóa cứng khoản vay đã xóa mềm. Chặn 409 nếu chưa xóa mềm hoặc còn lịch sử thanh toán. */
  async hardDelete(id: string, userId?: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const loan = await manager.findOne(LoanEntity, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!loan) {
        throw new NotFoundException(`Loan with ID "${id}" not found`);
      }

      const isSuperAdmin = await isLoanSuperAdmin(this.rbacCoreService, userId);
      assertLoanOwnership(loan, userId, isSuperAdmin);

      if (!loan.isDeleted) {
        throw new ConflictException(
          'Chỉ được xóa vĩnh viễn khoản vay đã xóa mềm',
        );
      }

      const paymentCount = await manager.count(LoanPaymentEntity, {
        where: { loanId: id },
      });
      if (paymentCount > 0) {
        throw new ConflictException(
          'Không thể xóa vĩnh viễn khoản vay đã có lịch sử thanh toán',
        );
      }

      await manager.delete(LoanEntity, id);
    });
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

      const isSuperAdmin = await isLoanSuperAdmin(this.rbacCoreService, userId);
      assertLoanOwnership(loan, userId, isSuperAdmin);

      const totalPaid = dto.principalPaid + dto.interestPaid;
      if (totalPaid <= 0) {
        throw new BadRequestException(
          'Total payment amount must be greater than 0',
        );
      }

      await this.assertPeriodAvailable(qr.manager, loanId, dto.periodNumber);

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

  async updatePayment(
    loanId: string,
    paymentId: string,
    dto: UpdatePaymentDto,
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

      const isSuperAdmin = await isLoanSuperAdmin(this.rbacCoreService, userId);
      assertLoanOwnership(loan, userId, isSuperAdmin);

      const payment = await qr.manager.findOne(LoanPaymentEntity, {
        where: { id: paymentId, loanId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!payment) {
        throw new NotFoundException(
          `Payment with ID "${paymentId}" not found for loan "${loanId}"`,
        );
      }

      if (dto.periodNumber !== undefined) {
        await this.assertPeriodAvailable(
          qr.manager,
          loanId,
          dto.periodNumber,
          paymentId,
        );
        payment.periodNumber = dto.periodNumber;
      }
      if (dto.paymentDate !== undefined) {
        payment.paymentDate = dto.paymentDate;
      }
      if (dto.principalPaid !== undefined) {
        payment.principalPaid = String(dto.principalPaid);
      }
      if (dto.interestPaid !== undefined) {
        payment.interestPaid = String(dto.interestPaid);
      }
      const curPrincipal = Number(payment.principalPaid || 0);
      const curInterest = Number(payment.interestPaid || 0);
      const newTotal = curPrincipal + curInterest;
      if (newTotal <= 0) {
        throw new BadRequestException(
          'Total payment amount must be greater than 0',
        );
      }
      payment.totalPaid = String(newTotal);

      if (dto.paymentRef !== undefined) {
        payment.paymentRef = dto.paymentRef || null;
      }
      if (dto.notes !== undefined) {
        payment.notes = dto.notes || null;
      }

      await qr.manager.save(payment);

      // Recalculate totals directly from all active payments of this loan
      const allPayments = await qr.manager.find(LoanPaymentEntity, {
        where: { loanId },
      });

      const totalPrincipalPaid = allPayments.reduce(
        (acc, p) => acc + Number(p.principalPaid || 0),
        0,
      );
      const totalInterestPaid = allPayments.reduce(
        (acc, p) => acc + Number(p.interestPaid || 0),
        0,
      );

      const principalOrig = Number(loan.principalAmount || 0);
      const remainingPrincipal = Math.max(
        0,
        principalOrig - totalPrincipalPaid,
      );

      loan.totalPaidPrincipal = String(totalPrincipalPaid);
      loan.totalPaidInterest = String(totalInterestPaid);
      loan.remainingPrincipal = String(remainingPrincipal);

      if (remainingPrincipal <= 0) {
        loan.status = LoanStatus.COMPLETED;
      } else if (loan.status === LoanStatus.COMPLETED) {
        loan.status = LoanStatus.ACTIVE;
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

  async deletePayment(
    loanId: string,
    paymentId: string,
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

      const isSuperAdmin = await isLoanSuperAdmin(this.rbacCoreService, userId);
      assertLoanOwnership(loan, userId, isSuperAdmin);

      const payment = await qr.manager.findOne(LoanPaymentEntity, {
        where: { id: paymentId, loanId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!payment) {
        throw new NotFoundException(
          `Payment with ID "${paymentId}" not found for loan "${loanId}"`,
        );
      }

      await qr.manager.remove(payment);

      const allPayments = await qr.manager.find(LoanPaymentEntity, {
        where: { loanId },
      });

      const totalPrincipalPaid = allPayments.reduce(
        (acc, p) => acc + Number(p.principalPaid || 0),
        0,
      );
      const totalInterestPaid = allPayments.reduce(
        (acc, p) => acc + Number(p.interestPaid || 0),
        0,
      );

      const principalOrig = Number(loan.principalAmount || 0);
      const remainingPrincipal = Math.max(
        0,
        principalOrig - totalPrincipalPaid,
      );

      loan.totalPaidPrincipal = String(totalPrincipalPaid);
      loan.totalPaidInterest = String(totalInterestPaid);
      loan.remainingPrincipal = String(remainingPrincipal);

      if (remainingPrincipal <= 0) {
        loan.status = LoanStatus.COMPLETED;
      } else if (loan.status === LoanStatus.COMPLETED) {
        loan.status = LoanStatus.ACTIVE;
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
