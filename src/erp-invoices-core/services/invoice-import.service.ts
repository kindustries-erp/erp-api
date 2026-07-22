import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import AdmZip from 'adm-zip';

import { ErpInvoice } from '../entities/erp_invoice.entity';
import { R2Service } from '../../r2/r2.service';
import {
  parseVietnamInvoiceXml,
  XmlParseError,
} from '../xml-parser/vietnam-invoice-xml.parser';
import { normalizeInvoiceNo } from '../utils/normalize-invoice-no';
import { extractInvoiceMetadata } from '../helpers/invoice-metadata.helper';
import { buildInvoiceR2Key } from '../helpers/invoice-gdt.helper';

// ---------------------------------------------------------------------------
// Result types (re-exported so existing consumers don't need to change import)
// ---------------------------------------------------------------------------

export interface BulkImportSkippedItem {
  filename: string;
  invoiceNo: string;
  sellerName: string | null;
  sellerTaxCode: string | null;
  reason: 'DUPLICATE';
}

export interface BulkImportErrorItem {
  filename: string;
  reason: string;
}

export interface BulkImportResult {
  importId: string;
  direction: 'IN' | 'OUT';
  total: number;
  created: number;
  skipped: BulkImportSkippedItem[];
  errors: BulkImportErrorItem[];
  pdfAttached?: any[];
  pdfOrphans?: any[];
}

@Injectable()
export class InvoiceImportService {
  private readonly logger = new Logger(InvoiceImportService.name);

  constructor(
    @InjectRepository(ErpInvoice)
    private readonly repository: Repository<ErpInvoice>,
    private readonly r2: R2Service,
  ) {}

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async bulkImportBuyerXml(
    files: Array<{ filename: string; buffer: Buffer }>,
  ): Promise<BulkImportResult> {
    return this._doBulkImport(files, 'IN');
  }

  async bulkImportSellerXml(
    files: Array<{ filename: string; buffer: Buffer }>,
  ): Promise<BulkImportResult> {
    return this._doBulkImport(files, 'OUT');
  }

  async bulkImportMixed(
    files: Array<{ filename: string; buffer: Buffer; mimetype: string }>,
    direction: 'IN' | 'OUT',
  ): Promise<BulkImportResult> {
    const importId = crypto.randomUUID();
    const skipped: BulkImportSkippedItem[] = [];
    const errors: BulkImportErrorItem[] = [];
    let created = 0;
    const pdfAttached: any[] = [];
    const pdfOrphans: any[] = [];

    // 1. Classify files and extract ZIPs
    const xmlEntries: { filename: string; buffer: Buffer }[] = [];
    const pdfEntries: { filename: string; buffer: Buffer; mimetype: string }[] =
      [];

    for (const f of files) {
      const lowerName = f.filename.toLowerCase();
      if (lowerName.endsWith('.zip') || f.mimetype === 'application/zip') {
        try {
          const zip = new AdmZip(f.buffer);
          for (const entry of zip.getEntries()) {
            if (entry.isDirectory) continue;
            const ext = entry.entryName.split('.').pop()?.toLowerCase();
            if (ext === 'xml') {
              xmlEntries.push({
                filename: entry.entryName,
                buffer: entry.getData(),
              });
            } else if (ext === 'pdf') {
              pdfEntries.push({
                filename: entry.entryName,
                buffer: entry.getData(),
                mimetype: 'application/pdf',
              });
            }
          }
        } catch (e) {
          errors.push({
            filename: f.filename,
            reason: `Không thể giải nén file ZIP: ${(e as Error).message}`,
          });
        }
      } else if (
        lowerName.endsWith('.xml') ||
        f.mimetype === 'application/xml' ||
        f.mimetype === 'text/xml'
      ) {
        xmlEntries.push(f);
      } else if (
        lowerName.endsWith('.pdf') ||
        f.mimetype === 'application/pdf'
      ) {
        pdfEntries.push(f);
      }
    }

    // 2. Map PDFs by basename for paired-file matching
    const pdfMap = new Map<
      string,
      { filename: string; buffer: Buffer; mimetype: string }
    >();
    for (const p of pdfEntries) {
      const basename = p.filename
        .substring(0, p.filename.lastIndexOf('.'))
        .toLowerCase();
      pdfMap.set(basename, p);
    }

    // 3. Process XMLs
    for (const file of xmlEntries) {
      try {
        const parsed = parseVietnamInvoiceXml(file.buffer.toString('utf-8'));
        const invoiceNoNorm = normalizeInvoiceNo(parsed.invoiceNo);

        const existingInvoice = await this.repository.findOne({
          where: {
            invoiceNoNormalized: invoiceNoNorm || undefined,
            sellerTaxCode: parsed.sellerTaxCode ?? undefined,
            direction,
          } as any,
        });

        const basename = file.filename
          .substring(0, file.filename.lastIndexOf('.'))
          .toLowerCase();
        const matchedPdf = pdfMap.get(basename);

        if (existingInvoice) {
          skipped.push({
            filename: file.filename,
            invoiceNo: parsed.invoiceNo,
            sellerName: parsed.sellerName,
            sellerTaxCode: parsed.sellerTaxCode,
            reason: 'DUPLICATE',
          });
          if (matchedPdf) pdfMap.delete(basename);
          continue;
        }

        const mst =
          direction === 'IN' ? parsed.sellerTaxCode : parsed.buyerTaxCode;
        const xmlKey = buildInvoiceR2Key({
          direction,
          invoiceDate: parsed.invoiceDate,
          taxCode: mst,
          serialNo: parsed.serialNo,
          invoiceNo: parsed.invoiceNo,
          ext: 'xml',
        });

        let xmlUploaded = false;
        try {
          await this.r2.uploadBuffer(xmlKey, file.buffer, 'application/xml');
          xmlUploaded = true;
        } catch (r2Err) {
          this.logger.warn(
            `R2 upload failed for ${file.filename}: ${(r2Err as Error).message}`,
          );
        }

        const notes =
          parsed.lookupCode || parsed.providerLink
            ? `[Lookup Info] Code: ${parsed.lookupCode ?? 'N/A'} - Link: ${parsed.providerLink ?? 'N/A'}`
            : '';

        const newInvoiceData: any = {
          invoiceNo: parsed.invoiceNo,
          invoiceNoNormalized: invoiceNoNorm || undefined,
          serialNo: parsed.serialNo,
          invoiceDate: parsed.invoiceDate,
          direction,
          status: 'CONFIRMED',
          sellerName: parsed.sellerName,
          sellerTaxCode: parsed.sellerTaxCode,
          sellerAddress: parsed.sellerAddress,
          sellerBank: parsed.sellerBank,
          buyerName: parsed.buyerName,
          buyerPersonalName: parsed.buyerPersonalName,
          buyerCccd: parsed.buyerCccd,
          buyerTaxCode: parsed.buyerTaxCode,
          buyerAddress: parsed.buyerAddress,
          description: parsed.description,
          notes: notes || undefined,
          preVatAmount: String(parsed.preVatAmount),
          vatRate: parsed.vatRate != null ? String(parsed.vatRate) : null,
          vatAmount: String(parsed.vatAmount),
          discountAmount: String(parsed.discountAmount),
          totalAmount: String(parsed.totalAmount),
          xmlFileKey: xmlUploaded ? xmlKey : null,
          xmlImportId: importId,
          pdfFiles: [],
        };
        const newInvoice = this.repository.create(
          newInvoiceData,
        ) as any as ErpInvoice;

        extractInvoiceMetadata(newInvoice);

        // Attach paired PDF if present
        if (matchedPdf) {
          pdfMap.delete(basename);
          const now = new Date();
          const yyyy = now.getFullYear();
          const mm = String(now.getMonth() + 1).padStart(2, '0');
          const safeNo = parsed.invoiceNo.replace(/[^\w-]/g, '_');
          const safePdfName = matchedPdf.filename.replace(/[^\w.-]/g, '_');
          const pdfKey = `invoices/${direction}/${yyyy}/${mm}/${safeNo}_${Date.now()}_0_${safePdfName}`;
          try {
            await this.r2.uploadBuffer(
              pdfKey,
              matchedPdf.buffer,
              matchedPdf.mimetype || 'application/pdf',
            );
            newInvoice.pdfFileKey = pdfKey;
            newInvoice.pdfFiles = [
              {
                key: pdfKey,
                filename: matchedPdf.filename,
                uploadedAt: new Date().toISOString(),
              },
            ];
            pdfAttached.push({
              filename: matchedPdf.filename,
              invoiceNo: newInvoice.invoiceNo,
              invoiceId: newInvoice.id,
              serialNo: newInvoice.serialNo ?? null,
              sellerName: newInvoice.sellerName ?? null,
              totalAmount: newInvoice.totalAmount ?? null,
            });
          } catch {
            this.logger.warn(`R2 PDF upload failed for ${matchedPdf.filename}`);
          }
        }

        await this.repository.save(newInvoice);
        created++;
      } catch (err) {
        const reason =
          err instanceof XmlParseError
            ? err.message
            : `Lỗi hệ thống: ${(err as Error).message}`;
        errors.push({ filename: file.filename, reason });
      }
    }

    // 4. Orphan PDFs — try to match to existing invoices by number
    for (const [, pdf] of pdfMap.entries()) {
      const digitsMatch = pdf.filename.match(/(\d{2,})/g);
      let foundInvoice: any = null;

      if (digitsMatch) {
        for (const strNum of digitsMatch) {
          const normNo = normalizeInvoiceNo(strNum);
          if (!normNo) continue;
          foundInvoice = await this.repository.findOne({
            where: { invoiceNoNormalized: normNo, direction } as any,
          });
          if (foundInvoice) break;
        }
      }

      if (foundInvoice) {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const safeNo = foundInvoice.invoiceNo.replace(/[^\w-]/g, '_');
        const safePdfName = pdf.filename.replace(/[^\w.-]/g, '_');
        const pdfKey = `invoices/${direction}/${yyyy}/${mm}/${safeNo}_${Date.now()}_orphan_${safePdfName}`;

        try {
          await this.r2.uploadBuffer(
            pdfKey,
            pdf.buffer,
            pdf.mimetype || 'application/pdf',
          );
          const currentPdfFiles = Array.isArray(foundInvoice.pdfFiles)
            ? [...foundInvoice.pdfFiles]
            : [];
          currentPdfFiles.push({
            key: pdfKey,
            filename: pdf.filename,
            uploadedAt: new Date().toISOString(),
          });
          await this.repository.update(foundInvoice.id, {
            pdfFiles: currentPdfFiles,
            pdfFileKey: foundInvoice.pdfFileKey || pdfKey,
          } as any);
          pdfAttached.push({
            filename: pdf.filename,
            invoiceNo: foundInvoice.invoiceNo,
            invoiceId: foundInvoice.id,
            serialNo: foundInvoice.serialNo ?? null,
            sellerName: foundInvoice.sellerName ?? null,
            totalAmount: foundInvoice.totalAmount ?? null,
          });
        } catch {
          pdfOrphans.push({
            filename: pdf.filename,
            reason: 'R2 upload failed',
          });
        }
      } else {
        pdfOrphans.push({
          filename: pdf.filename,
          reason: 'Không tìm thấy hóa đơn khớp',
        });
      }
    }

    return {
      importId,
      direction,
      total: files.length,
      created,
      skipped,
      errors,
      pdfAttached,
      pdfOrphans,
    };
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private async _doBulkImport(
    files: Array<{ filename: string; buffer: Buffer }>,
    direction: 'IN' | 'OUT',
  ): Promise<BulkImportResult> {
    const importId = crypto.randomUUID();
    const skipped: BulkImportSkippedItem[] = [];
    const errors: BulkImportErrorItem[] = [];
    let created = 0;

    for (const file of files) {
      try {
        const parsed = parseVietnamInvoiceXml(file.buffer.toString('utf-8'));
        const invoiceNoNorm = normalizeInvoiceNo(parsed.invoiceNo);

        const existing = await this.repository.findOne({
          where: {
            invoiceNoNormalized: invoiceNoNorm || undefined,
            sellerTaxCode: parsed.sellerTaxCode ?? undefined,
          } as any,
        });

        if (existing) {
          skipped.push({
            filename: file.filename,
            invoiceNo: parsed.invoiceNo,
            sellerName: parsed.sellerName,
            sellerTaxCode: parsed.sellerTaxCode,
            reason: 'DUPLICATE',
          });
          continue;
        }

        const mst =
          direction === 'IN' ? parsed.sellerTaxCode : parsed.buyerTaxCode;
        const xmlKey = buildInvoiceR2Key({
          direction,
          invoiceDate: parsed.invoiceDate,
          taxCode: mst,
          serialNo: parsed.serialNo,
          invoiceNo: parsed.invoiceNo,
          ext: 'xml',
        });

        try {
          await this.r2.uploadBuffer(xmlKey, file.buffer, 'application/xml');
        } catch (r2Err) {
          this.logger.warn(
            `R2 upload failed for ${file.filename}: ${(r2Err as Error).message}`,
          );
        }

        const notes =
          parsed.lookupCode || parsed.providerLink
            ? `[Lookup Info] Code: ${parsed.lookupCode ?? 'N/A'} - Link: ${parsed.providerLink ?? 'N/A'}`
            : '';

        const invoice = this.repository.create({
          invoiceNo: parsed.invoiceNo,
          invoiceNoNormalized: invoiceNoNorm || undefined,
          serialNo: parsed.serialNo,
          invoiceDate: parsed.invoiceDate,
          direction,
          status: 'CONFIRMED',
          sellerName: parsed.sellerName,
          sellerTaxCode: parsed.sellerTaxCode,
          sellerAddress: parsed.sellerAddress,
          sellerBank: parsed.sellerBank,
          buyerName: parsed.buyerName,
          buyerPersonalName: parsed.buyerPersonalName,
          buyerCccd: parsed.buyerCccd,
          buyerTaxCode: parsed.buyerTaxCode,
          buyerAddress: parsed.buyerAddress,
          description: parsed.description,
          notes: notes || undefined,
          preVatAmount: String(parsed.preVatAmount),
          vatRate: parsed.vatRate != null ? String(parsed.vatRate) : null,
          vatAmount: String(parsed.vatAmount),
          discountAmount: String(parsed.discountAmount),
          totalAmount: String(parsed.totalAmount),
          xmlFileKey: xmlKey,
          xmlImportId: importId,
        } as any);

        extractInvoiceMetadata(invoice);
        await this.repository.save(invoice);
        created++;
      } catch (err) {
        const reason =
          err instanceof XmlParseError
            ? err.message
            : `Lỗi hệ thống: ${(err as Error).message}`;
        errors.push({ filename: file.filename, reason });
      }
    }

    return {
      importId,
      direction,
      total: files.length,
      created,
      skipped,
      errors,
    };
  }
}
