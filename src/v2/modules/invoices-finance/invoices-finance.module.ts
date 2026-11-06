import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinanceInvoice } from './entities/finance-invoice.entity';
import { FinanceInvoiceItem } from './entities/finance-invoice-item.entity';
import { FinanceInvoiceController } from './controllers/finance-invoice.controller';
import { FinanceInvoicesService } from './invoices-finance.service';
import { FinanceInvoiceCommandService } from './services/finance-invoice-command.service';
import { FinanceInvoiceQueryService } from './services/finance-invoice-query.service';
import { InvoicesCoreModule } from '@/v2/core/invoices-core/invoices-core.module';
import { R2Module } from '@/r2/r2.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FinanceInvoice, FinanceInvoiceItem]),
    InvoicesCoreModule,
    R2Module,
  ],
  controllers: [FinanceInvoiceController],
  providers: [
    FinanceInvoicesService,
    FinanceInvoiceQueryService,
    FinanceInvoiceCommandService,
  ],
  exports: [FinanceInvoicesService],
})
export class FinanceInvoicesModule {}

export { FinanceInvoicesModule as InvoicesModule };
