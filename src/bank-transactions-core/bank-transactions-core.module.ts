import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RbacCoreModule } from '../rbac-core/rbac-core.module';
import { BankTransactionsCoreService } from './bank-transactions-core.service';
import { BankTransactionsCoreController } from './bank-transactions-core.controller';
import { ErpBankAccount } from './entities/erp_bank_account.entity';
import { ErpCashBook } from './entities/erp_cash_book.entity';
import { ErpBankTransaction } from './entities/erp_bank_transaction.entity';
import { ErpBankAccountBalance } from './entities/erp_bank_account_balance.entity';
import { ErpCashBookBalance } from './entities/erp_cash_book_balance.entity';
import { ErpBankStatementFile } from './entities/erp_bank_statement_file.entity';
import { AccountingCoreModule } from '../accounting-core/accounting-core.module';
import { BankAccountLifecycleService } from './services/bank-account-lifecycle.service';
import { CashBookLifecycleService } from './services/cash-book-lifecycle.service';
import { BalanceStatementLifecycleService } from './services/balance-statement-lifecycle.service';
import { TransactionImportService } from './services/transaction-import.service';
import { TransactionQueryService } from './services/transaction-query.service';
import { TransactionAnalyticsService } from './services/transaction-analytics.service';
import { TransactionAccountingService } from './services/transaction-accounting.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ErpBankAccount,
      ErpCashBook,
      ErpBankTransaction,
      ErpBankAccountBalance,
      ErpCashBookBalance,
      ErpBankStatementFile,
    ]),
    RbacCoreModule,
    AccountingCoreModule,
  ],
  controllers: [BankTransactionsCoreController],
  providers: [
    BankTransactionsCoreService,
    BankAccountLifecycleService,
    CashBookLifecycleService,
    BalanceStatementLifecycleService,
    TransactionImportService,
    TransactionQueryService,
    TransactionAnalyticsService,
    TransactionAccountingService,
  ],
  exports: [BankTransactionsCoreService],
})
export class BankTransactionsCoreModule {}
