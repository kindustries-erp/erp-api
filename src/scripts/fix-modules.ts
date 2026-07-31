import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ErpAttachment } from '../erp-attachments-core/entities/erp_attachment.entity';
import { Repository, IsNull } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const attachmentRepo = app.get<Repository<ErpAttachment>>(
    getRepositoryToken(ErpAttachment),
  );

  const res = await attachmentRepo.update(
    { module: IsNull() as any },
    { module: 'invoices' },
  );

  console.log(`Updated ${res.affected} attachments with module='invoices'`);
  await app.close();
}

bootstrap();
