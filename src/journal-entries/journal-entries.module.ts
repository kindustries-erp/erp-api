import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JournalEntriesController } from './journal-entries.controller';
import { JournalEntriesService } from './journal-entries.service';
import { ErpJournalEntry } from './entities/erp_journal_entry.entity';
import { ErpJournalEntryLine } from './entities/erp_journal_entry_line.entity';
import { ErpAccountingPeriod } from './entities/erp_accounting_period.entity';
import { ErpChartOfAccount } from './entities/erp_chart_of_account.entity';
import { ErpJournalEntryAttachment } from './entities/erp_journal_entry_attachment.entity';
import { R2Service } from '../erp-invoices-core/r2/r2.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ErpJournalEntry,
      ErpJournalEntryLine,
      ErpAccountingPeriod,
      ErpChartOfAccount,
      ErpJournalEntryAttachment,
    ]),
    ConfigModule,
  ],
  controllers: [JournalEntriesController],
  providers: [JournalEntriesService, R2Service],
  exports: [JournalEntriesService],
})
export class JournalEntriesModule {}
