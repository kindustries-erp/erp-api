import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VinfastPartsService } from './vinfast-parts.service';
import { VinfastPartsController } from './vinfast-parts.controller';
import { VinfastPartsCatalog } from './entities/vinfast-parts-catalog.entity';
import { VinfastPartsLedger } from './entities/vinfast-parts-ledger.entity';
import { ErpInvoiceItem } from '../erp-invoices-core/entities/erp_invoice_item.entity';
import { ErpInvoice } from '../erp-invoices-core/entities/erp_invoice.entity';
import { VinfastPartsSyncService } from './services/vinfast-parts-sync.service';
import { VinfastPartsStockService } from './services/vinfast-parts-stock.service';
import { VinfastPartsLedgerService } from './services/vinfast-parts-ledger.service';
import { VinfastPartsStockExportBackgroundService } from './services/vinfast-parts-stock-export-background.service';

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
  providers: [
    VinfastPartsService,
    VinfastPartsSyncService,
    VinfastPartsStockService,
    VinfastPartsLedgerService,
    VinfastPartsStockExportBackgroundService,
  ],
  exports: [
    VinfastPartsService,
    VinfastPartsSyncService,
    VinfastPartsStockService,
    VinfastPartsLedgerService,
    VinfastPartsStockExportBackgroundService,
  ],
})
export class VinfastPartsModule {}
