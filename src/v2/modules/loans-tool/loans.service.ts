import { Injectable } from '@nestjs/common';
import { toPaginatedResult } from '@/common/utils/paginated-result';
import { LoanQueryService } from './services/loan-query.service';
import { LoanCommandService } from './services/loan-command.service';
import { LoanMapper } from './helpers/loan.mapper';
import {
  CashflowProjectionResponseDto,
  CreateLoanDto,
  LoanListResponseDto,
  LoanResponseDto,
  QueryLoanDto,
  RecordPaymentDto,
  SimulateLoanDto,
  UpdateLoanDto,
  UpdatePaymentDto,
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

  async findAll(
    query: QueryLoanDto,
    userId?: string,
  ): Promise<LoanListResponseDto> {
    const out = await this.queryService.findAll(query, userId);
    return toPaginatedResult(
      out.rows.map((item) => LoanMapper.toDto(item, false)),
      out.page,
      out.pageSize,
      out.total,
      out.summaries,
    );
  }

  findColumnOptions(
    column: string,
    search: string | undefined,
    page: number,
    pageSize: number,
    filters?: unknown,
    deleted?: 'only',
    userId?: string,
  ) {
    return this.queryService.findColumnOptions(
      column,
      search,
      page,
      pageSize,
      filters,
      deleted,
      userId,
    );
  }

  findOne(id: string, userId?: string): Promise<LoanResponseDto> {
    return this.queryService.findOne(id, userId);
  }

  getCashflowProjection(
    includeAllPeriods = false,
    userId?: string,
  ): Promise<CashflowProjectionResponseDto> {
    return this.queryService.getCashflowProjection(includeAllPeriods, userId);
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

  update(
    id: string,
    dto: UpdateLoanDto,
    userId?: string,
  ): Promise<LoanResponseDto> {
    return this.commandService.update(id, dto, userId);
  }

  remove(id: string, userId?: string): Promise<void> {
    return this.commandService.remove(id, userId);
  }

  async hardDelete(id: string, userId?: string): Promise<{ id: string }> {
    await this.commandService.hardDelete(id, userId);
    return { id };
  }

  recordPayment(
    loanId: string,
    dto: RecordPaymentDto,
    userId?: string,
  ): Promise<LoanResponseDto> {
    return this.commandService.recordPayment(loanId, dto, userId);
  }

  updatePayment(
    loanId: string,
    paymentId: string,
    dto: UpdatePaymentDto,
    userId?: string,
  ): Promise<LoanResponseDto> {
    return this.commandService.updatePayment(loanId, paymentId, dto, userId);
  }

  deletePayment(
    loanId: string,
    paymentId: string,
    userId?: string,
  ): Promise<LoanResponseDto> {
    return this.commandService.deletePayment(loanId, paymentId, userId);
  }

  simulate(dto: SimulateLoanDto): LoanSimulationResult {
    return LoanAmortizationEngine.generateSchedule(dto);
  }
}
