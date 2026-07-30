import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import AdmZip from 'adm-zip';

import { ErpInvoice } from '../entities/erp_invoice.entity';
import { ErpInvoiceAttachment } from '../entities/erp_invoice_attachment.entity';
import { R2Service } from '../../r2/r2.service';
import { ErpAttachmentsCoreService } from '../../erp-attachments-core/erp-attachments-core.service';
import type { ErpInvoiceQuery } from '../erp-invoices-core.service';

@Injectable()
export class InvoiceFilesService {
  private readonly logger = new Logger(InvoiceFilesService.name);
  private readonly BULK_DOWNLOAD_LIMIT = 500;
  private readonly BULK_DOWNLOAD_CONCURRENCY = 10;

  constructor(
    @InjectRepository(ErpInvoice)
    private readonly repository: Repository<ErpInvoice>,
    @InjectRepository(ErpInvoiceAttachment)
    private readonly linkRepository: Repository<ErpInvoiceAttachment>,
    private readonly r2: R2Service,
    private readonly attachmentsService: ErpAttachmentsCoreService,
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
    const dateStr = invoice.invoiceDate || 'unknown';
    const mst =
      invoice.direction === 'IN' ? invoice.sellerTaxCode : invoice.buyerTaxCode;
    const safeTax = (mst ?? 'unknown').replace(/[^\w]/g, '');
    const safeSerial = (invoice.serialNo ?? 'unknown').replace(/[^\w-]/g, '_');
    const safeNo = invoice.invoiceNo.replace(/[^\w-]/g, '_');

    const filename = `${dateStr}_${safeTax}_${safeSerial}_${safeNo}.${ext}`;
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

  async downloadAllPdfsZip(invoiceId: string): Promise<Buffer> {
    const invoice = await this.repository.findOne({
      where: { id: invoiceId },
      relations: ['attachments'],
    });
    if (!invoice)
      throw new NotFoundException(`Invoice ${invoiceId} không tìm thấy`);

    const files: any[] =
      invoice.attachments?.map((link) => ({
        key: link.attachment.fileKey,
        filename: link.attachment.fileName,
      })) || [];
    if (files.length === 0) {
      if (invoice.pdfFileKey) {
        files.push({ key: invoice.pdfFileKey, filename: 'document.pdf' });
      } else {
        throw new NotFoundException(
          `Invoice ${invoiceId} không có file PDF nào`,
        );
      }
    }

    const zip = new AdmZip();
    for (const file of files) {
      try {
        const buffer = await this.r2.downloadBuffer(file.key);
        let safeFilename = file.filename || 'document.pdf';
        while (zip.getEntry(safeFilename)) {
          const match = safeFilename.match(/(.*)(\.[^.]+)$/);
          safeFilename = match
            ? `${match[1]}_1${match[2]}`
            : `${safeFilename}_1`;
        }
        zip.addFile(safeFilename, buffer);
      } catch (err) {
        this.logger.error(`Failed to download ${file.key} for zip`, err);
      }
    }

    return zip.toBuffer();
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
  // Bulk ZIP download
  // ---------------------------------------------------------------------------

  private chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }

  private sanitizeZipPart(val: string | null | undefined, fallback: string) {
    return (val || fallback).replace(/[\\/:"*?<>|]/g, '-');
  }

  private normalizeTypes(types: string[]): Array<'pdf' | 'xml'> {
    const normalized = (types || [])
      .map((t) => (t || '').toLowerCase())
      .filter((t): t is 'pdf' | 'xml' => t === 'pdf' || t === 'xml');

    if (normalized.length === 0) {
      throw new BadRequestException(
        'Vui lòng chọn ít nhất 1 loại file (pdf, xml)',
      );
    }

    return Array.from(new Set(normalized));
  }

  private buildDownloadTasks(
    invoices: ErpInvoice[],
    types: Array<'pdf' | 'xml'>,
  ): {
    tasks: Array<{ key: string; name: string; invoiceNo: string }>;
    missing: string[];
  } {
    const tasks: Array<{ key: string; name: string; invoiceNo: string }> = [];
    const missing: string[] = [];

    for (const invoice of invoices) {
      const invoiceNo = invoice.invoiceNo || invoice.id;
      const partnerName =
        invoice.direction === 'IN' ? invoice.sellerName : invoice.buyerName;
      const taxCode =
        invoice.direction === 'IN'
          ? invoice.sellerTaxCode
          : invoice.buyerTaxCode;
      const sanitizedName = this.sanitizeZipPart(
        partnerName,
        'KhongTen',
      ).substring(0, 50);
      const sanitizedTaxCode = this.sanitizeZipPart(taxCode, 'KhongMST');
      const folderName = `${sanitizedTaxCode} - ${sanitizedName}`;
      const docNo = this.sanitizeZipPart(invoiceNo, invoice.id);

      if (types.includes('pdf')) {
        const pdfList: any[] =
          invoice.attachments?.map((link) => ({
            key: link.attachment.fileKey,
            filename: link.attachment.fileName,
          })) || [];
        if (pdfList.length === 0 && invoice.pdfFileKey) {
          pdfList.push({ key: invoice.pdfFileKey, filename: `${docNo}.pdf` });
        }

        if (pdfList.length === 0) {
          missing.push(`${invoiceNo} - không có file PDF`);
        } else {
          for (let i = 0; i < pdfList.length; i++) {
            const file = pdfList[i];
            const ext = file.filename?.split('.').pop() || 'pdf';
            const finalName =
              pdfList.length > 1
                ? `${docNo}_${i + 1}.${ext}`
                : `${docNo}.${ext}`;
            tasks.push({
              key: file.key,
              name: `${folderName}/${finalName}`,
              invoiceNo,
            });
          }
        }
      }

      if (types.includes('xml')) {
        if (!invoice.xmlFileKey) {
          missing.push(`${invoiceNo} - không có file XML`);
        } else {
          tasks.push({
            key: invoice.xmlFileKey,
            name: `${folderName}/${docNo}.xml`,
            invoiceNo,
          });
        }
      }
    }

    return { tasks, missing };
  }

  private async appendTasksToArchive(
    archive: any,
    tasks: Array<{ key: string; name: string; invoiceNo: string }>,
    failedFiles: string[],
  ) {
    let fileCount = 0;
    const chunks = this.chunkArray(tasks, this.BULK_DOWNLOAD_CONCURRENCY);

    for (const chunk of chunks) {
      const results = await Promise.all(
        chunk.map(async (task) => {
          try {
            const stream = await this.r2.downloadStream(task.key);
            archive.append(stream, { name: task.name });
            return 1;
          } catch (err: any) {
            const reason = err?.message || 'Unknown error';
            failedFiles.push(`${task.invoiceNo} - ${reason}`);
            this.logger.error(`Failed to stream file ${task.key}`, err);
            return 0;
          }
        }),
      );
      fileCount += results.reduce((sum, n) => sum + n, 0);
    }

    return fileCount;
  }

  private appendFailedReport(archive: any, failedFiles: string[]) {
    if (failedFiles.length === 0) return;
    const report = [
      'Danh sach file loi khi tai ZIP:',
      '',
      ...failedFiles.map((line, idx) => `${idx + 1}. ${line}`),
    ].join('\n');
    archive.append(report, { name: '_FILE_LOI.txt' });
  }

  private createZipArchive() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const archiverModule = require('archiver');
    const directCandidates = [
      archiverModule,
      archiverModule?.default,
      archiverModule?.create,
      archiverModule?.archiver,
      archiverModule?.default?.default,
    ];
    const directFactory = directCandidates.find(
      (candidate) => typeof candidate === 'function',
    );
    const valueFactory =
      !directFactory && archiverModule && typeof archiverModule === 'object'
        ? Object.values(archiverModule).find(
            (candidate) => typeof candidate === 'function',
          )
        : null;
    const archiverFactory = directFactory || valueFactory;

    if (!archiverFactory) {
      throw new Error('Archiver module factory not found');
    }

    return archiverFactory('zip', { zlib: { level: 0 } });
  }

  async bulkDownloadFilesZip(
    payload: { query: ErpInvoiceQuery; types: string[] },
    res: any,
  ) {
    const archive = this.createZipArchive();

    archive.on('error', (err: any) => {
      this.logger.error(`Error during zip creation: ${err.message}`);
      if (!res.headersSent) res.status(500).send({ error: err.message });
    });

    archive.pipe(res);

    const qb = this.repository
      .createQueryBuilder('inv')
      .leftJoinAndSelect('inv.attachments', 'link')
      .leftJoinAndSelect('link.attachment', 'attachment');
    qb.where('inv.is_deleted = false');

    if (payload.query.date_from) {
      qb.andWhere('inv.invoice_date >= :dateFrom', {
        dateFrom: payload.query.date_from,
      });
    }
    if (payload.query.date_to) {
      qb.andWhere('inv.invoice_date <= :dateTo', {
        dateTo: payload.query.date_to,
      });
    }
    if (payload.query.direction) {
      qb.andWhere('inv.direction = :direction', {
        direction: payload.query.direction,
      });
    }
    if (payload.query.status) {
      qb.andWhere('inv.status = :status', { status: payload.query.status });
    }
    if (payload.query.search) {
      qb.andWhere(
        '(inv.invoice_no ILIKE :search OR inv.document_no ILIKE :search OR inv.seller_name ILIKE :search OR inv.buyer_name ILIKE :search)',
        { search: `%${payload.query.search}%` },
      );
    }
    qb.take(this.BULK_DOWNLOAD_LIMIT);

    const invoices = await qb.getMany();
    const types = this.normalizeTypes(payload.types);
    const { tasks, missing } = this.buildDownloadTasks(invoices, types);
    const failedFiles = [...missing];
    const fileCount = await this.appendTasksToArchive(
      archive,
      tasks,
      failedFiles,
    );

    if (fileCount === 0) {
      archive.append('No files found or downloaded', { name: 'README.txt' });
    }

    this.appendFailedReport(archive, failedFiles);

    await archive.finalize();
  }

  async bulkDownloadSelectedZip(
    payload: { ids: string[]; types: string[] },
    res: any,
  ) {
    if (!payload.ids || payload.ids.length === 0) {
      throw new BadRequestException('Không có hóa đơn nào được chọn');
    }
    if (payload.ids.length > this.BULK_DOWNLOAD_LIMIT) {
      throw new BadRequestException(
        `Tối đa ${this.BULK_DOWNLOAD_LIMIT} hóa đơn mỗi lần tải`,
      );
    }

    const types = this.normalizeTypes(payload.types);

    const archive = this.createZipArchive();

    archive.on('error', (err: any) => {
      this.logger.error(`Error during zip creation: ${err.message}`);
      if (!res.headersSent) res.status(500).send({ error: err.message });
    });

    archive.pipe(res);

    const invoices = await this.repository.find({
      where: {
        id: In(payload.ids),
        isDeleted: false,
      },
      relations: ['attachments'],
    });

    const indexById = new Map(payload.ids.map((id, idx) => [id, idx]));
    invoices.sort(
      (a, b) => (indexById.get(a.id) ?? 0) - (indexById.get(b.id) ?? 0),
    );

    const { tasks, missing } = this.buildDownloadTasks(invoices, types);
    const failedFiles = [...missing];
    const fileCount = await this.appendTasksToArchive(
      archive,
      tasks,
      failedFiles,
    );

    if (fileCount === 0) {
      archive.append('No files found or downloaded', { name: 'README.txt' });
    }

    this.appendFailedReport(archive, failedFiles);

    await archive.finalize();
  }
}
