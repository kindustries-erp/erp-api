import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VinfastPartsService } from './vinfast-parts.service';
import { VinfastPartsController } from './vinfast-parts.controller';
import { VinfastPartsCatalog } from './entities/vinfast-parts-catalog.entity';
import { VinfastPartsLedger } from './entities/vinfast-parts-ledger.entity';
import { ErpInvoiceItem } from '../erp-invoices-core/entities/erp_invoice_item.entity';
import { ErpInvoice } from '../erp-invoices-core/entities/erp_invoice.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      VinfastPartsCatalog,
      VinfastPartsLedger,
      ErpInvoiceItem,
      ErpInvoice,
    ]),
  ],
  controllers: [VinfastPartsController],
  providers: [VinfastPartsService],
  exports: [VinfastPartsService],
})
export class VinfastPartsModule {}
