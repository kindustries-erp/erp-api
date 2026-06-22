import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { ProductionCoreService } from './src/production-core/production-core.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(ProductionCoreService);
  try {
    const repo = service['productionOrderRepo'];
    const qb = repo.createQueryBuilder('po');
    qb.addSelect('(po.qty_produced / NULLIF(po.qty_to_produce, 0))', 'progress_percent');
    qb.addOrderBy('progress_percent', 'ASC');
    
    const [orders, count] = await qb.getManyAndCount();
    console.log("Success", orders.length, count);
  } catch (e) {
    require('fs').writeFileSync('error.txt', e.stack || e.message);
  }
  await app.close();
}
bootstrap();
