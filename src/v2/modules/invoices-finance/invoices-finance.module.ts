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
import { FileAttachmentsModule } from '@/v2/modules/file-attachments/file-attachments.module';
import { InvoiceAttachmentsController } from './controllers/invoice-attachments.controller';
import { InvoiceFileOwnerPolicy } from './helpers/invoice-file-owner.policy';

@Module({
  imports: [
    TypeOrmModule.forFeature([FinanceInvoice, FinanceInvoiceItem]),
    InvoicesCoreModule,
    R2Module,
    FileAttachmentsModule,
  ],
  controllers: [FinanceInvoiceController, InvoiceAttachmentsController],
  providers: [
    FinanceInvoicesService,
    FinanceInvoiceQueryService,
    FinanceInvoiceCommandService,
    InvoiceFileOwnerPolicy,
  ],
  exports: [FinanceInvoicesService],
})
export class FinanceInvoicesModule {}

export { FinanceInvoicesModule as InvoicesModule };
