import { Injectable } from '@nestjs/common';
import {
  CreateBankAccountDto,
  UpdateBankAccountDto,
} from './dto/create-bank-account.dto';
import {
  CreateCashBookDto,
  UpdateCashBookDto,
} from './dto/create-cash-book.dto';
import { BankTransactionFilterDto } from './dto/bank-transaction-filter.dto';
import {
  CreateBankAccountBalanceDto,
  UpdateBankAccountBalanceDto,
} from './dto/create-bank-account-balance.dto';
import {
  CreateCashBookBalanceDto,
  UpdateCashBookBalanceDto,
} from './dto/create-cash-book-balance.dto';
import { CreateBankTransactionDto } from './dto/create-bank-transaction.dto';
import { PostBankTransactionDto } from './dto/post-bank-transaction.dto';
import { BankAccountLifecycleService } from './services/bank-account-lifecycle.service';
import { CashBookLifecycleService } from './services/cash-book-lifecycle.service';
import { BalanceStatementLifecycleService } from './services/balance-statement-lifecycle.service';
import { TransactionImportService } from './services/transaction-import.service';
import { TransactionQueryService } from './services/transaction-query.service';
import { TransactionAnalyticsService } from './services/transaction-analytics.service';
import { TransactionAccountingService } from './services/transaction-accounting.service';

@Injectable()
export class BankTransactionsCoreService {
  constructor(
    private readonly bankAccountLifecycleService: BankAccountLifecycleService,
    private readonly cashBookLifecycleService: CashBookLifecycleService,
    private readonly balanceStatementLifecycleService: BalanceStatementLifecycleService,
    private readonly transactionImportService: TransactionImportService,
    private readonly transactionQueryService: TransactionQueryService,
    private readonly transactionAnalyticsService: TransactionAnalyticsService,
    private readonly transactionAccountingService: TransactionAccountingService,
  ) {}

  // --- Bank Accounts ---
  async getBankAccounts(
    branchId?: string,
    startDate?: string,
    endDate?: string,
  ) {
    return this.bankAccountLifecycleService.getBankAccounts(
      branchId,
      startDate,
      endDate,
    );
  }

  async createBankAccount(dto: CreateBankAccountDto) {
    return this.bankAccountLifecycleService.createBankAccount(dto);
  }

  async updateBankAccount(id: string, dto: UpdateBankAccountDto) {
    return this.bankAccountLifecycleService.updateBankAccount(id, dto);
  }

  async deleteBankAccount(id: string) {
    return this.bankAccountLifecycleService.deleteBankAccount(id);
  }

  // --- Cash Books ---
  async getCashBooks(branchId?: string, startDate?: string, endDate?: string) {
    return this.cashBookLifecycleService.getCashBooks(
      branchId,
      startDate,
      endDate,
    );
  }

  async createCashBook(dto: CreateCashBookDto) {
    return this.cashBookLifecycleService.createCashBook(dto);
  }

  async updateCashBook(id: string, dto: UpdateCashBookDto) {
    return this.cashBookLifecycleService.updateCashBook(id, dto);
  }

  async deleteCashBook(id: string) {
    return this.cashBookLifecycleService.deleteCashBook(id);
  }

  // --- Transactions ---
  async getTransaction(id: string) {
    return this.transactionQueryService.getTransaction(id);
  }

  async getTransactionPosting(id: string) {
    return this.transactionAccountingService.getTransactionPosting(id);
  }

  async postTransaction(id: string, dto: PostBankTransactionDto) {
    return this.transactionAccountingService.postTransaction(id, dto);
  }

  async unpostTransaction(id: string) {
    return this.transactionAccountingService.unpostTransaction(id);
  }

  async getTransactions(filter: BankTransactionFilterDto) {
    return this.transactionQueryService.getTransactions(filter);
  }

  async getColumnOptions(
    column: string,
    search: string,
    page: number = 1,
    pageSize: number = 20,
    filtersStr?: string,
    sourceType?: 'BANK' | 'CASH',
  ) {
    return this.transactionQueryService.getColumnOptions(
      column,
      search,
      page,
      pageSize,
      filtersStr,
      sourceType,
    );
  }

  async getPartnerStats(filter: BankTransactionFilterDto) {
    return this.transactionAnalyticsService.getPartnerStats(filter);
  }

  async getDashboardStats(filter: BankTransactionFilterDto) {
    return this.transactionAnalyticsService.getDashboardStats(filter);
  }

  async createManualTransaction(dto: CreateBankTransactionDto) {
    return this.transactionAccountingService.createManualTransaction(dto);
  }

  async updateTransaction(
    id: string,
    dto: import('./dto/update-bank-transaction.dto').UpdateBankTransactionDto,
  ) {
    return this.transactionAccountingService.updateTransaction(id, dto);
  }

  /**
   * Re-generates journal entries for a bank transaction.
   * Handles split entries when multiple invoices with different subjects
   * are linked to the same bank transaction.
   */
  async refreshJournalEntriesForBankTransaction(txnId: string): Promise<void> {
    return this.transactionAccountingService.refreshJournalEntriesForBankTransaction(
      txnId,
    );
  }

  async importFiles(
    files: Express.Multer.File[],
    branchId: string,
    bankAccountId?: string,
    cashBookId?: string,
  ) {
    return this.transactionImportService.importFiles(
      files,
      branchId,
      bankAccountId,
      cashBookId,
    );
  }

  async rollbackBatch(importBatchId: string) {
    return this.transactionImportService.rollbackBatch(importBatchId);
  }

  // --- Bank Account Balances ---
  async getBankAccountBalances(bankAccountId: string) {
    return this.balanceStatementLifecycleService.getBankAccountBalances(
      bankAccountId,
    );
  }

  async createBankAccountBalance(dto: CreateBankAccountBalanceDto) {
    return this.balanceStatementLifecycleService.createBankAccountBalance(dto);
  }

  async updateBankAccountBalance(id: string, dto: UpdateBankAccountBalanceDto) {
    return this.balanceStatementLifecycleService.updateBankAccountBalance(
      id,
      dto,
    );
  }

  async deleteBankAccountBalance(id: string) {
    return this.balanceStatementLifecycleService.deleteBankAccountBalance(id);
  }

  // --- Cash Book Balances ---
  async getCashBookBalances(cashBookId: string) {
    return this.balanceStatementLifecycleService.getCashBookBalances(
      cashBookId,
    );
  }

  async createCashBookBalance(dto: CreateCashBookBalanceDto) {
    return this.balanceStatementLifecycleService.createCashBookBalance(dto);
  }

  async updateCashBookBalance(id: string, dto: UpdateCashBookBalanceDto) {
    return this.balanceStatementLifecycleService.updateCashBookBalance(id, dto);
  }

  async deleteCashBookBalance(id: string) {
    return this.balanceStatementLifecycleService.deleteCashBookBalance(id);
  }

  // --- Bank Statement Files ---
  async getStatementFiles(params: {
    page?: number;
    pageSize?: number;
    branchId?: string;
    bankAccountId?: string;
    cashBookId?: string;
  }) {
    return this.balanceStatementLifecycleService.getStatementFiles(params);
  }

  async createStatementFile(
    dto: import('./dto/create-bank-statement-file.dto').CreateBankStatementFileDto,
  ) {
    return this.balanceStatementLifecycleService.createStatementFile(dto);
  }

  async linkInvoiceToTransaction(
    txnId: string,
    payload: { invoiceId: string; netOffAmount?: number },
  ) {
    return this.transactionAccountingService.linkInvoiceToTransaction(
      txnId,
      payload,
    );
  }

  async removeInvoiceFromTransaction(
    txnId: string,
    invoiceIdOrNetOffId: string,
  ) {
    return this.transactionAccountingService.removeInvoiceFromTransaction(
      txnId,
      invoiceIdOrNetOffId,
    );
  }

  async deleteStatementFile(id: string) {
    return this.balanceStatementLifecycleService.deleteStatementFile(id);
  }
}
