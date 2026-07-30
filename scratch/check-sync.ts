import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { SinvoiceService } from '../src/sinvoice/sinvoice.service';
import { getRepository } from 'typeorm';
dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  entities: [__dirname + '/src/**/*.entity.ts'],
});

async function run() {
  await AppDataSource.initialize();
  const draftRepo = AppDataSource.getRepository('SinvoiceDraft');
  const service = new SinvoiceService(draftRepo as any, {} as any);
  
  // mock logger and getConfig
  (service as any).logger = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  };
  (service as any).getConfig = async () => ({
    username: '0318334886-003',
    password: 'Viettel@123',
    supplierTaxCode: '0318334886',
  });

  const res = await service.syncDraftsFromViettel();
  console.log('Sync result:', res);
  await AppDataSource.destroy();
}
run().catch(console.error);
