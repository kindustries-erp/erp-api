import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { ErpInvoice } from '../../entities/erp_invoice.entity';
import { ErpModuleCategory } from '../../../module-config/entities/erp_module_category.entity';
import { ErpModuleAttributeDef } from '../../../module-config/entities/erp_module_attribute_def.entity';
import { ErpChartOfAccount } from '../../../accounting-core/entities/erp_chart_of_account.entity';
import { ErpJournalEntry } from '../../../accounting-core/entities/erp_journal_entry.entity';
import { ErpJournalEntryLine } from '../../../accounting-core/entities/erp_journal_entry_line.entity';
import { AccountingCoreService } from '../../../accounting-core/services/accounting-core.service';
import { InvoiceAiHandler } from '../../../ai-hub-core/handlers/invoice-ai.handler';
import {
  resolveInvoiceAccountsByCategory,
  FALLBACK_PURCHASE_DEBIT_ACCOUNT,
} from '../../helpers/invoice-category-account-mapping.helper';

@Injectable()
export class InvoiceCategoryAutopostService {
  private readonly logger = new Logger(InvoiceCategoryAutopostService.name);

  constructor(
    @InjectRepository(ErpInvoice)
    private readonly invoiceRepo: Repository<ErpInvoice>,
    @InjectRepository(ErpModuleCategory)
    private readonly categoryRepo: Repository<ErpModuleCategory>,
    @InjectRepository(ErpModuleAttributeDef)
    private readonly attrDefRepo: Repository<ErpModuleAttributeDef>,
    @InjectRepository(ErpChartOfAccount)
    private readonly chartOfAccountRepo: Repository<ErpChartOfAccount>,
    @InjectRepository(ErpJournalEntry)
    private readonly journalEntryRepo: Repository<ErpJournalEntry>,
    @InjectRepository(ErpJournalEntryLine)
    private readonly journalEntryLineRepo: Repository<ErpJournalEntryLine>,
    private readonly accountingCoreService: AccountingCoreService,
    private readonly invoiceAiHandler: InvoiceAiHandler,
  ) {}

  /**
   * Tự động hạch toán hoặc tái hạch toán (In-Place update) hóa đơn đầu vào theo mã phân loại.
   */
  async autoPostInvoiceByCategory(
    invoiceId: string,
    categoryCode?: string | null,
  ): Promise<ErpInvoice> {
    const invoice = await this.invoiceRepo.findOne({
      where: { id: invoiceId, isDeleted: false },
      relations: ['category', 'category.defaultDebitAccount', 'items'],
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${invoiceId} không tìm thấy`);
    }

    // Nếu không truyền categoryCode, ưu tiên lấy từ relation category
    const activeCategoryCode =
      categoryCode !== undefined
        ? categoryCode
        : invoice.category?.code || null;

    // Lấy override debit account code từ DB:
    // Ưu tiên 1: Dynamic Option Config trong ErpModuleAttributeDef (cấu hình trường tùy chỉnh phân loại)
    let overrideDebitAccountCode: string | null = null;
    if (activeCategoryCode) {
      try {
        const categoryAttrDefs = await this.attrDefRepo.find({
          where: {
            code: 'category',
            isDeleted: false,
          },
        });
        for (const def of categoryAttrDefs) {
          if (Array.isArray(def.options)) {
            const matchedOpt = def.options.find(
              (opt) => opt.value === activeCategoryCode,
            );
            if (matchedOpt?.accountCode) {
              overrideDebitAccountCode = matchedOpt.accountCode;
              break;
            }
          }
        }
      } catch (err: any) {
        this.logger.warn(
          `Failed to lookup ErpModuleAttributeDef for category ${activeCategoryCode}: ${err?.message}`,
        );
      }
    }

    // Ưu tiên 2: Từ FK quan hệ category.defaultDebitAccount (nếu có)
    if (
      !overrideDebitAccountCode &&
      invoice.category?.defaultDebitAccount &&
      !invoice.category.defaultDebitAccount.isDeleted
    ) {
      overrideDebitAccountCode =
        invoice.category.defaultDebitAccount.accountCode || null;
    }

    const resolution = resolveInvoiceAccountsByCategory(
      activeCategoryCode,
      overrideDebitAccountCode,
    );

    const logSource = overrideDebitAccountCode
      ? `[DB_OVERRIDE: ${overrideDebitAccountCode}]`
      : resolution.isFallback
        ? `[T0003_FALLBACK]`
        : `[STATIC_MAP: ${resolution.debitAccountCode}]`;
    this.logger.log(
      `Resolved Invoice ${invoice.invoiceNo} category ${activeCategoryCode || 'NONE'} -> Debit Account ${resolution.debitAccountCode} via ${logSource}`,
    );

    // 1. Tải danh mục tài khoản kế toán
    const accounts = await this.chartOfAccountRepo.find({
      where: { isActive: true, isDeleted: false },
    });

    const findAccountId = (code: string): string | null => {
      const exact = accounts.find((a) => a.accountCode === code);
      if (exact) return exact.id;
      const starts = accounts.find((a) => a.accountCode.startsWith(code));
      return starts ? starts.id : null;
    };

    const debitAccountId = findAccountId(resolution.debitAccountCode);
    const vatAccountId = findAccountId(resolution.vatAccountCode);
    const apAccountId = findAccountId(resolution.creditAccountCode);

    if (!debitAccountId || !apAccountId) {
      throw new BadRequestException(
        `Không tìm thấy tài khoản kế toán hợp lệ trong hệ thống (Nợ ${resolution.debitAccountCode} hoặc Có ${resolution.creditAccountCode})`,
      );
    }

    // 2. Nếu hóa đơn ĐÃ ĐƯỢC POST trước đó -> Update In-Place các dòng bút toán
    if (invoice.postingStatus === 'POSTED' && invoice.journalEntryId) {
      const je = await this.journalEntryRepo.findOne({
        where: { id: invoice.journalEntryId, isDeleted: false },
        relations: ['lines', 'lines.account'],
      });

      if (je && je.lines && je.lines.length > 0) {
        for (const line of je.lines) {
          // Cập nhật dòng Nợ chi phí/hàng hóa (không phải dòng Thuế 1331 và không phải dòng Có 331)
          if (Number(line.debit) > 0) {
            const currentCode = line.account?.accountCode || '';
            if (currentCode === '133' || currentCode === '1331') {
              // Chuẩn hóa dòng thuế về đúng 1331
              if (vatAccountId && line.accountId !== vatAccountId) {
                await this.journalEntryLineRepo.update(line.id, {
                  accountId: vatAccountId,
                });
              }
            } else {
              // Dòng chi phí / hàng hóa -> cập nhật sang tài khoản đích mới
              await this.journalEntryLineRepo.update(line.id, {
                accountId: debitAccountId,
              });
            }
          }
        }
        // Đảm bảo reference, sourceId và sourceType luôn đồng bộ
        const invoiceRef = invoice.serialNo
          ? `${invoice.invoiceNo}-${invoice.serialNo}`
          : invoice.invoiceNo;
        if (
          !je.reference ||
          je.reference !== invoiceRef ||
          !je.sourceId ||
          je.sourceId !== invoice.id ||
          je.sourceType !== 'INVOICE'
        ) {
          await this.journalEntryRepo.update(je.id, {
            reference: invoiceRef,
            sourceId: invoice.id,
            sourceType: 'INVOICE',
          });
        }
        this.logger.log(
          `Re-aligned Journal Entry ${je.entryNo} for Invoice ${invoice.invoiceNo} -> Debit Account: ${resolution.debitAccountCode} (Ref: ${invoiceRef})`,
        );
        return invoice;
      }
    }

    // 3. Nếu hóa đơn CHƯA POST -> Tạo mới Journal Entry
    // Đảm bảo có branchId
    if (!invoice.branchId) {
      const branches: { id: string }[] = await this.invoiceRepo.manager.query(
        `SELECT id FROM erp_branches WHERE is_deleted = false LIMIT 1`,
      );
      if (branches.length > 0) {
        invoice.branchId = branches[0].id;
        await this.invoiceRepo.save(invoice);
      } else {
        throw new BadRequestException(
          'Hóa đơn chưa có chi nhánh để hạch toán.',
        );
      }
    }

    const preVat = Math.round(Number(invoice.preVatAmount || 0) * 100) / 100;
    const vat = Math.round(Number(invoice.vatAmount || 0) * 100) / 100;
    const total = Math.round(Number(invoice.totalAmount || 0) * 100) / 100;

    if (total <= 0) {
      throw new BadRequestException(
        'Tổng tiền hóa đơn <= 0, không thể hạch toán.',
      );
    }

    const invoiceRef = invoice.serialNo
      ? `${invoice.invoiceNo}-${invoice.serialNo}`
      : invoice.invoiceNo;
    const defaultDesc =
      invoice.description || `Hạch toán hóa đơn ${invoice.invoiceNo}`;
    const entryNoPrefix = invoice.direction === 'IN' ? 'HĐM' : 'HĐB';

    const lines: {
      accountId: string;
      debit: number;
      credit: number;
      description?: string;
    }[] = [];

    // Nếu bóc tách được Tiền hàng + Thuế VAT (và tổng khớp)
    if (
      preVat > 0 &&
      vat > 0 &&
      Math.abs(preVat + vat - total) <= 1.0 &&
      vatAccountId
    ) {
      lines.push({
        accountId: debitAccountId,
        debit: preVat,
        credit: 0,
        description: `${invoiceRef}_${defaultDesc}`,
      });
      lines.push({
        accountId: vatAccountId,
        debit: vat,
        credit: 0,
        description: `${invoiceRef}_Thuế GTGT đầu vào`,
      });
      lines.push({
        accountId: apAccountId,
        debit: 0,
        credit: total,
        description: `${invoiceRef}_Phải trả người bán`,
      });
    } else {
      // Hạch toán gộp toàn bộ vào TK Nợ đích
      lines.push({
        accountId: debitAccountId,
        debit: total,
        credit: 0,
        description: `${invoiceRef}_${defaultDesc}`,
      });
      lines.push({
        accountId: apAccountId,
        debit: 0,
        credit: total,
        description: `${invoiceRef}_Phải trả người bán`,
      });
    }

    const postingDate = invoice.invoiceDate
      ? new Date(invoice.invoiceDate)
      : new Date();

    const journalEntry = await this.accountingCoreService.createJournalEntry({
      branchId: invoice.branchId,
      date: postingDate,
      documentDate: postingDate,
      reference: invoiceRef,
      description: `${invoiceRef}_${defaultDesc}`,
      subjectName: invoice.sellerName || undefined,
      sourceType: 'INVOICE',
      sourceId: invoice.id,
      entryNoPrefix,
      lines,
    });

    invoice.postingStatus = 'POSTED';
    invoice.postingDate = postingDate.toISOString().slice(0, 10);
    invoice.journalEntryId = journalEntry.id;
    await this.invoiceRepo.save(invoice);

    this.logger.log(
      `Auto-posted Invoice ${invoice.invoiceNo} -> JE ${journalEntry.entryNo} (Debit ${resolution.debitAccountCode} / Credit 331)`,
    );

    return invoice;
  }

  /**
   * Cập nhật phân loại cho một hóa đơn và tự động hạch toán / cập nhật bút toán sổ cái.
   */
  async setCategoryAndAutoPost(
    invoiceId: string,
    categoryId: string | null,
  ): Promise<ErpInvoice> {
    const invoice = await this.invoiceRepo.findOne({
      where: { id: invoiceId, isDeleted: false },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${invoiceId} không tìm thấy`);
    }

    let categoryCode: string | null = null;
    if (categoryId) {
      const category = await this.categoryRepo.findOne({
        where: { id: categoryId, isDeleted: false },
      });
      if (!category) {
        throw new NotFoundException(`Category ${categoryId} không tồn tại`);
      }
      categoryCode = category.code;
    }

    invoice.categoryId = categoryId;
    await this.invoiceRepo.save(invoice);

    return this.autoPostInvoiceByCategory(invoiceId, categoryCode);
  }

  /**
   * Cập nhật phân loại hàng loạt và tự động hạch toán.
   */
  async bulkSetCategory(
    invoiceIds: string[],
    categoryId: string | null,
  ): Promise<{
    updated: number;
    total: number;
    errors: Array<{ id: string; error: string }>;
  }> {
    if (!invoiceIds || invoiceIds.length === 0) {
      return { updated: 0, total: 0, errors: [] };
    }

    let updated = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const id of invoiceIds) {
      try {
        await this.setCategoryAndAutoPost(id, categoryId);
        updated++;
      } catch (err: any) {
        errors.push({ id, error: err?.message || 'Unknown error' });
      }
    }

    return { updated, total: invoiceIds.length, errors };
  }

  /**
   * Gọi AI 9router tự động phân loại hóa đơn đầu vào và tự động hạch toán (kèm Fallback an toàn).
   */
  async classifyAndAutoPost(invoiceId: string): Promise<{
    invoice: ErpInvoice;
    categoryCode: string | null;
    confidence: number;
    reason: string;
    isFallback: boolean;
  }> {
    const invoice = await this.invoiceRepo.findOne({
      where: { id: invoiceId, isDeleted: false },
      relations: ['items', 'category'],
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${invoiceId} không tìm thấy`);
    }

    // Nếu hóa đơn đã có categoryId từ trước, dùng luôn category đó
    let categoryCode = invoice.category?.code || null;
    let confidence = 1.0;
    let reason = 'Đã có phân loại thủ công';

    if (!categoryCode) {
      const aiResult = await this.invoiceAiHandler.classifyInvoiceCategory({
        invoiceNo: invoice.invoiceNo ?? undefined,
        serialNo: invoice.serialNo ?? undefined,
        sellerName: invoice.sellerName ?? undefined,
        sellerTaxCode: invoice.sellerTaxCode ?? undefined,
        buyerName: invoice.buyerName ?? undefined,
        buyerTaxCode: invoice.buyerTaxCode ?? undefined,
        description: invoice.description ?? undefined,
        notes: invoice.notes ?? undefined,
        totalAmount: Number(invoice.totalAmount || 0),
        items: (invoice.items || []).map((it) => ({
          itemCode: it.itemCode ?? undefined,
          description: it.description ?? undefined,
          quantity: Number(it.quantity || 1),
          unitPrice: Number(it.unitPrice || 0),
          totalAmount: Number(it.totalAmount || 0),
        })),
      });

      categoryCode = aiResult.categoryCode;
      confidence = aiResult.confidence;
      reason = aiResult.reason;

      // Nếu AI phân loại thành công -> gán categoryId vào invoice
      if (categoryCode) {
        const foundCategory = await this.categoryRepo.findOne({
          where: { moduleKey: 'INVOICE', code: categoryCode, isDeleted: false },
        });
        if (foundCategory) {
          invoice.categoryId = foundCategory.id;
          await this.invoiceRepo.save(invoice);
        }
      }
    }

    // Tự động hạch toán (hoặc fallback Nợ T0003 nếu categoryCode == null)
    const updatedInvoice = await this.autoPostInvoiceByCategory(
      invoiceId,
      categoryCode,
    );
    const isFallback = !categoryCode;

    return {
      invoice: updatedInvoice,
      categoryCode,
      confidence,
      reason,
      isFallback,
    };
  }
}
