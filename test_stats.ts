import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { BankTransactionsCoreService } from './src/bank-transactions-core/bank-transactions-core.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(BankTransactionsCoreService);
  const stats = await service.getPartnerStats({ page: 1, pageSize: 5 });
  console.log(JSON.stringify(stats, null, 2));
  await app.close();
}
bootstrap();
