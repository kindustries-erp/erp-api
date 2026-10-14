import { Injectable, Logger } from '@nestjs/common';
import { GarageCashflowQueryEngine } from './engines/garage-cashflow-query.engine';
import { GarageCashflowDuplicateEngine } from './engines/garage-cashflow-duplicate.engine';
import { GarageCashflowTransactionService } from './garage-cashflow-transaction.service';
import {
  CreateKgaraCashflowVoucherDto,
  UpdateKgaraCashflowVoucherDto,
  ListKgaraCashflowVoucherQueryDto,
  KgaraCashflowVoucherResponseDto,
  CheckKgaraCashflowDuplicateQueryDto,
  KgaraCashflowDuplicateResponseDto,
} from '../dto/garage-cashflow.dto';

@Injectable()
export class GarageCashflowService {
  private readonly logger = new Logger(GarageCashflowService.name);

  constructor(
    private readonly queryEngine: GarageCashflowQueryEngine,
    private readonly transactionService: GarageCashflowTransactionService,
    private readonly duplicateEngine: GarageCashflowDuplicateEngine,
  ) {}

  async findPotentialDuplicates(
    query: CheckKgaraCashflowDuplicateQueryDto,
  ): Promise<KgaraCashflowDuplicateResponseDto> {
    return this.duplicateEngine.findPotentialDuplicates(query);
  }

  async createVoucher(
    dto: CreateKgaraCashflowVoucherDto,
    user?: { sub?: string; email?: string },
  ): Promise<KgaraCashflowVoucherResponseDto> {
    return this.transactionService.createVoucher(dto, user);
  }

  async updateVoucher(
    id: string,
    dto: UpdateKgaraCashflowVoucherDto,
    user?: { sub?: string; email?: string },
  ): Promise<KgaraCashflowVoucherResponseDto> {
    return this.transactionService.updateVoucher(id, dto, user);
  }

  async deleteVoucher(id: string, user?: { sub?: string; email?: string }) {
    return this.transactionService.deleteVoucher(id, user);
  }

  async getDashboardStats() {
    return this.queryEngine.getDashboardStats();
  }

  async getColumnOptions(
    column: string,
    search: string,
    page: number = 1,
    pageSize: number = 20,
    filtersStr?: string,
  ) {
    return this.queryEngine.getColumnOptions(
      column,
      search,
      page,
      pageSize,
      filtersStr,
    );
  }

  async listVouchers(
    query: ListKgaraCashflowVoucherQueryDto,
  ): Promise<{ data: KgaraCashflowVoucherResponseDto[]; total: number }> {
    return this.queryEngine.listVouchers(query);
  }
}
