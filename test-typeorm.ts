import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ErpInvoice } from './src/erp-invoices-core/entities/erp_invoice.entity';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const repo = app.get(getRepositoryToken(ErpInvoice));
  
  const exactCandidates = await repo.find({
    where: { invoiceNoNormalized: '6048', direction: 'IN' },
    order: { createdAt: 'DESC' },
  });
  console.log('Candidates found:', exactCandidates.length);
  if (exactCandidates.length > 0) {
    console.log(exactCandidates[0].id);
  }
  await app.close();
}
bootstrap().catch(console.error);
