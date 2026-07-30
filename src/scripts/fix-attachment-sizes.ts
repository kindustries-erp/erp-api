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
  for (const attachment of attachments) {
    try {
      const command = new HeadObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME || 'invoice-bucket', // Wait, R2Service uses a specific bucket, I'll use r2Service directly
        Key: attachment.fileKey,
      });
      // But r2Service doesn't expose s3 directly easily?
      const client = (r2Service as any).client;
      const bucket = (r2Service as any).bucket;
      const response = await client.send(
        new HeadObjectCommand({ Bucket: bucket, Key: attachment.fileKey }),
      );

      if (response.ContentLength) {
        attachment.fileSize = response.ContentLength;
        await attachmentRepo.save(attachment);
        count++;
        console.log(
          `Updated ${attachment.fileName} to ${attachment.fileSize} bytes`,
        );
      }
    } catch (e) {
      console.log(`Failed for ${attachment.fileName}: ${e.message}`);
    }
  }

  console.log(`Successfully updated ${count} attachments`);
  await app.close();
}

bootstrap();
