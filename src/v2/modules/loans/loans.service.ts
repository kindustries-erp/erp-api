import { Injectable } from '@nestjs/common';
import { LoanQueryService } from './services/loan-query.service';
import { LoanCommandService } from './services/loan-command.service';
import {
  CashflowProjectionResponseDto,
  CreateLoanDto,
  LoanListResponseDto,
  LoanResponseDto,
  QueryLoanDto,
  RecordPaymentDto,
  SimulateLoanDto,
  UpdateLoanDto,
} from './dto';
import {
  LoanAmortizationEngine,
  LoanSimulationResult,
} from '@/v2/core/loans-core';

@Injectable()
export class LoansService {
  constructor(
    private readonly queryService: LoanQueryService,
    private readonly commandService: LoanCommandService,
  ) {}

  findAll(query: QueryLoanDto): Promise<LoanListResponseDto> {
    return this.queryService.findAll(query);
  }

  findOne(id: string): Promise<LoanResponseDto> {
    return this.queryService.findOne(id);
  }

  getCashflowProjection(): Promise<CashflowProjectionResponseDto> {
    return this.queryService.getCashflowProjection();
  }

  create(dto: CreateLoanDto, userId?: string): Promise<LoanResponseDto> {
    return this.commandService.create(dto, userId);
  }

  createBatch(
    dtos: CreateLoanDto[],
    userId?: string,
  ): Promise<LoanResponseDto[]> {
    return this.commandService.createBatch(dtos, userId);
  }

  update(id: string, dto: UpdateLoanDto): Promise<LoanResponseDto> {
    return this.commandService.update(id, dto);
  }

  remove(id: string): Promise<void> {
    return this.commandService.remove(id);
  }

  recordPayment(
    loanId: string,
    dto: RecordPaymentDto,
    userId?: string,
  ): Promise<LoanResponseDto> {
    return this.commandService.recordPayment(loanId, dto, userId);
  }

  simulate(dto: SimulateLoanDto): LoanSimulationResult {
    return LoanAmortizationEngine.generateSchedule(dto);
  }
}
