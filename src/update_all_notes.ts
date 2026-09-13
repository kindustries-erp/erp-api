import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ErpInvoicesCoreService } from './erp-invoices-core/erp-invoices-core.service';
import { Repository } from 'typeorm';
import { ErpInvoice } from './erp-invoices-core/entities/erp_invoice.entity';
import { getRepositoryToken } from '@nestjs/typeorm';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const invoiceService = app.get(ErpInvoicesCoreService);
  const repo: Repository<ErpInvoice> = app.get(getRepositoryToken(ErpInvoice));

  console.log('Fetching all invoices with XML...');
  const invoices = await repo.find({
    where: { source: 'PORTAL' },
  });

  console.log(`Found ${invoices.length} invoices. Reparsing...`);

  let successCount = 0;
  let failCount = 0;

  for (const inv of invoices) {
    if (inv.xmlFileKey) {
      try {
        console.log(`Reparsing invoice ${inv.invoiceNo}...`);
        await invoiceService.syncDetailFromPortal(inv.id);
        successCount++;
      } catch (err) {
        console.error(`Failed for invoice ${inv.invoiceNo}:`, err.message);
        failCount++;
      }
    }
  }

  console.log(`Done! Success: ${successCount}, Failed: ${failCount}`);
  await app.close();
}

bootstrap();
