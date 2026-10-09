import { Injectable, Logger } from '@nestjs/common';
import { GarageCashflowQueryEngine } from './engines/garage-cashflow-query.engine';
import { GarageCashflowTransactionService } from './garage-cashflow-transaction.service';
import {
  CreateKgaraCashflowVoucherDto,
  UpdateKgaraCashflowVoucherDto,
  ListKgaraCashflowVoucherQueryDto,
} from '../dto/garage-cashflow.dto';

@Injectable()
export class GarageCashflowService {
  private readonly logger = new Logger(GarageCashflowService.name);

  constructor(
    private readonly queryEngine: GarageCashflowQueryEngine,
    private readonly transactionService: GarageCashflowTransactionService,
  ) {}

  async createVoucher(dto: CreateKgaraCashflowVoucherDto) {
    return this.transactionService.createVoucher(dto);
  }

  async updateVoucher(id: string, dto: UpdateKgaraCashflowVoucherDto) {
    return this.transactionService.updateVoucher(id, dto);
  }

  async deleteVoucher(id: string) {
    return this.transactionService.deleteVoucher(id);
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

  async listVouchers(query: ListKgaraCashflowVoucherQueryDto) {
    return this.queryEngine.listVouchers(query);
  }
}
