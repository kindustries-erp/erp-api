import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import AdmZip from 'adm-zip';

import { ErpInvoice } from '../../entities/erp_invoice.entity';
import { R2Service } from '../../../r2/r2.service';
import type { ErpInvoiceQuery } from '../../erp-invoices-core.service';
import {
  buildInvoiceFileName,
  uniqueName,
} from '../../utils/invoice-file-name.util';
import { resolveInvoicePdfFiles } from '../../utils/invoice-pdf-files.util';
import { extractXmlFromZip } from '../../utils/invoice-xml-from-zip.util';
import { resolveInvoiceZipFiles } from '../../utils/invoice-zip-files.util';

type DownloadTask =
  | { mode: 'stream'; key: string; name: string; invoiceNo: string }
  | {
      mode: 'xml-zip';
      key: string;
      invoice: ErpInvoice;
      folderName: string;
      invoiceNo: string;
    };

type DownloadType = 'pdf' | 'xml' | 'zip';

@Injectable()
export class InvoiceBulkDownloadService {
  private readonly logger = new Logger(InvoiceBulkDownloadService.name);
  private readonly BULK_DOWNLOAD_LIMIT = 500;
  private readonly BULK_DOWNLOAD_CONCURRENCY = 10;

  constructor(
    @InjectRepository(ErpInvoice)
    private readonly repository: Repository<ErpInvoice>,
    private readonly r2: R2Service,
  ) {}

  /** Gói tất cả PDF của một hóa đơn thành zip (chỉ PDF thật). */
  async downloadAllPdfsZip(invoiceId: string): Promise<Buffer> {
    const invoice = await this.repository.findOne({
      where: { id: invoiceId },
      relations: ['attachments'],
    });
    if (!invoice)
      throw new NotFoundException(`Invoice ${invoiceId} không tìm thấy`);

    const files = resolveInvoicePdfFiles(invoice);
    if (files.length === 0) {
      throw new NotFoundException(`Invoice ${invoiceId} không có file PDF nào`);
    }

    const zip = new AdmZip();
    for (const file of files) {
      try {
        const buffer = await this.r2.downloadBuffer(file.key);
        let safeFilename = file.filename;
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

  async bulkDownloadFilesZip(
    payload: { query: ErpInvoiceQuery; types: string[] },
    res: any,
  ) {
    const types = this.normalizeTypes(payload.types);
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
    await this.finalizeArchive(archive, invoices, types);
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

    await this.finalizeArchive(archive, invoices, types);
  }

  private async finalizeArchive(
    archive: any,
    invoices: ErpInvoice[],
    types: DownloadType[],
  ) {
    const usedNames = new Set<string>();
    const { tasks, missing } = this.buildDownloadTasks(
      invoices,
      types,
      usedNames,
    );
    const failedFiles = [...missing];
    const fileCount = await this.appendTasksToArchive(
      archive,
      tasks,
      failedFiles,
      usedNames,
    );

    if (fileCount === 0) {
      archive.append('No files found or downloaded', { name: 'README.txt' });
    }

    this.appendFailedReport(archive, failedFiles);

    await archive.finalize();
  }

  private normalizeTypes(types: string[]): DownloadType[] {
    const normalized = (types || [])
      .map((t) => (t || '').toLowerCase())
      .filter(
        (t): t is DownloadType => t === 'pdf' || t === 'xml' || t === 'zip',
      );

    if (normalized.length === 0) {
      throw new BadRequestException(
        'Vui lòng chọn ít nhất 1 loại file (pdf, xml, zip)',
      );
    }

    return Array.from(new Set(normalized));
  }

  private sanitizeZipPart(val: string | null | undefined, fallback: string) {
    return (val || fallback).replace(/[\\/:"*?<>|]/g, '-');
  }

  private buildFolderName(invoice: ErpInvoice): string {
    const partnerName =
      invoice.direction === 'IN' ? invoice.sellerName : invoice.buyerName;
    const taxCode =
      invoice.direction === 'IN' ? invoice.sellerTaxCode : invoice.buyerTaxCode;
    const sanitizedName = this.sanitizeZipPart(
      partnerName,
      'KhongTen',
    ).substring(0, 50);
    const sanitizedTaxCode = this.sanitizeZipPart(taxCode, 'KhongMST');
    return `${sanitizedTaxCode} - ${sanitizedName}`;
  }

  private buildDownloadTasks(
    invoices: ErpInvoice[],
    types: DownloadType[],
    usedNames: Set<string>,
  ): { tasks: DownloadTask[]; missing: string[] } {
    const tasks: DownloadTask[] = [];
    const missing: string[] = [];

    for (const invoice of invoices) {
      const invoiceNo = invoice.invoiceNo || invoice.id;
      const folderName = this.buildFolderName(invoice);

      if (types.includes('pdf')) {
        const pdfs = resolveInvoicePdfFiles(invoice);
        if (pdfs.length === 0) {
          missing.push(`${invoiceNo} - không có file PDF`);
        } else {
          pdfs.forEach((file, i) => {
            const finalName = buildInvoiceFileName(
              invoice,
              'pdf',
              pdfs.length > 1 ? i + 1 : undefined,
            );
            tasks.push({
              mode: 'stream',
              key: file.key,
              name: uniqueName(`${folderName}/${finalName}`, usedNames),
              invoiceNo,
            });
          });
        }
      }

      if (types.includes('zip')) {
        const zips = resolveInvoiceZipFiles(invoice);
        if (zips.length === 0) {
          missing.push(`${invoiceNo} - không có file ZIP`);
        } else {
          zips.forEach((file, i) => {
            const finalName = buildInvoiceFileName(
              invoice,
              'zip',
              zips.length > 1 ? i + 1 : undefined,
            );
            tasks.push({
              mode: 'stream',
              key: file.key,
              name: uniqueName(`${folderName}/${finalName}`, usedNames),
              invoiceNo,
            });
          });
        }
      }

      if (types.includes('xml')) {
        const key = invoice.xmlFileKey;
        if (!key) {
          missing.push(`${invoiceNo} - không có file XML`);
        } else if (/\.zip$/i.test(key)) {
          // Gói zip của nhà cung cấp: chỉ lấy file .xml bên trong
          tasks.push({ mode: 'xml-zip', key, invoice, folderName, invoiceNo });
        } else {
          tasks.push({
            mode: 'stream',
            key,
            name: uniqueName(
              `${folderName}/${buildInvoiceFileName(invoice, 'xml')}`,
              usedNames,
            ),
            invoiceNo,
          });
        }
      }
    }

    return { tasks, missing };
  }

  private async appendTasksToArchive(
    archive: any,
    tasks: DownloadTask[],
    failedFiles: string[],
    usedNames: Set<string>,
  ) {
    let fileCount = 0;
    for (const chunk of this.chunkArray(
      tasks,
      this.BULK_DOWNLOAD_CONCURRENCY,
    )) {
      const results = await Promise.all(
        chunk.map((task) =>
          this.runTask(archive, task, failedFiles, usedNames),
        ),
      );
      fileCount += results.reduce((sum, n) => sum + n, 0);
    }
    return fileCount;
  }

  private async runTask(
    archive: any,
    task: DownloadTask,
    failedFiles: string[],
    usedNames: Set<string>,
  ): Promise<number> {
    try {
      if (task.mode === 'stream') {
        const stream = await this.r2.downloadStream(task.key);
        archive.append(stream, { name: task.name });
        return 1;
      }

      const buffer = await this.r2.downloadBuffer(task.key);
      const xmlFiles = extractXmlFromZip(buffer);
      if (xmlFiles.length === 0) {
        failedFiles.push(
          `${task.invoiceNo} - gói ${task.key} không có file XML`,
        );
        return 0;
      }
      xmlFiles.forEach((xml, i) => {
        const finalName = buildInvoiceFileName(
          task.invoice,
          'xml',
          xmlFiles.length > 1 ? i + 1 : undefined,
        );
        archive.append(xml.buffer, {
          name: uniqueName(`${task.folderName}/${finalName}`, usedNames),
        });
      });
      return xmlFiles.length;
    } catch (err: any) {
      const reason = err?.message || 'Unknown error';
      failedFiles.push(`${task.invoiceNo} - ${reason}`);
      this.logger.error(`Failed to process file ${task.key}`, err);
      return 0;
    }
  }

  private chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
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
}
