import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from './entities/invoice.entity';
import { InvoiceController } from './controllers/invoice.controller';
import { InvoicesService } from './invoices.service';
import { InvoiceCommandService } from './services/invoice-command.service';
import { InvoiceQueryService } from './services/invoice-query.service';
import { R2Module } from '@/r2/r2.module';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice]), R2Module],
  controllers: [InvoiceController],
  providers: [InvoicesService, InvoiceQueryService, InvoiceCommandService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
