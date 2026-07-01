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

import { AccountingCoreModule } from '../accounting-core/accounting-core.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ErpBankAccount,
      ErpCashBook,
      ErpBankTransaction,
      ErpBankAccountBalance,
      ErpCashBookBalance,
    ]),
    RbacCoreModule,
    AccountingCoreModule,
  ],
  controllers: [BankTransactionsCoreController],
  providers: [BankTransactionsCoreService],
  exports: [BankTransactionsCoreService],
})
export class BankTransactionsCoreModule {}
