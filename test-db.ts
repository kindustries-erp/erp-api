import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { ErpInvoicesCoreService } from './src/erp-invoices-core/erp-invoices-core.service';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(ErpInvoicesCoreService);
  
  const invoice = await service['repository'].findOne({ 
    where: { direction: 'IN' }, 
    order: { createdAt: 'DESC' },
    relations: ['items']
  });
  
  if (invoice) {
    console.log('Latest invoice:', invoice.invoiceNo);
    console.log('Seller:', invoice.sellerName);
    console.log('Items count:', invoice.items?.length);
    console.log('XML Key:', invoice.xmlFileKey);
  } else {
    console.log('No invoice found');
  }
  
  await app.close();
}
run();
