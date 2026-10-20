import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ErpInvoice } from '../entities/erp_invoice.entity';
import { ErpInvoiceAttachment } from '../entities/erp_invoice_attachment.entity';
import { R2Service } from '../../r2/r2.service';
import { ErpAttachmentsCoreService } from '../../erp-attachments-core/erp-attachments-core.service';
import type { ErpInvoiceQuery } from '../erp-invoices-core.service';
import { buildInvoiceFileName } from '../utils/invoice-file-name.util';
import { InvoiceBulkDownloadService } from './sub-services/invoice-bulk-download.service';

/**
 * Facade: giữ nguyên chữ ký public cho controller/service khác.
 * Logic zip hàng loạt nằm ở InvoiceBulkDownloadService.
 */
@Injectable()
export class InvoiceFilesService {
  constructor(
    @InjectRepository(ErpInvoice)
    private readonly repository: Repository<ErpInvoice>,
    @InjectRepository(ErpInvoiceAttachment)
    private readonly linkRepository: Repository<ErpInvoiceAttachment>,
    private readonly r2: R2Service,
    private readonly attachmentsService: ErpAttachmentsCoreService,
    private readonly bulkDownload: InvoiceBulkDownloadService,
  ) {}

  // ---------------------------------------------------------------------------
  // Pre-signed URLs
  // ---------------------------------------------------------------------------

  async getFileDownloadUrl(
    invoiceId: string,
    fileType: 'pdf' | 'xml',
  ): Promise<{ url: string; expiresAt: string }> {
    const invoice = await this.repository.findOne({ where: { id: invoiceId } });
    if (!invoice)
      throw new NotFoundException(`Invoice ${invoiceId} không tìm thấy`);

    const key = fileType === 'pdf' ? invoice.pdfFileKey : invoice.xmlFileKey;
    if (!key)
      throw new BadRequestException(
        `Invoice chưa có file ${fileType.toUpperCase()} trên R2`,
      );

    const ext = key.split('.').pop() || fileType;
    const filename = buildInvoiceFileName(invoice, ext);
    const url = await this.r2.getPresignedDownloadUrl(key, 3600, filename);
    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
    return { url, expiresAt };
  }

  async getFileUploadUrl(
    invoiceId: string,
    fileType: 'pdf' | 'xml',
  ): Promise<{ url: string; key: string; expiresAt: string }> {
    const invoice = await this.repository.findOne({ where: { id: invoiceId } });
    if (!invoice)
      throw new NotFoundException(`Invoice ${invoiceId} không tìm thấy`);

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const safeNo = invoice.invoiceNo.replace(/[^\w-]/g, '_');
    const key = `invoices/${invoice.direction}/${yyyy}/${mm}/${safeNo}.${fileType}`;
    const contentType =
      fileType === 'pdf' ? 'application/pdf' : 'application/xml';

    const url = await this.r2.getPresignedUploadUrl(key, contentType, 900);
    const expiresAt = new Date(Date.now() + 900 * 1000).toISOString();

    if (fileType === 'pdf') {
      await this.repository.update(invoiceId, { pdfFileKey: key } as any);
    } else {
      await this.repository.update(invoiceId, { xmlFileKey: key } as any);
    }

    return { url, key, expiresAt };
  }

  // ---------------------------------------------------------------------------
  // PDF upload / download
  // ---------------------------------------------------------------------------

  async uploadPdfs(
    invoiceId: string,
    files: { filename: string; buffer: Buffer; mimetype: string }[],
    documentType = 'HOA_DON',
    userId?: string,
  ) {
    const invoice = await this.repository.findOne({ where: { id: invoiceId } });
    if (!invoice)
      throw new NotFoundException(`Invoice ${invoiceId} không tìm thấy`);

    const uploadPromises = files.map(async (file) => {
      const attachment = await this.attachmentsService.uploadFile(
        file,
        documentType,
        userId ?? '',
      );

      const link = this.linkRepository.create({
        invoiceId,
        attachmentId: attachment.id,
      });
      await this.linkRepository.save(link);

      return attachment;
    });

    const newAttachments = await Promise.all(uploadPromises);
    return { success: true, attachments: newAttachments };
  }

  async linkAttachment(invoiceId: string, attachmentId: string) {
    const existing = await this.linkRepository.findOne({
      where: { invoiceId, attachmentId },
    });
    if (existing) {
      return { success: true, message: 'Already linked' };
    }
    const link = this.linkRepository.create({ invoiceId, attachmentId });
    await this.linkRepository.save(link);
    return { success: true, message: 'Linked successfully' };
  }

  async unlinkAttachment(invoiceId: string, attachmentId: string) {
    await this.linkRepository.delete({ invoiceId, attachmentId });
    return { success: true, message: 'Unlinked successfully' };
  }

  async getPdfContent(invoiceId: string, fileKey: string): Promise<Buffer> {
    const invoice = await this.repository.findOne({ where: { id: invoiceId } });
    if (!invoice)
      throw new NotFoundException(`Invoice ${invoiceId} không tìm thấy`);
    return this.r2.downloadBuffer(fileKey);
  }

  async getPdfDownloadUrl(invoiceId: string, fileKey: string, inline = false) {
    const invoice = await this.repository.findOne({
      where: { id: invoiceId },
      relations: ['attachments'],
    });
    if (!invoice)
      throw new NotFoundException(`Invoice ${invoiceId} không tìm thấy`);

    const link = invoice.attachments?.find(
      (a) => a.attachment.fileKey === fileKey,
    );
    const file = link ? link.attachment : null;
    const filename = file
      ? file.fileName
      : fileKey.split('/').pop() || 'document.pdf';

    const url = await this.r2.getPresignedDownloadUrl(
      fileKey,
      3600,
      filename,
      inline,
    );
    return { url };
  }

  async deletePdf(invoiceId: string, fileKey: string) {
    const invoice = await this.repository.findOne({
      where: { id: invoiceId },
      relations: ['attachments'],
    });
    if (!invoice)
      throw new NotFoundException(`Invoice ${invoiceId} không tìm thấy`);

    const link = invoice.attachments?.find(
      (l) => l.attachment.fileKey === fileKey,
    );
    if (link) {
      await this.linkRepository.delete({ id: link.id });
    }

    if (invoice.pdfFileKey === fileKey) {
      invoice.pdfFileKey = null;
    }

    await this.r2.deleteObject(fileKey).catch(() => {});
    await this.repository.save(invoice);
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Bulk ZIP download (delegated to InvoiceBulkDownloadService)
  // ---------------------------------------------------------------------------

  downloadAllPdfsZip(invoiceId: string): Promise<Buffer> {
    return this.bulkDownload.downloadAllPdfsZip(invoiceId);
  }

  bulkDownloadFilesZip(
    payload: { query: ErpInvoiceQuery; types: string[] },
    res: any,
  ) {
    return this.bulkDownload.bulkDownloadFilesZip(payload, res);
  }

  bulkDownloadSelectedZip(
    payload: { ids: string[]; types: string[] },
    res: any,
  ) {
    return this.bulkDownload.bulkDownloadSelectedZip(payload, res);
  }
}
