import { LoanEntity, LoanPaymentEntity } from '../entities';
import {
  LoanPaymentResponseDto,
  LoanResponseDto,
} from '../dto/loan-response.dto';
import { LoanAmortizationEngine } from '@/v2/core/loans-core';

export class LoanMapper {
  public static toPaymentDto(
    entity: LoanPaymentEntity,
  ): LoanPaymentResponseDto {
    return {
      id: entity.id,
      loanId: entity.loanId,
      periodNumber: entity.periodNumber,
      paymentDate: entity.paymentDate,
      principalPaid: Number(entity.principalPaid || 0),
      interestPaid: Number(entity.interestPaid || 0),
      totalPaid: Number(entity.totalPaid || 0),
      paymentRef: entity.paymentRef || null,
      notes: entity.notes || null,
      createdBy: entity.createdBy || null,
      extraData: entity.extraData ?? {},
      createdAt: entity.createdAt,
    };
  }

  public static toDto(
    entity: LoanEntity,
    includeSchedule = false,
  ): LoanResponseDto {
    const principalAmount = Number(entity.principalAmount || 0);
    const annualInterestRate = Number(entity.annualInterestRate || 0);

    const dto: LoanResponseDto = {
      id: entity.id,
      loanCode: entity.loanCode,
      title: entity.title,
      lenderName: entity.lenderName,
      partnerId: entity.partnerId || null,
      principalAmount,
      annualInterestRate,
      tenorMonths: entity.tenorMonths,
      amortizationMethod: entity.amortizationMethod,
      startDate: entity.startDate,
      firstPaymentDate: entity.firstPaymentDate,
      totalPaidPrincipal: Number(entity.totalPaidPrincipal || 0),
      totalPaidInterest: Number(entity.totalPaidInterest || 0),
      remainingPrincipal: Number(entity.remainingPrincipal || 0),
      status: entity.status,
      notes: entity.notes || null,
      createdBy: entity.createdBy || null,
      extraData: entity.extraData ?? {},
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      payments: entity.payments
        ? entity.payments.map((p) => this.toPaymentDto(p))
        : undefined,
    };

    if (includeSchedule) {
      const sim = LoanAmortizationEngine.generateSchedule({
        principalAmount,
        annualInterestRate,
        tenorMonths: entity.tenorMonths,
        amortizationMethod: entity.amortizationMethod,
        startDate: entity.startDate,
        firstPaymentDate: entity.firstPaymentDate,
      });
      dto.schedule = sim.schedule;
    }

    return dto;
  }
}
