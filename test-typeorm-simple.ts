import { DataSource } from 'typeorm';
import { ErpInvoice } from './src/erp-invoices-core/entities/erp_invoice.entity';

async function bootstrap() {
  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL + '?sslmode=require',
    entities: [ErpInvoice],
    synchronize: false,
  });

  await dataSource.initialize();
  const repo = dataSource.getRepository(ErpInvoice);
  
  const exactCandidates = await repo.find({
    where: { invoiceNoNormalized: '6048', direction: 'IN' } as any,
    order: { createdAt: 'DESC' },
  });
  console.log('Candidates found:', exactCandidates.length);
  if (exactCandidates.length > 0) {
    console.log(exactCandidates[0].id);
  }
  await dataSource.destroy();
}
bootstrap().catch(console.error);
