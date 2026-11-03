import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';

import { ErpInvoice } from '../entities/erp_invoice.entity';
import { InvoiceBranchService } from './invoice-branch.service';
import { readBranchIds } from '../../common/utils/branch-ids.util';
import { ErpInvoiceItem } from '../entities/erp_invoice_item.entity';
import { ErpInvoiceVoucherNetOff } from '../entities/erp_invoice_voucher_netoff.entity';
import { CreateErpInvoiceDto } from '../dto/create-erp-invoice.dto';
import { UpdateErpInvoiceDto } from '../dto/update-erp-invoice.dto';
import { PostInvoiceDto } from '../dto/post-invoice.dto';
import { extractInvoiceMetadata } from '../helpers/invoice-metadata.helper';
import { toInvoiceDto } from '../helpers/invoice-mapper.helper';
import { resolvePurchaseDebitAccountCode } from '../helpers/invoice-tax-code-accounting.helper';
import { R2Service } from '../../r2/r2.service';
import { BankTransactionsCoreService } from '../../bank-transactions-core/bank-transactions-core.service';
import { AccountingCoreService } from '../../accounting-core/services/accounting-core.service';
import { ErpBankTransaction } from '../../bank-transactions-core/entities/erp_bank_transaction.entity';

import { ErpEntityAttributeValue } from '../../module-config/entities/erp_entity_attribute_value.entity';
import { TransactionAccountingService } from '../../bank-transactions-core/services/transaction-accounting.service';
import {
  extractVinfastItemCode,
  extractStandardItemCode,
} from '../helpers/vinfast-part-code.helper';

/** Danh sách chi nhánh hiện tại; dữ liệu cũ chỉ có branchId thì coi là 1 phần tử. */
function currentBranchIds(inv: {
  branchId: string | null;
  branchIds?: string[] | null;
}): string[] {
  if (inv.branchIds?.length) return inv.branchIds;
  return inv.branchId ? [inv.branchId] : [];
}

function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id));
}

@Injectable()
export class InvoiceLifecycleService {
  private readonly logger = new Logger(InvoiceLifecycleService.name);

  constructor(
    @InjectRepository(ErpInvoice)
    private readonly repository: Repository<ErpInvoice>,
    @InjectRepository(ErpEntityAttributeValue)
    private readonly entityAttrValueRepo: Repository<ErpEntityAttributeValue>,
    private readonly r2: R2Service,
    private readonly bankTransactionsCoreService: BankTransactionsCoreService,
    private readonly accountingCoreService: AccountingCoreService,
    private readonly transactionAccountingService: TransactionAccountingService,
    private readonly branchService: InvoiceBranchService,
  ) {}

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  /**
   * Tra cứu theo số hoặc ký hiệu đơn lẻ. Số hóa đơn có thể trùng giữa các ký hiệu/năm/đối tác,
   * nên khi có nhiều kết quả thì báo lỗi yêu cầu nhập ký hiệu_số, không trả một bản ghi tùy ý.
   */
  private async findSingleByNumber(
    where: FindOptionsWhere<ErpInvoice>,
    relations: string[],
  ): Promise<ErpInvoice | null> {
    const rows = await this.repository.find({ where, relations, take: 6 });
    if (rows.length > 1) {
      const options = rows
        .slice(0, 5)
        .map((r) => `${r.serialNo ?? '-'}_${r.invoiceNo}`)
        .join(', ');
      throw new BadRequestException(
        `Có ${rows.length} hóa đơn trùng số, vui lòng nhập theo ký hiệu_số (ví dụ: ${options}).`,
      );
    }
    return rows[0] ?? null;
  }

  async findOne(id: string) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      );

    const relations = [
      'items',
      'voucherNetOffs',
      'voucherNetOffs.bankTransaction',
      'voucherNetOffs.bankTransaction.bankAccount',
      'voucherNetOffs.bankTransaction.cashBook',
      'attachments',
      'attachments.attachment',
      'category',
    ];

    let data: ErpInvoice | null = null;
    if (isUuid) {
      data = await this.repository.findOne({
        where: { id, isDeleted: false },
        relations,
      });
    } else if (id.includes('_') || id.includes('-')) {
      const sep = id.includes('_') ? '_' : '-';
      const parts = id.split(sep);
      const first = parts[0];
      const rest = parts.slice(1).join(sep);

      // Thử 1: Ký hiệu _ Số hóa đơn (serialNo = first, invoiceNo = rest)
      data = await this.repository.findOne({
        where: {
          serialNo: first,
          invoiceNo: rest,
          isDeleted: false,
        },
        relations,
      });

      // Thử 2: Số hóa đơn _ Ký hiệu (invoiceNo = first, serialNo = rest)
      if (!data) {
        data = await this.repository.findOne({
          where: {
            invoiceNo: first,
            serialNo: rest,
            isDeleted: false,
          },
          relations,
        });
      }
    }

    if (!data) {
      data = await this.findSingleByNumber(
        { invoiceNo: id, isDeleted: false },
        relations,
      );
    }

    if (!data) {
      data = await this.findSingleByNumber(
        { serialNo: id, isDeleted: false },
        relations,
      );
    }

    if (!data && !isUuid) {
      try {
        data = await this.repository.findOne({
          where: { id, isDeleted: false },
          relations,
        });
      } catch {
        // Ignore DB UUID syntax error if any
      }
    }

    if (!data) throw new NotFoundException(`Invoice ${id} không tìm thấy`);

    // Load custom attributes & global attributes
    const entityAttrValues = await this.entityAttrValueRepo.find({
      where: {
        entityType: In(['INVOICE', 'INVOICE_IN', 'INVOICE_OUT']),
        entityId: data.id,
      },
      relations: ['attrDef'],
    });

    const attributes: Record<string, any> = {};
    const globalAttributes: Record<string, any> = {};
    for (const ev of entityAttrValues) {
      if (ev.attrDef?.isGlobal) {
        globalAttributes[ev.attrDefId] = ev.valueText;
        if (ev.attrDef?.code) {
          globalAttributes[ev.attrDef.code] = ev.valueText;
        }
      } else {
        attributes[ev.attrDefId] = ev.valueText;
        if (ev.attrDef?.code) {
          attributes[ev.attrDef.code] = ev.valueText;
        }
      }
    }

    const attributeValues = entityAttrValues.map((ev) => ({
      id: ev.id,
      attrDefId: ev.attrDefId,
      attrCode: ev.attrDef?.code,
      attrName: ev.attrDef?.name,
      fieldType: ev.attrDef?.fieldType,
      valueText: ev.valueText,
      isGlobal: ev.attrDef?.isGlobal || false,
    }));

    (data as any).attributes = attributes;
    (data as any).globalAttributes = globalAttributes;
    (data as any).customAttributes = attributes;
    (data as any).attributeValues = attributeValues;

    return { message: 'Lấy thông tin thành công', data: toInvoiceDto(data) };
  }

  // ---------------------------------------------------------------------------
  // Create / Update / Delete
  // ---------------------------------------------------------------------------

  async create(dto: CreateErpInvoiceDto) {
    const createPayload: any = { ...dto };
    delete createPayload.attributes;
    const createBranchIds =
      dto.branchIds ?? (dto.branchId ? [dto.branchId] : []);
    createPayload.branchIds = createBranchIds;
    createPayload.branchId = createBranchIds[0] ?? null;

    const invoice = this.repository.create({
      ...createPayload,
      preVatAmount: String(dto.preVatAmount ?? 0),
      vatRate: dto.vatRate != null ? String(dto.vatRate) : null,
      vatAmount: String(dto.vatAmount ?? 0),
      discountAmount: String(dto.discountAmount ?? 0),
      totalAmount: String(dto.totalAmount ?? 0),
      items: dto.items?.map((i) => {
        const resolved = extractStandardItemCode({
          description: i.description,
          itemCode: i.itemCode,
          unit: i.unit,
          discountAmount: i.discountAmount,
          preVatAmount: i.preVatAmount,
          sellerName: dto.sellerName,
          sellerTaxCode: dto.sellerTaxCode,
          direction: dto.direction,
        });
        return {
          itemCode: resolved.itemCode || i.itemCode || null,
          description: i.description,
          unit: i.unit,
          quantity: i.quantity != null ? String(i.quantity) : null,
          unitPrice: i.unitPrice != null ? String(i.unitPrice) : null,
          preVatAmount: String(i.preVatAmount ?? 0),
          vatRate: i.vatRate != null ? String(i.vatRate) : null,
          vatAmount: String(i.vatAmount ?? 0),
          discountAmount: String(i.discountAmount ?? 0),
          totalAmount: String(i.totalAmount ?? 0),
        };
      }),
    } as any);

    extractInvoiceMetadata(invoice);

    const saved = (await this.repository.save(
      invoice,
    )) as unknown as ErpInvoice;
    return { message: 'Tạo thành công', data: toInvoiceDto(saved) };
  }

  async update(id: string, dto: UpdateErpInvoiceDto) {
    const existing = await this.repository.findOne({
      where: { id, isDeleted: false },
      relations: ['items'],
    });
    if (!existing) throw new NotFoundException(`Invoice ${id} không tìm thấy`);

    const updatePayload: any = { ...dto };
    delete updatePayload.attributes;
    if (dto.branchIds !== undefined) {
      updatePayload.branchIds = dto.branchIds;
    } else if (dto.branchId !== undefined) {
      updatePayload.branchIds = dto.branchId ? [dto.branchId] : [];
    }
    if (updatePayload.branchIds !== undefined) {
      updatePayload.branchId = updatePayload.branchIds[0] ?? null;
    }
    if (dto.preVatAmount != null)
      updatePayload.preVatAmount = String(dto.preVatAmount);
    if (dto.vatRate != null) updatePayload.vatRate = String(dto.vatRate);
    if (dto.vatAmount != null) updatePayload.vatAmount = String(dto.vatAmount);
    if (dto.discountAmount != null)
      updatePayload.discountAmount = String(dto.discountAmount);
    if (dto.totalAmount != null)
      updatePayload.totalAmount = String(dto.totalAmount);

    await this.repository.manager.transaction(async (manager) => {
      const oldBranchIds = currentBranchIds(existing);
      const wasPosted = existing.postingStatus === 'POSTED';

      this.repository.merge(existing, updatePayload);

      if (dto.items) {
        // Preserve Guard: preserve existing itemCode if set previously
        const existingMap = new Map<string, string>();
        for (const ex of existing.items || []) {
          if (ex.description && ex.itemCode) {
            existingMap.set(ex.description.trim(), ex.itemCode);
          }
        }

        await manager.delete(ErpInvoiceItem, { invoiceId: id });
        const newItems = dto.items.map((i) => {
          const existingCode = i.description
            ? existingMap.get(i.description.trim())
            : undefined;
          const resolved = extractStandardItemCode({
            description: i.description,
            itemCode: i.itemCode || existingCode,
            unit: i.unit,
            discountAmount: i.discountAmount,
            preVatAmount: i.preVatAmount,
            sellerName: existing.sellerName,
            sellerTaxCode: existing.sellerTaxCode,
            direction: existing.direction,
          });

          return manager.create(ErpInvoiceItem, {
            invoiceId: id,
            itemCode: resolved.itemCode || existingCode || i.itemCode || null,
            description: i.description,
            unit: i.unit,
            quantity: i.quantity != null ? String(i.quantity) : null,
            unitPrice: i.unitPrice != null ? String(i.unitPrice) : null,
            preVatAmount: String(i.preVatAmount ?? 0),
            vatRate: i.vatRate != null ? String(i.vatRate) : null,
            vatAmount: String(i.vatAmount ?? 0),
            discountAmount: String(i.discountAmount ?? 0),
            totalAmount: String(i.totalAmount ?? 0),
          });
        });
        await manager.save(ErpInvoiceItem, newItems);
        delete (existing as any).items;
      }

      extractInvoiceMetadata(existing);
      await manager.save(ErpInvoice, existing);

      const newBranchIds = currentBranchIds(existing);
      if (wasPosted && !sameIds(oldBranchIds, newBranchIds)) {
        // Tái phân bổ cùng transaction: lỗi thì hóa đơn và bút toán đều không đổi
        await this.accountingCoreService.reallocateJournalEntriesBySource(
          id,
          'INVOICE',
          newBranchIds,
          existing.direction === 'IN' ? 'HĐM' : 'HĐB',
          manager,
        );
      }
    });
    return this.findOne(id);
  }

  async remove(id: string) {
    const existing = await this.repository.findOne({
      where: { id, isDeleted: false },
    });
    if (!existing) throw new NotFoundException(`Invoice ${id} không tìm thấy`);
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException('Chỉ có thể xóa hóa đơn nháp');
    }

    await this.repository.update(id, { isDeleted: true } as any);

    if (existing.xmlFileKey) {
      try {
        await this.r2.deleteObject(existing.xmlFileKey);
      } catch (err) {
        this.logger.warn(
          `Failed to delete XML file from R2 for invoice ${id}: ${(err as Error).message}`,
        );
      }
    }

    return { message: 'Xóa thành công' };
  }

  async cancel(id: string) {
    const existing = await this.repository.findOne({
      where: { id, isDeleted: false },
    });
    if (!existing) throw new NotFoundException(`Invoice ${id} không tìm thấy`);
    if (existing.status === 'CANCELLED') {
      throw new BadRequestException('Hóa đơn đã bị hủy');
    }
    if (existing.status === 'DRAFT') {
      throw new BadRequestException('Không thể hủy hóa đơn nháp, vui lòng xóa');
    }

    existing.status = 'CANCELLED';
    await this.repository.save(existing);
    return { message: 'Hủy thành công', data: { id } };
  }

  // ---------------------------------------------------------------------------
  // Bulk operations
  // ---------------------------------------------------------------------------

  /** Gán chi nhánh hàng loạt. Logic kiểm tra, ghi hai cột và tái phân bổ nằm ở InvoiceBranchService. */
  async bulkSetBranch(ids: string[], branchIds: string[]) {
    const result = await this.branchService.assign(ids, branchIds ?? []);
    const touched = [...result.updated, ...result.skipped];
    return { updated: touched.length, ids: touched };
  }

  async bulkSetNotes(ids: string[], notes: string) {
    if (!ids || !ids.length) return { updated: 0, ids: [] };

    const existingInvoices = await this.repository.find({
      where: { id: In(ids), isDeleted: false },
      select: ['id'],
    });
    const validIds = existingInvoices.map((inv) => inv.id);
    if (validIds.length === 0) return { updated: 0, ids: [] };

    await this.repository.update(
      { id: In(validIds) },
      { notes: notes || null },
    );

    return { updated: validIds.length, ids: validIds };
  }

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  async setInvoiceValid(
    id: string,
    isValid: boolean,
    userId: string,
  ): Promise<void> {
    const invoice = await this.repository.findOne({
      where: { id, isDeleted: false },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    if (isValid) {
      invoice.isValid = true;
      invoice.validatedAt = new Date();
      invoice.validatedBy = userId;
    } else {
      invoice.isValid = false;
      invoice.validatedAt = null;
      invoice.validatedBy = null;
    }

    await this.repository.save(invoice);

    // Sync to erp_entity_attribute_values
    try {
      const entityType =
        invoice.taxInvoiceType === 'OUT' ? 'INVOICE_OUT' : 'INVOICE_IN';
      const defs: { id: string }[] = await this.repository.manager.query(
        `SELECT id FROM "erp_module_attribute_defs"
         WHERE "module_key_global" = $1 AND "code" = 'is_valid' AND "is_deleted" = false
         LIMIT 1`,
        [entityType],
      );

      if (defs && defs.length > 0) {
        const attrDefId = defs[0].id;
        const valStr = isValid ? 'true' : 'false';

        const existing: { id: string }[] = await this.repository.manager.query(
          `SELECT id FROM "erp_entity_attribute_values"
           WHERE "entity_type" IN ($1, 'INVOICE') AND "entity_id" = $2 AND "attr_def_id" = $3
           LIMIT 1`,
          [entityType, id, attrDefId],
        );

        if (existing && existing.length > 0) {
          await this.repository.manager.query(
            `UPDATE "erp_entity_attribute_values"
             SET "value_text" = $1, "updated_at" = now()
             WHERE "id" = $2`,
            [valStr, existing[0].id],
          );
        } else {
          await this.repository.manager.query(
            `INSERT INTO "erp_entity_attribute_values" (
               "id", "entity_type", "entity_id", "attr_def_id", "value_text", "created_at", "updated_at"
             ) VALUES (
               gen_random_uuid(), $1, $2, $3, $4, now(), now()
             )`,
            [entityType, id, attrDefId, valStr],
          );
        }
      }
    } catch (e) {
      // Safe sync error catch to avoid blocking core response
    }
  }

  // ---------------------------------------------------------------------------
  // Accounting — post / unpost
  // ---------------------------------------------------------------------------

  async postInvoice(id: string, dto: PostInvoiceDto) {
    const invoice = await this.repository.findOne({ where: { id } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.isDeleted) throw new BadRequestException('Invoice is deleted');
    if (invoice.postingStatus === 'POSTED')
      throw new BadRequestException('Invoice is already posted');

    const totalDebit = dto.lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = dto.lines.reduce((sum, line) => sum + line.credit, 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new BadRequestException(
        'Hạch toán không cân bằng: Tổng Nợ phải bằng Tổng Có.',
      );
    }

    const entryNoPrefix = invoice.direction === 'IN' ? 'HĐM' : 'HĐB';
    const invoiceRef = invoice.serialNo
      ? `${invoice.invoiceNo}-${invoice.serialNo}`
      : invoice.invoiceNo;

    const defaultDesc = `Hạch toán hóa đơn ${invoice.invoiceNo}`;
    const userDesc = dto.description || invoice.description || defaultDesc;
    const description = `${invoiceRef}_${userDesc}`;

    const documentDate = dto.documentDate
      ? new Date(dto.documentDate)
      : new Date(invoice.invoiceDate);

    const journalEntry =
      await this.accountingCoreService.createJournalEntriesForBranches({
        branchIds: currentBranchIds(invoice),
        date: new Date(dto.postingDate),
        documentDate,
        reference: invoiceRef,
        description,
        subjectName:
          invoice.direction === 'IN'
            ? invoice.sellerName || undefined
            : invoice.buyerName || undefined,
        sourceType: 'INVOICE',
        sourceId: invoice.id,
        entryNoPrefix,
        lines: dto.lines.map((line) => {
          let lineDesc = line.description || description;
          if (line.description && !line.description.startsWith(invoiceRef)) {
            lineDesc = `${invoiceRef}_${line.description}`;
          }
          return {
            accountId: line.accountId,
            debit: line.debit,
            credit: line.credit,
            description: lineDesc,
          };
        }),
      });

    invoice.postingStatus = 'POSTED';
    invoice.postingDate = dto.postingDate;
    invoice.journalEntryId = journalEntry?.id ?? null;
    await this.repository.save(invoice);
    return invoice;
  }

  async unpostInvoice(id: string) {
    const invoice = await this.repository.findOne({ where: { id } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.postingStatus !== 'POSTED')
      throw new BadRequestException('Invoice is not posted');

    await this.accountingCoreService.deleteJournalEntryBySource(
      invoice.id,
      'INVOICE',
    );

    const netOffs = await this.repository.manager.find(
      ErpInvoiceVoucherNetOff,
      { where: { invoiceId: id } },
    );
    if (netOffs && netOffs.length > 0) {
      await this.repository.manager.delete(ErpInvoiceVoucherNetOff, {
        invoiceId: id,
      });
    }

    invoice.postingStatus = 'UNPOSTED';
    invoice.postingDate = null;
    invoice.journalEntryId = null;
    await this.repository.save(invoice);
    return invoice;
  }

  async autoPostStandard(id: string) {
    const invoice = await this.repository.findOne({ where: { id } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.isDeleted) throw new BadRequestException('Invoice is deleted');
    if (invoice.postingStatus === 'POSTED') {
      return invoice;
    }

    if (process.env.ENABLE_LIVE_AUTO_POSTING !== 'true') {
      this.logger.log(
        `Live auto-posting is currently disabled (ENABLE_LIVE_AUTO_POSTING !== 'true'). Skipping auto-post for invoice ${id}`,
      );
      return invoice;
    }

    if (currentBranchIds(invoice).length === 0) {
      // Try to recover branchId from linked voucher netoffs
      const netOffs = await this.repository.manager.find(
        ErpInvoiceVoucherNetOff,
        {
          where: { invoiceId: id },
          relations: ['bankTransaction'],
        },
      );
      // Chỉ suy từ sao kê có đúng một chi nhánh (đọc cả branch_ids, không chỉ branch_id)
      const validBranch = netOffs
        .map((n) =>
          n.bankTransaction && !n.bankTransaction.isDeleted
            ? readBranchIds(n.bankTransaction)
            : [],
        )
        .find((ids) => ids.length === 1)?.[0];

      // Chưa suy được chi nhánh thì vẫn ghi sổ với chi nhánh rỗng; gán sau sẽ tái phân bổ bút toán
      const systemBranches: { id: string }[] = validBranch
        ? []
        : await this.repository.manager.query(
            `SELECT id FROM erp_branches WHERE is_active = true LIMIT 2`,
          );
      const inferred =
        validBranch ??
        (systemBranches.length === 1 ? systemBranches[0].id : null);
      if (inferred) {
        invoice.branchId = inferred;
        invoice.branchIds = [inferred];
        await this.branchService.assign([id], [inferred], {
          onlyIfUnassigned: true,
        });
      }
    }

    const accounts: { id: string; account_code: string }[] =
      await this.repository.manager.query(
        `SELECT id, account_code FROM erp_chart_of_accounts WHERE is_deleted = false AND is_active = true ORDER BY length(account_code) ASC, account_code ASC`,
      );

    const findAccountId = (prefix: string): string | null => {
      const exact = accounts.find((a) => a.account_code === prefix);
      if (exact) return exact.id;
      const starts = accounts.find((a) => a.account_code.startsWith(prefix));
      return starts ? starts.id : null;
    };

    const total = Math.round((Number(invoice.totalAmount) || 0) * 100) / 100;

    if (total <= 0) {
      throw new BadRequestException(
        'Giá trị hóa đơn không hợp lệ để hạch toán (Tổng tiền <= 0).',
      );
    }

    const defaultDesc = `Hạch toán hóa đơn ${invoice.invoiceNo}`;
    const userDesc = invoice.description || defaultDesc;
    const lines: {
      accountId: string;
      debit: number;
      credit: number;
      description?: string;
    }[] = [];

    if (invoice.direction === 'IN') {
      // IN: Nợ T0003 (Chờ xử lý HĐ Mua) / Có 331 (Phải trả người bán)
      const t0003AccountId = findAccountId('T0003');
      const apAccountId = findAccountId('331');

      if (!t0003AccountId || !apAccountId) {
        throw new BadRequestException(
          'Không tìm thấy tài khoản kế toán phù hợp (T0003 hoặc 331) trong hệ thống.',
        );
      }

      lines.push({
        accountId: t0003AccountId,
        debit: total,
        credit: 0,
        description: userDesc,
      });
      lines.push({
        accountId: apAccountId,
        debit: 0,
        credit: total,
        description: userDesc,
      });
    } else {
      // OUT: Nợ 131 (Phải thu khách hàng) / Có T0002 (Chờ xử lý HĐ Bán)
      const arAccountId = findAccountId('131');
      const t0002AccountId = findAccountId('T0002');

      if (!arAccountId || !t0002AccountId) {
        throw new BadRequestException(
          'Không tìm thấy tài khoản kế toán phù hợp (131 hoặc T0002) trong hệ thống.',
        );
      }

      lines.push({
        accountId: arAccountId,
        debit: total,
        credit: 0,
        description: userDesc,
      });
      lines.push({
        accountId: t0002AccountId,
        debit: 0,
        credit: total,
        description: userDesc,
      });
    }

    const postingDate = invoice.invoiceDate
      ? new Date(invoice.invoiceDate).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    return this.postInvoice(id, {
      postingDate,
      description: userDesc,
      lines,
    });
  }

  // ---------------------------------------------------------------------------
  // Voucher net-off links
  // ---------------------------------------------------------------------------

  async linkVouchersToInvoice(
    invoiceId: string,
    payload: { bankTransactionId: string; netOffAmount?: number }[],
  ) {
    const invoice = await this.repository.findOne({
      where: { id: invoiceId, isDeleted: false },
    });
    if (!invoice)
      throw new NotFoundException(`Invoice ${invoiceId} không tìm thấy`);

    // Auto-set invoice branch from statement branch only when invoice has no branch.
    // If payload contains mixed branches (or invalid/missing branch data), skip auto-set.
    if (currentBranchIds(invoice).length === 0 && payload.length > 0) {
      const uniqueTxnIds = [
        ...new Set(payload.map((p) => p.bankTransactionId)),
      ];
      const linkedTransactions = await this.repository.manager.find(
        ErpBankTransaction,
        {
          where: { id: In(uniqueTxnIds), isDeleted: false },
          select: ['id', 'branchId', 'branchIds'],
        },
      );

      const hasAllTransactions =
        linkedTransactions.length === uniqueTxnIds.length;
      const statementBranches = linkedTransactions.map((t) => readBranchIds(t));
      const hasAllBranches = statementBranches.every((ids) => ids.length > 0);

      if (hasAllTransactions && hasAllBranches) {
        const uniqueBranches = [...new Set(statementBranches.flat())];
        const [onlyBranch] = uniqueBranches;
        if (uniqueBranches.length === 1 && onlyBranch) {
          invoice.branchId = onlyBranch;
          invoice.branchIds = [onlyBranch];
          // Qua InvoiceBranchService: ghi cả hai cột và tái phân bổ bút toán nếu đã ghi sổ
          await this.branchService.assign([invoiceId], [onlyBranch], {
            onlyIfUnassigned: true,
          });
        }
      }
    }

    for (const p of payload) {
      const existing = await this.repository.manager.findOne(
        ErpInvoiceVoucherNetOff,
        {
          where: { invoiceId, bankTransactionId: p.bankTransactionId },
        },
      );

      if (existing) {
        existing.netOffAmount = p.netOffAmount ?? 0;
        await this.repository.manager.save(ErpInvoiceVoucherNetOff, existing);
      } else {
        const newNetOff = this.repository.manager.create(
          ErpInvoiceVoucherNetOff,
          {
            invoiceId,
            bankTransactionId: p.bankTransactionId,
            netOffAmount: p.netOffAmount ?? 0,
          },
        );
        await this.repository.manager.save(ErpInvoiceVoucherNetOff, newNetOff);
      }

      // Refresh bank transaction journal entries
      try {
        await this.transactionAccountingService.refreshJournalEntriesForBankTransaction(
          p.bankTransactionId,
        );
      } catch (err: any) {
        this.logger.warn(
          `Failed to refresh journal entry for bank transaction ${p.bankTransactionId}: ${err?.message}`,
        );
      }
    }

    return { message: 'Đã liên kết phiếu thành công' };
  }

  async removeVoucherFromInvoice(invoiceId: string, voucherId: string) {
    await this.repository.manager.delete(ErpInvoiceVoucherNetOff, {
      invoiceId,
      bankTransactionId: voucherId,
    });

    try {
      await this.transactionAccountingService.refreshJournalEntriesForBankTransaction(
        voucherId,
      );
    } catch (err: any) {
      this.logger.warn(
        `Failed to refresh journal entry for removed voucher ${voucherId}: ${err?.message}`,
      );
    }

    return { message: 'Đã xóa liên kết phiếu thành công' };
  }
}
