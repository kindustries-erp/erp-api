import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErpChartOfAccount } from './entities/erp_chart_of_account.entity';
import { ErpJournalEntry } from './entities/erp_journal_entry.entity';
import { ErpJournalEntryLine } from './entities/erp_journal_entry_line.entity';
import { AccountingCoreController } from './controllers/accounting-core.controller';
import { AccountingCoreService } from './services/accounting-core.service';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ErpChartOfAccount,
      ErpJournalEntry,
      ErpJournalEntryLine,
    ]),
    CommonModule,
  ],
  controllers: [AccountingCoreController],
  providers: [AccountingCoreService],
  exports: [AccountingCoreService],
})
export class AccountingCoreModule {}
