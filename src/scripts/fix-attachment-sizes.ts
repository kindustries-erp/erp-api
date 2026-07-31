import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ErpAttachment } from '../erp-attachments-core/entities/erp_attachment.entity';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { R2Service } from '../r2/r2.service';
import { HeadObjectCommand } from '@aws-sdk/client-s3';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const attachmentRepo = app.get<Repository<ErpAttachment>>(
    getRepositoryToken(ErpAttachment),
  );
  const r2Service = app.get<R2Service>(R2Service);

  const attachments = await attachmentRepo.find({ where: { fileSize: 0 } });
  console.log(`Found ${attachments.length} attachments with fileSize 0`);

  let count = 0;
  const chunkSize = 20;
  const client = (r2Service as any).client;
  const bucket = (r2Service as any).bucket;

  for (let i = 0; i < attachments.length; i += chunkSize) {
    const chunk = attachments.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (attachment) => {
        try {
          const response = await client.send(
            new HeadObjectCommand({ Bucket: bucket, Key: attachment.fileKey }),
          );
          if (response.ContentLength) {
            attachment.fileSize = response.ContentLength;
            await attachmentRepo.save(attachment);
            count++;
          }
        } catch (e) {
          // console.log(`Failed for ${attachment.fileName}: ${e.message}`);
        }
      }),
    );
    console.log(
      `Processed ${Math.min(i + chunkSize, attachments.length)}/${attachments.length} files. Updated: ${count}`,
    );
  }

  console.log(`Successfully updated ${count} attachments`);
  await app.close();
}

bootstrap();
