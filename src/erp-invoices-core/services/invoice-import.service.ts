import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import AdmZip from 'adm-zip';

import { ErpInvoice } from '../entities/erp_invoice.entity';
import { ErpInvoiceItem } from '../entities/erp_invoice_item.entity';
import { ErpBranch } from '../../branches-core/entities/erp_branch.entity';
import { R2Service } from '../../r2/r2.service';
import { VinfastPartsService } from '../../vinfast-parts/vinfast-parts.service';
import { InvoiceCategoryAutopostService } from './sub-services/invoice-category-autopost.service';
import {
  parseVietnamInvoiceXml,
  XmlParseError,
} from '../xml-parser/vietnam-invoice-xml.parser';
import { normalizeInvoiceNo } from '../utils/normalize-invoice-no';
import { extractInvoiceMetadata } from '../helpers/invoice-metadata.helper';
import { buildInvoiceR2Key } from '../helpers/invoice-gdt.helper';
import {
  resolveOutInvoiceBranchCode,
  resolveInInvoiceBranchCode,
} from '../helpers/invoice-branch.helper';
import { classifyInvoiceLine } from '../helpers/out-invoice-display.helper';
import { extractStandardItemCode } from '../helpers/vinfast-part-code.helper';

// ---------------------------------------------------------------------------
// Result types
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

  private readonly _branchIdCache = new Map<string, string>();
  private _isBranchCacheLoaded = false;

  constructor(
    @InjectRepository(ErpInvoice)
    private readonly repository: Repository<ErpInvoice>,
    private readonly r2: R2Service,
    @Optional()
    @InjectRepository(ErpBranch)
    private readonly branchRepository?: Repository<ErpBranch>,
    @Optional()
    private readonly vinfastPartsService?: VinfastPartsService,
    @Optional()
    private readonly categoryAutopostService?: InvoiceCategoryAutopostService,
  ) {}

  // ---------------------------------------------------------------------------
  // Branch resolution helpers
  // ---------------------------------------------------------------------------

  public async preloadBranchCache(): Promise<Map<string, string>> {
    if (!this.branchRepository) return this._branchIdCache;
    try {
      const branches = await this.branchRepository.find({
        where: { isActive: true },
        select: ['id', 'code', 'name'],
      });

      this._branchIdCache.clear();
      for (const branch of branches) {
        if (branch.code) {
          this._branchIdCache.set(branch.code.trim(), branch.id);
        }
      }
      this._isBranchCacheLoaded = true;
    } catch (err) {
      this.logger.error(
        'Failed to pre-scan branches from DB in ImportService',
        err,
      );
    }
    return this._branchIdCache;
  }

  private async getBranchIdByCode(branchCode: string): Promise<string | null> {
    if (!this.branchRepository) return null;
    if (!this._isBranchCacheLoaded) {
      await this.preloadBranchCache();
    }

    if (this._branchIdCache.has(branchCode)) {
      return this._branchIdCache.get(branchCode)!;
    }

    const branch = await this.branchRepository.findOne({
      where: { code: branchCode, isActive: true },
      select: ['id'],
    });

    if (branch) {
      this._branchIdCache.set(branchCode, branch.id);
      return branch.id;
    }

    return null;
  }

  private async resolveBranchIdForOut(
    settlementOrder: string | null | undefined,
    buyerTaxCode?: string | null,
  ): Promise<string | null> {
    const branchCode = resolveOutInvoiceBranchCode(
      settlementOrder,
      buyerTaxCode,
    );
    return this.getBranchIdByCode(branchCode);
  }

  private async resolveBranchIdForIn(
    sellerTaxCode?: string | null,
    buyerTaxCode?: string | null,
  ): Promise<string | null> {
    const branchCode = resolveInInvoiceBranchCode(sellerTaxCode, buyerTaxCode);
    if (branchCode) {
      const branchId = await this.getBranchIdByCode(branchCode);
      if (branchId) return branchId;
    }
    return this.resolveHistoricalBranchForIn(sellerTaxCode ?? null);
  }

  private async resolveHistoricalBranchForIn(
    sellerTaxCode: string | null,
  ): Promise<string | null> {
    if (!sellerTaxCode) return null;

    const prior = await this.repository.findOne({
      where: {
        direction: 'IN',
        sellerTaxCode,
        branchId: Not(IsNull()),
        isDeleted: false,
      },
      order: { createdAt: 'DESC' },
      select: ['branchId'],
    });

    return prior?.branchId ?? null;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async bulkImportBuyerXml(
    files: Array<{ filename: string; buffer: Buffer; mimetype?: string }>,
  ): Promise<BulkImportResult> {
    return this.bulkImportMixed(files, 'IN');
  }

  async bulkImportSellerXml(
    files: Array<{ filename: string; buffer: Buffer; mimetype?: string }>,
  ): Promise<BulkImportResult> {
    return this.bulkImportMixed(files, 'OUT');
  }

  /**
   * Recursive file extraction for handling nested ZIPs, folders, and mixed XML + PDF uploads.
   */
  private extractAllEntriesRecursively(
    files: Array<{ filename: string; buffer: Buffer; mimetype?: string }>,
    errors: BulkImportErrorItem[],
  ): {
    xmlEntries: { filename: string; buffer: Buffer }[];
    pdfEntries: { filename: string; buffer: Buffer; mimetype: string }[];
  } {
    const xmlEntries: { filename: string; buffer: Buffer }[] = [];
    const pdfEntries: { filename: string; buffer: Buffer; mimetype: string }[] =
      [];

    const processFile = (name: string, buf: Buffer, mime?: string) => {
      const lower = name.toLowerCase();
      const isZip =
        lower.endsWith('.zip') ||
        mime === 'application/zip' ||
        mime === 'application/x-zip-compressed' ||
        (buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b);

      if (isZip) {
        try {
          const zip = new AdmZip(buf);
          for (const entry of zip.getEntries()) {
            if (entry.isDirectory) continue;
            const entryName = entry.entryName;
            const entryBuf = entry.getData();
            processFile(entryName, entryBuf);
          }
        } catch (e) {
          errors.push({
            filename: name,
            reason: `Không thể giải nén file ZIP: ${(e as Error).message}`,
          });
        }
      } else if (
        lower.endsWith('.xml') ||
        mime === 'application/xml' ||
        mime === 'text/xml'
      ) {
        xmlEntries.push({ filename: name, buffer: buf });
      } else if (lower.endsWith('.pdf') || mime === 'application/pdf') {
        pdfEntries.push({
          filename: name,
          buffer: buf,
          mimetype: 'application/pdf',
        });
      }
    };

    for (const f of files) {
      processFile(f.filename, f.buffer, f.mimetype);
    }

    return { xmlEntries, pdfEntries };
  }

  /**
   * Unified Bulk Import Pipeline: Handles XML/ZIP/PDF, saves Header + Line Items,
   * assigns Branch, extracts VIN/metadata, syncs VinFast parts, and links Adjustments/Replacements.
   */
  async bulkImportMixed(
    files: Array<{ filename: string; buffer: Buffer; mimetype?: string }>,
    direction: 'IN' | 'OUT',
  ): Promise<BulkImportResult> {
    const importId = crypto.randomUUID();
    const skipped: BulkImportSkippedItem[] = [];
    const errors: BulkImportErrorItem[] = [];
    let created = 0;
    const pdfAttached: any[] = [];
    const pdfOrphans: any[] = [];

    // 1. Recursive file extraction (including nested ZIPs)
    const { xmlEntries, pdfEntries } = this.extractAllEntriesRecursively(
      files,
      errors,
    );

    // 2. Map PDFs by basename for paired-file matching
    const pdfMap = new Map<
      string,
      { filename: string; buffer: Buffer; mimetype: string }
    >();
    for (const p of pdfEntries) {
      const cleanBase = this.getCleanBaseName(p.filename);
      pdfMap.set(cleanBase, p);
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

        const cleanBase = this.getCleanBaseName(file.filename);
        const matchedPdf = pdfMap.get(cleanBase);

        if (existingInvoice) {
          let updated = false;
          const updatePayload: any = {};

          // 1. Backfill XML file key if missing
          if (!existingInvoice.xmlFileKey) {
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
              await this.r2.uploadBuffer(
                xmlKey,
                file.buffer,
                'application/xml',
              );
              updatePayload.xmlFileKey = xmlKey;
              existingInvoice.xmlFileKey = xmlKey;
              updated = true;
            } catch (r2Err) {
              this.logger.warn(
                `R2 upload XML backfill failed for ${file.filename}: ${(r2Err as Error).message}`,
              );
            }
          }

          // 2. Backfill matched PDF if existing invoice lacks PDF
          if (matchedPdf) {
            pdfMap.delete(cleanBase);
            const currentPdfs = Array.isArray(existingInvoice.pdfFiles)
              ? existingInvoice.pdfFiles
              : [];
            const hasPdfAlready =
              existingInvoice.pdfFileKey || currentPdfs.length > 0;
            if (!hasPdfAlready) {
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
                const newPdfList = [
                  {
                    key: pdfKey,
                    filename: matchedPdf.filename,
                    uploadedAt: new Date().toISOString(),
                  },
                ];
                updatePayload.pdfFileKey = pdfKey;
                updatePayload.pdfFiles = newPdfList;
                existingInvoice.pdfFileKey = pdfKey;
                existingInvoice.pdfFiles = newPdfList;
                updated = true;
                pdfAttached.push({
                  filename: matchedPdf.filename,
                  invoiceNo: existingInvoice.invoiceNo,
                  invoiceId: existingInvoice.id,
                  serialNo: existingInvoice.serialNo ?? null,
                  sellerName: existingInvoice.sellerName ?? null,
                  totalAmount: existingInvoice.totalAmount ?? null,
                });
              } catch {
                this.logger.warn(
                  `R2 PDF backfill failed for ${matchedPdf.filename}`,
                );
              }
            }
          }

          // 3. Backfill branchId if missing
          if (!existingInvoice.branchId) {
            const resolvedBranchId =
              direction === 'OUT'
                ? await this.resolveBranchIdForOut(
                    existingInvoice.settlementOrder,
                    parsed.buyerTaxCode,
                  )
                : await this.resolveBranchIdForIn(
                    parsed.sellerTaxCode,
                    parsed.buyerTaxCode,
                  );
            if (resolvedBranchId) {
              updatePayload.branchId = resolvedBranchId;
              existingInvoice.branchId = resolvedBranchId;
              updated = true;
            }
          }

          // 4. Backfill line items (erp_invoice_items) if missing
          const existingItemCount = await this.repository.manager.count(
            ErpInvoiceItem,
            {
              where: { invoiceId: existingInvoice.id },
            },
          );

          if (
            existingItemCount === 0 &&
            parsed.items &&
            parsed.items.length > 0
          ) {
            const existingMap = new Map<string, string>();
            for (const ex of existingInvoice.items || []) {
              if (ex.description && ex.itemCode) {
                existingMap.set(ex.description.trim(), ex.itemCode);
              }
            }

            const invoiceLineCount = parsed.items.length;
            const itemEntities = parsed.items.map((item) => {
              const classification = classifyInvoiceLine(item, {
                buyerTaxCode: existingInvoice.buyerTaxCode,
                direction: existingInvoice.direction,
                invoiceLineCount,
                taxInvoiceStatus: existingInvoice.taxInvoiceStatus,
                headerDiscountAmount: Number(
                  existingInvoice.discountAmount ?? 0,
                ),
              });

              const existingCode = item.description
                ? existingMap.get(item.description.trim())
                : undefined;
              const resolved = extractStandardItemCode({
                description: item.description,
                itemCode: item.itemCode || existingCode,
                unit: item.unit,
                preVatAmount: item.preVatAmount,
                discountAmount: item.discountAmount,
                sellerName: existingInvoice.sellerName,
                sellerTaxCode: existingInvoice.sellerTaxCode,
              });

              return this.repository.manager.create(ErpInvoiceItem, {
                invoiceId: existingInvoice.id,
                itemCode:
                  resolved.itemCode ||
                  existingCode ||
                  item.itemCode ||
                  undefined,
                description: item.description,
                unit: item.unit,
                quantity: item.quantity != null ? String(item.quantity) : null,
                unitPrice:
                  item.unitPrice != null ? String(item.unitPrice) : null,
                preVatAmount: String(item.preVatAmount ?? 0),
                vatRate: item.vatRate != null ? String(item.vatRate) : null,
                vatAmount: String(item.vatAmount ?? 0),
                discountAmount: String(item.discountAmount ?? 0),
                totalAmount: String(item.totalAmount ?? 0),
              });
            });
            await this.repository.manager.save(ErpInvoiceItem, itemEntities);
            updated = true;
          }

          // 5. Backfill related invoice if missing
          if (!existingInvoice.relatedInvoiceNo && parsed.relatedInvoiceNo) {
            updatePayload.relatedInvoiceNo = parsed.relatedInvoiceNo;
            updatePayload.relatedSerialNo = parsed.relatedSerialNo ?? null;
            updated = true;
          }

          // 6. Save update payload if any field was backfilled
          if (updated && Object.keys(updatePayload).length > 0) {
            await this.repository.update(existingInvoice.id, updatePayload);
          }

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

        let xmlUploaded = false;
        try {
          await this.r2.uploadBuffer(xmlKey, file.buffer, 'application/xml');
          xmlUploaded = true;
        } catch (r2Err) {
          this.logger.warn(
            `R2 upload failed for ${file.filename}: ${(r2Err as Error).message}`,
          );
        }

        // 3.1. Auto-resolve Branch
        let branchId: string | null = null;
        if (direction === 'OUT') {
          branchId = await this.resolveBranchIdForOut(
            undefined,
            parsed.buyerTaxCode,
          );
        } else {
          branchId = await this.resolveBranchIdForIn(
            parsed.sellerTaxCode,
            parsed.buyerTaxCode,
          );
        }

        // 3.2. Determine Tax Invoice Status (Adjustment vs Replacement vs Standard)
        let taxInvoiceStatus = 1; // Standard confirmed
        if (
          parsed.rawSource?.includes('REPLACE') ||
          parsed.relatedNote?.toLowerCase().includes('thay thế')
        ) {
          taxInvoiceStatus = 3; // Thay thế
        } else if (
          parsed.rawSource?.includes('ADJUST') ||
          parsed.relatedNote?.toLowerCase().includes('điều chỉnh')
        ) {
          taxInvoiceStatus = 2; // Điều chỉnh
        }

        const newInvoiceData: any = {
          invoiceNo: parsed.invoiceNo,
          invoiceNoNormalized: invoiceNoNorm || undefined,
          serialNo: parsed.serialNo,
          invoiceDate: parsed.invoiceDate,
          direction,
          status: 'CONFIRMED',
          taxInvoiceStatus,
          branchId,
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
          notes: parsed.relatedNote ?? undefined,
          preVatAmount: String(parsed.preVatAmount),
          vatRate: parsed.vatRate != null ? String(parsed.vatRate) : null,
          vatAmount: String(parsed.vatAmount),
          discountAmount: String(parsed.discountAmount),
          totalAmount: String(parsed.totalAmount),
          relatedInvoiceNo: parsed.relatedInvoiceNo ?? null,
          relatedSerialNo: parsed.relatedSerialNo ?? null,
          xmlFileKey: xmlUploaded ? xmlKey : null,
          xmlImportId: importId,
          pdfFiles: [],
        };

        const newInvoice = this.repository.create(
          newInvoiceData,
        ) as any as ErpInvoice;

        extractInvoiceMetadata(newInvoice);

        // 3.3. Attach paired PDF if present
        if (matchedPdf) {
          pdfMap.delete(cleanBase);
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

        const savedInvoice = (await this.repository.save(
          newInvoice,
        )) as ErpInvoice;

        // 3.4. Save ErpInvoiceItem line items
        if (parsed.items && parsed.items.length > 0) {
          const invoiceLineCount = parsed.items.length;
          const itemEntities = parsed.items.map((item) => {
            const classification = classifyInvoiceLine(item, {
              buyerTaxCode: savedInvoice.buyerTaxCode,
              direction: savedInvoice.direction,
              invoiceLineCount,
              taxInvoiceStatus: savedInvoice.taxInvoiceStatus,
              headerDiscountAmount: Number(savedInvoice.discountAmount ?? 0),
            });

            const resolved = extractStandardItemCode({
              description: item.description,
              itemCode: item.itemCode,
              unit: item.unit,
              preVatAmount: item.preVatAmount,
              discountAmount: item.discountAmount,
              sellerName: savedInvoice.sellerName,
              sellerTaxCode: savedInvoice.sellerTaxCode,
            });

            return this.repository.manager.create(ErpInvoiceItem, {
              invoiceId: savedInvoice.id,
              itemCode: resolved.itemCode || item.itemCode || undefined,
              description: item.description,
              unit: item.unit,
              quantity: item.quantity != null ? String(item.quantity) : null,
              unitPrice: item.unitPrice != null ? String(item.unitPrice) : null,
              preVatAmount: String(item.preVatAmount ?? 0),
              vatRate: item.vatRate != null ? String(item.vatRate) : null,
              vatAmount: String(item.vatAmount ?? 0),
              discountAmount: String(item.discountAmount ?? 0),
              totalAmount: String(item.totalAmount ?? 0),
            });
          });

          await this.repository.manager.save(ErpInvoiceItem, itemEntities);
        }

        // 3.5. VinFast Parts Catalog & Ledger Auto-sync
        if (this.vinfastPartsService && savedInvoice.direction === 'IN') {
          const sellerMst = savedInvoice.sellerTaxCode ?? '';
          const sellerName = (savedInvoice.sellerName ?? '').toUpperCase();
          const isVinfast =
            sellerMst === '0108926276' ||
            sellerMst === '0108926276-001' ||
            sellerName.includes('VINFAST');

          if (isVinfast && parsed.items && parsed.items.length > 0) {
            await this.vinfastPartsService
              .syncCatalog({})
              .catch((e) =>
                this.logger.warn(`Vinfast catalog sync error: ${e.message}`),
              );

            await this.vinfastPartsService
              .syncLedger({})
              .catch((e) =>
                this.logger.warn(`Vinfast ledger sync error: ${e.message}`),
              );
          }
        }

        // 3.6. Relative original invoice status update (Adjustment/Replacement)
        if (parsed.relatedInvoiceNo) {
          await this.syncRelatedOriginalInvoice(
            parsed.relatedInvoiceNo,
            parsed.relatedSerialNo,
            savedInvoice,
          );
        }

        // 3.7. Tự động phân loại AI & Hạch toán đối với hóa đơn mua vào (direction = IN)
        if (this.categoryAutopostService && savedInvoice.direction === 'IN') {
          this.categoryAutopostService
            .classifyAndAutoPost(savedInvoice.id)
            .catch((e) =>
              this.logger.warn(
                `AI classify and auto-post error for invoice ${savedInvoice.invoiceNo}: ${e?.message}`,
              ),
            );
        }

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
      const foundInvoice = await this.findInvoiceForOrphanPdf(
        pdf.filename,
        direction,
      );

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

  private async syncRelatedOriginalInvoice(
    relatedInvoiceNo: string,
    relatedSerialNo: string | null | undefined,
    currentInvoice: ErpInvoice,
  ): Promise<void> {
    try {
      const whereClause: any = {
        invoiceNo: String(relatedInvoiceNo).trim(),
        direction: currentInvoice.direction,
        isDeleted: false,
      };

      if (relatedSerialNo) {
        whereClause.serialNo = String(relatedSerialNo).trim();
      }

      if (currentInvoice.direction === 'IN' && currentInvoice.sellerTaxCode) {
        whereClause.sellerTaxCode = currentInvoice.sellerTaxCode;
      }

      const original = await this.repository.findOne({ where: whereClause });
      if (original) {
        const newStatus = currentInvoice.taxInvoiceStatus === 3 ? 5 : 4;
        await this.repository.update(original.id, {
          taxInvoiceStatus: newStatus,
        });
        this.logger.log(
          `Updated related original invoice ${original.invoiceNo} status from ${original.taxInvoiceStatus} -> ${newStatus}`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `Failed to sync related original invoice status for ${relatedInvoiceNo}: ${(err as Error).message}`,
      );
    }
  }

  private getCleanBaseName(filepath: string): string {
    const base = filepath.split('/').pop()?.split('\\').pop() ?? filepath;
    const dotIdx = base.lastIndexOf('.');
    return (dotIdx > 0 ? base.substring(0, dotIdx) : base).toLowerCase();
  }

  async previewPdfMatch(
    filenames: string[],
    direction: 'IN' | 'OUT',
  ): Promise<
    Record<
      string,
      {
        id: string;
        invoiceNo: string;
        serialNo: string | null;
        totalAmount: string | null;
      } | null
    >
  > {
    const result: Record<string, any> = {};
    for (const filename of filenames) {
      const foundInvoice = await this.findInvoiceForOrphanPdf(
        filename,
        direction,
      );

      if (foundInvoice) {
        result[filename] = {
          id: foundInvoice.id,
          invoiceNo: foundInvoice.invoiceNo,
          serialNo: foundInvoice.serialNo ?? null,
          totalAmount: foundInvoice.totalAmount ?? null,
        };
      } else {
        result[filename] = null;
      }
    }
    return result;
  }

  private async findInvoiceForOrphanPdf(
    filename: string,
    direction: 'IN' | 'OUT',
  ) {
    const baseName =
      filename
        .split('/')
        .pop()
        ?.replace(/\.[^.]+$/, '') ?? filename;

    const digitsMatch = baseName.match(/(\d{1,})/g);
    const serialTokens = this.extractSerialTokens(baseName);

    if (!digitsMatch || digitsMatch.length === 0) return null;

    const candidateNumbers = Array.from(
      new Set(digitsMatch.map((n) => n.trim())),
    );

    // Pass 1: exact normalized invoice number match.
    for (const rawNumber of candidateNumbers) {
      const normNo = normalizeInvoiceNo(rawNumber);
      if (!normNo) continue;

      const exactCandidates = await this.repository.find({
        where: { invoiceNoNormalized: normNo, direction } as any,
        order: { createdAt: 'DESC' },
      });
      const exactPicked = this.pickBestCandidate(
        exactCandidates,
        serialTokens,
        candidateNumbers,
      );
      if (exactPicked) return exactPicked;
    }

    // Pass 2: suffix fallback for prefixed invoice numbers (e.g. AB/1781).
    for (const rawNumber of candidateNumbers) {
      const normNo = normalizeInvoiceNo(rawNumber);
      if (!normNo) continue;

      if (normNo.length >= 2) {
        const suffixCandidates = await this.repository
          .createQueryBuilder('inv')
          .where('inv.direction = :direction', { direction })
          .andWhere('inv.invoiceNoNormalized LIKE :suffix', {
            suffix: `%${this.escapeLikeValue(normNo)}`,
          })
          .orderBy('inv.createdAt', 'DESC')
          .limit(20)
          .getMany();

        const suffixPicked = this.pickBestCandidate(
          suffixCandidates,
          serialTokens,
          candidateNumbers,
        );
        if (suffixPicked) return suffixPicked;
      }
    }

    return null;
  }

  private pickBestCandidate(
    candidates: ErpInvoice[],
    serialTokens: string[],
    candidateNumbers: string[],
  ): ErpInvoice | null {
    if (!candidates || candidates.length === 0) return null;

    let bestCandidate = candidates[0];
    let maxScore = -1;

    for (const candidate of candidates) {
      let score = 0;

      // 1. Match serial (+5 points)
      if (candidate.serialNo) {
        const cSerial = candidate.serialNo.toLowerCase();
        if (serialTokens.includes(cSerial)) {
          score += 5;
        }
      }

      // 2. Match tax code (+10 points)
      const taxCode =
        candidate.direction === 'IN'
          ? candidate.sellerTaxCode
          : candidate.buyerTaxCode;
      if (taxCode && candidateNumbers.includes(taxCode)) {
        score += 10;
      }

      if (score > maxScore) {
        maxScore = score;
        bestCandidate = candidate;
      }
    }

    return bestCandidate;
  }

  private extractSerialTokens(baseName: string): string[] {
    return baseName
      .split(/[^a-zA-Z0-9]+/)
      .map((token) => token.trim().toLowerCase())
      .filter(
        (token) =>
          token.length >= 5 && token.length <= 8 && /[a-z]/.test(token),
      );
  }

  private escapeLikeValue(value: string): string {
    return value.replace(/[\\%_]/g, '\\$&');
  }
}
