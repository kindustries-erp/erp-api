import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import AdmZip from 'adm-zip';

import { ErpInvoice } from '../entities/erp_invoice.entity';
import { R2Service } from '../../r2/r2.service';
import type { ErpInvoiceQuery } from '../erp-invoices-core.service';

@Injectable()
export class InvoiceFilesService {
  private readonly logger = new Logger(InvoiceFilesService.name);

  constructor(
    @InjectRepository(ErpInvoice)
    private readonly repository: Repository<ErpInvoice>,
    private readonly r2: R2Service,
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
  ) {
    const invoice = await this.repository.findOne({ where: { id: invoiceId } });
    if (!invoice)
      throw new NotFoundException(`Invoice ${invoiceId} không tìm thấy`);

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const safeNo = invoice.invoiceNo.replace(/[^\w-]/g, '_');

    let pdfFiles = Array.isArray(invoice.pdfFiles) ? [...invoice.pdfFiles] : [];

    const uploadPromises = files.map(async (file, index) => {
      const ts = Date.now();
      const safeFilename = file.filename.replace(/[^\w.-]/g, '_');
      const key = `invoices/${invoice.direction}/${yyyy}/${mm}/${safeNo}_${ts}_${index}_${safeFilename}`;
      await this.r2.uploadBuffer(
        key,
        file.buffer,
        file.mimetype || 'application/pdf',
      );
      return {
        key,
        filename: file.filename,
        uploadedAt: new Date().toISOString(),
      };
    });

    const newFiles = await Promise.all(uploadPromises);
    pdfFiles = [...pdfFiles, ...newFiles];
    await this.repository.update(invoiceId, { pdfFiles } as any);
    return { success: true, pdfFiles };
  }

  async getPdfContent(invoiceId: string, fileKey: string): Promise<Buffer> {
    const invoice = await this.repository.findOne({ where: { id: invoiceId } });
    if (!invoice)
      throw new NotFoundException(`Invoice ${invoiceId} không tìm thấy`);
    return this.r2.downloadBuffer(fileKey);
  }

  async getPdfDownloadUrl(invoiceId: string, fileKey: string, inline = false) {
    const invoice = await this.repository.findOne({ where: { id: invoiceId } });
    if (!invoice)
      throw new NotFoundException(`Invoice ${invoiceId} không tìm thấy`);

    const file = Array.isArray(invoice.pdfFiles)
      ? invoice.pdfFiles.find((f) => f.key === fileKey)
      : null;
    const filename = file
      ? file.filename
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
    const invoice = await this.repository.findOne({ where: { id: invoiceId } });
    if (!invoice)
      throw new NotFoundException(`Invoice ${invoiceId} không tìm thấy`);

    const files: any[] = Array.isArray(invoice.pdfFiles)
      ? [...invoice.pdfFiles]
      : [];
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
    const invoice = await this.repository.findOne({ where: { id: invoiceId } });
    if (!invoice)
      throw new NotFoundException(`Invoice ${invoiceId} không tìm thấy`);

    let pdfFiles = Array.isArray(invoice.pdfFiles) ? [...invoice.pdfFiles] : [];
    pdfFiles = pdfFiles.filter((f) => f.key !== fileKey);

    await this.r2.deleteObject(fileKey).catch(() => {});
    await this.repository.update(invoiceId, { pdfFiles } as any);
    return { success: true, pdfFiles };
  }

  // ---------------------------------------------------------------------------
  // Bulk ZIP download
  // ---------------------------------------------------------------------------

  async bulkDownloadFilesZip(
    payload: { query: ErpInvoiceQuery; types: string[] },
    res: any,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const archiver = require('archiver');
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', (err: any) => {
      this.logger.error(`Error during zip creation: ${err.message}`);
      if (!res.headersSent) res.status(500).send({ error: err.message });
    });

    archive.pipe(res);

    const qb = this.repository.createQueryBuilder('inv');
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
    qb.take(500);

    const invoices = await qb.getMany();
    let fileCount = 0;

    for (const invoice of invoices) {
      const partnerName =
        invoice.direction === 'IN' ? invoice.sellerName : invoice.buyerName;
      const taxCode =
        invoice.direction === 'IN'
          ? invoice.sellerTaxCode
          : invoice.buyerTaxCode;
      const sanitizedName = (partnerName || 'KhongTen')
        .replace(/[\\/:"*?<>|]/g, '-')
        .substring(0, 50);
      const sanitizedTaxCode = (taxCode || 'KhongMST').replace(
        /[\\/:"*?<>|]/g,
        '-',
      );
      const folderName = `${sanitizedTaxCode} - ${sanitizedName}`;
      const docNo = (invoice.invoiceNo || invoice.id).replace(
        /[\\/:"*?<>|]/g,
        '-',
      );

      if (payload.types.includes('pdf')) {
        const pdfList: any[] = Array.isArray(invoice.pdfFiles)
          ? invoice.pdfFiles
          : [];
        if (pdfList.length === 0 && invoice.pdfFileKey) {
          pdfList.push({ key: invoice.pdfFileKey, filename: `${docNo}.pdf` });
        }
        for (let i = 0; i < pdfList.length; i++) {
          const file = pdfList[i];
          try {
            const stream = await this.r2.downloadStream(file.key);
            const ext = file.filename?.split('.').pop() || 'pdf';
            const finalName =
              pdfList.length > 1
                ? `${docNo}_${i + 1}.${ext}`
                : `${docNo}.${ext}`;
            archive.append(stream, { name: `${folderName}/${finalName}` });
            fileCount++;
          } catch (err) {
            this.logger.error(`Failed to stream PDF ${file.key}`, err);
          }
        }
      }

      if (payload.types.includes('xml') && invoice.xmlFileKey) {
        try {
          const stream = await this.r2.downloadStream(invoice.xmlFileKey);
          archive.append(stream, { name: `${folderName}/${docNo}.xml` });
          fileCount++;
        } catch (err) {
          this.logger.error(`Failed to stream XML ${invoice.xmlFileKey}`, err);
        }
      }
    }

    if (fileCount === 0) {
      archive.append('No files found or downloaded', { name: 'README.txt' });
    }

    await archive.finalize();
  }
}
