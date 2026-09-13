import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { VinfastPartsService } from './vinfast-parts/vinfast-parts.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(VinfastPartsService);

  console.log('--- SYNC CATALOG ---');
  await service.syncCatalog();

  console.log('--- SYNC LEDGER ---');
  await service.syncLedger();

  await app.close();
}

bootstrap();
