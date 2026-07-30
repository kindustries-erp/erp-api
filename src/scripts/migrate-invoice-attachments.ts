import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { Connection } from 'typeorm';
import { ErpInvoice } from '../erp-invoices-core/entities/erp_invoice.entity';
import {
  ErpAttachment,
  DocumentType,
} from '../erp-attachments-core/entities/erp_attachment.entity';
import { ErpInvoiceAttachment } from '../erp-invoices-core/entities/erp_invoice_attachment.entity';
import * as crypto from 'crypto';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const connection = app.get(Connection);

  console.log('Starting migration for invoice attachments...');

  const invoiceRepo = connection.getRepository(ErpInvoice);
  const attachmentRepo = connection.getRepository(ErpAttachment);
  const linkRepo = connection.getRepository(ErpInvoiceAttachment);

  const invoices = await invoiceRepo.find({
    where: { isDeleted: false },
  });

  console.log(`Found ${invoices.length} active invoices.`);

  let migratedCount = 0;

  for (const invoice of invoices) {
    let filesToMigrate: any[] = [];

    if (Array.isArray(invoice.pdfFiles) && invoice.pdfFiles.length > 0) {
      filesToMigrate = invoice.pdfFiles;
    } else if (invoice.pdfFileKey) {
      filesToMigrate.push({
        key: invoice.pdfFileKey,
        filename: invoice.pdfFileKey.split('/').pop() || 'document.pdf',
      });
    }

    if (filesToMigrate.length === 0) continue;

    for (const file of filesToMigrate) {
      // Check if attachment already exists
      let attachment = await attachmentRepo.findOne({
        where: { fileKey: file.key },
      });

      if (!attachment) {
        attachment = attachmentRepo.create({
          id: crypto.randomUUID(),
          fileName: file.filename || 'document.pdf',
          fileKey: file.key,
          fileSize: 0,
          mimeType: 'application/pdf',
          documentType: DocumentType.HOA_DON,
          createdBy: invoice.createdBy,
        });
        await attachmentRepo.save(attachment);
      }

      // Check if link exists
      const linkExists = await linkRepo.findOne({
        where: { invoiceId: invoice.id, attachmentId: attachment.id },
      });

      if (!linkExists) {
        const newLink = linkRepo.create({
          invoiceId: invoice.id,
          attachmentId: attachment.id,
        });
        await linkRepo.save(newLink);
        migratedCount++;
      }
    }
  }

  console.log(`Successfully migrated ${migratedCount} attachments.`);

  await app.close();
}

bootstrap().catch(console.error);
