import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { ErpInvoice } from '../entities/erp_invoice.entity';
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
  ) {}

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  async findOne(id: string) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      );

    const relations = [
      'items',
      'voucherNetOffs',
      'voucherNetOffs.bankTransaction',
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
      data = await this.repository.findOne({
        where: { invoiceNo: id, isDeleted: false },
        relations,
      });
    }

    if (!data) {
      data = await this.repository.findOne({
        where: { serialNo: id, isDeleted: false },
        relations,
      });
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
      where: { entityType: 'INVOICE', entityId: data.id },
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

    const invoice = this.repository.create({
      ...createPayload,
      preVatAmount: String(dto.preVatAmount ?? 0),
      vatRate: dto.vatRate != null ? String(dto.vatRate) : null,
      vatAmount: String(dto.vatAmount ?? 0),
      discountAmount: String(dto.discountAmount ?? 0),
      totalAmount: String(dto.totalAmount ?? 0),
      items: dto.items?.map((i) => ({
        description: i.description,
        unit: i.unit,
        quantity: i.quantity != null ? String(i.quantity) : null,
        unitPrice: i.unitPrice != null ? String(i.unitPrice) : null,
        preVatAmount: String(i.preVatAmount ?? 0),
        vatRate: i.vatRate != null ? String(i.vatRate) : null,
        vatAmount: String(i.vatAmount ?? 0),
        discountAmount: String(i.discountAmount ?? 0),
        totalAmount: String(i.totalAmount ?? 0),
      })),
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
    if (dto.preVatAmount != null)
      updatePayload.preVatAmount = String(dto.preVatAmount);
    if (dto.vatRate != null) updatePayload.vatRate = String(dto.vatRate);
    if (dto.vatAmount != null) updatePayload.vatAmount = String(dto.vatAmount);
    if (dto.discountAmount != null)
      updatePayload.discountAmount = String(dto.discountAmount);
    if (dto.totalAmount != null)
      updatePayload.totalAmount = String(dto.totalAmount);

    const oldBranchId = existing.branchId;
    const wasPosted = existing.postingStatus === 'POSTED';

    this.repository.merge(existing, updatePayload);

    if (dto.items) {
      await this.repository.manager.delete(ErpInvoiceItem, { invoiceId: id });
      const newItems = dto.items.map((i) =>
        this.repository.manager.create(ErpInvoiceItem, {
          invoiceId: id,
          description: i.description,
          unit: i.unit,
          quantity: i.quantity != null ? String(i.quantity) : null,
          unitPrice: i.unitPrice != null ? String(i.unitPrice) : null,
          preVatAmount: String(i.preVatAmount ?? 0),
          vatRate: i.vatRate != null ? String(i.vatRate) : null,
          vatAmount: String(i.vatAmount ?? 0),
          discountAmount: String(i.discountAmount ?? 0),
          totalAmount: String(i.totalAmount ?? 0),
        }),
      );
      await this.repository.manager.save(ErpInvoiceItem, newItems);
      delete (existing as any).items;
    }

    extractInvoiceMetadata(existing);
    await this.repository.save(existing);

    if (
      wasPosted &&
      dto.branchId !== undefined &&
      dto.branchId !== oldBranchId &&
      dto.branchId
    ) {
      this.accountingCoreService
        .updateJournalEntryBranch(id, 'INVOICE', dto.branchId)
        .catch((e) =>
          this.logger.warn(`UC2 branch sync failed for ${id}: ${e.message}`),
        );
    }

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

  async bulkSetBranch(ids: string[], branchId: string | null) {
    if (!ids || !ids.length) return { updated: 0, ids: [] };

    const existingInvoices = await this.repository.find({
      where: { id: In(ids), isDeleted: false },
      select: ['id'],
    });
    const validIds = existingInvoices.map((inv) => inv.id);
    if (validIds.length === 0) return { updated: 0, ids: [] };

    await this.repository.update({ id: In(validIds) }, { branchId });

    const postedInvoices = await this.repository.find({
      where: { id: In(validIds), postingStatus: 'POSTED', isDeleted: false },
      select: ['id'],
    });

    if (postedInvoices.length > 0 && branchId) {
      Promise.all(
        postedInvoices.map((inv) =>
          this.accountingCoreService
            .updateJournalEntryBranch(inv.id, 'INVOICE', branchId)
            .catch((e) =>
              this.logger.warn(
                `UC2 bulk branch sync failed for ${inv.id}: ${e.message}`,
              ),
            ),
        ),
      ).catch(() => {});
    }

    return { updated: validIds.length, ids: validIds };
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

    if (!invoice.branchId) {
      throw new BadRequestException(
        'Hóa đơn chưa có chi nhánh. Vui lòng gán chi nhánh trước khi hạch toán.',
      );
    }

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

    const journalEntry = await this.accountingCoreService.createJournalEntry({
      branchId: invoice.branchId,
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
    invoice.journalEntryId = journalEntry.id;
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

    if (!invoice.branchId) {
      // Try to recover branchId from linked voucher netoffs
      const netOffs = await this.repository.manager.find(
        ErpInvoiceVoucherNetOff,
        {
          where: { invoiceId: id },
          relations: ['bankTransaction'],
        },
      );
      const validBranch = netOffs.find(
        (n) =>
          n.bankTransaction &&
          !n.bankTransaction.isDeleted &&
          n.bankTransaction.branchId,
      )?.bankTransaction?.branchId;

      if (validBranch) {
        invoice.branchId = validBranch;
        await this.repository.save(invoice);
      } else {
        const branches: { id: string }[] = await this.repository.manager.query(
          `SELECT id FROM erp_branches WHERE is_deleted = false LIMIT 2`,
        );
        if (branches.length === 1) {
          invoice.branchId = branches[0].id;
          await this.repository.save(invoice);
        } else {
          throw new BadRequestException(
            'Hóa đơn chưa có chi nhánh. Vui lòng gán chi nhánh trước khi hạch toán.',
          );
        }
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

    const preVat = Math.round((Number(invoice.preVatAmount) || 0) * 100) / 100;
    const vat = Math.round((Number(invoice.vatAmount) || 0) * 100) / 100;
    const total = Math.round((Number(invoice.totalAmount) || 0) * 100) / 100;

    if (total <= 0 && preVat <= 0) {
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
      const debitCode = resolvePurchaseDebitAccountCode(invoice.sellerTaxCode);
      const debitAccountId =
        findAccountId(debitCode) ||
        findAccountId('642') ||
        findAccountId('632');
      const vatAccountId = findAccountId('133') || findAccountId('1331');
      const apAccountId = findAccountId('331');

      if (!debitAccountId || !apAccountId) {
        throw new BadRequestException(
          'Không tìm thấy tài khoản kế toán phù hợp (632/642 hoặc 331) trong hệ thống.',
        );
      }

      if (preVat > 0) {
        lines.push({
          accountId: debitAccountId,
          debit: preVat,
          credit: 0,
          description: userDesc,
        });
      }
      if (vat > 0) {
        if (!vatAccountId) {
          throw new BadRequestException(
            'Không tìm thấy tài khoản thuế GTGT (133) trong hệ thống.',
          );
        }
        lines.push({
          accountId: vatAccountId,
          debit: vat,
          credit: 0,
          description: `Thuế GTGT ${invoice.invoiceNo}`,
        });
      }
      if (total > 0) {
        lines.push({
          accountId: apAccountId,
          debit: 0,
          credit: total,
          description: userDesc,
        });
      }
    } else {
      // OUT: Nợ 131 / Có 511 / Có 3331
      const arAccountId = findAccountId('131');
      const revenueAccountId = findAccountId('511') || findAccountId('711');
      const vatOutAccountId = findAccountId('3331') || findAccountId('333');

      if (!arAccountId || !revenueAccountId) {
        throw new BadRequestException(
          'Không tìm thấy tài khoản kế toán phù hợp (131 hoặc 511) trong hệ thống.',
        );
      }

      if (total > 0) {
        lines.push({
          accountId: arAccountId,
          debit: total,
          credit: 0,
          description: userDesc,
        });
      }
      if (preVat > 0) {
        lines.push({
          accountId: revenueAccountId,
          debit: 0,
          credit: preVat,
          description: userDesc,
        });
      }
      if (vat > 0) {
        if (!vatOutAccountId) {
          throw new BadRequestException(
            'Không tìm thấy tài khoản thuế GTGT đầu ra (3331) trong hệ thống.',
          );
        }
        lines.push({
          accountId: vatOutAccountId,
          debit: 0,
          credit: vat,
          description: `Thuế GTGT ${invoice.invoiceNo}`,
        });
      }
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
    if (!invoice.branchId && payload.length > 0) {
      const uniqueTxnIds = [
        ...new Set(payload.map((p) => p.bankTransactionId)),
      ];
      const linkedTransactions = await this.repository.manager.find(
        ErpBankTransaction,
        {
          where: { id: In(uniqueTxnIds), isDeleted: false },
          select: ['id', 'branchId'],
        },
      );

      const hasAllTransactions =
        linkedTransactions.length === uniqueTxnIds.length;
      const hasAllBranches = linkedTransactions.every((t) => !!t.branchId);

      if (hasAllTransactions && hasAllBranches) {
        const uniqueBranches = [
          ...new Set(linkedTransactions.map((t) => t.branchId)),
        ];
        if (uniqueBranches.length === 1) {
          invoice.branchId = uniqueBranches[0];
          await this.repository.save(invoice);
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
    }

    return { message: 'Đã liên kết phiếu thành công' };
  }

  async removeVoucherFromInvoice(invoiceId: string, voucherId: string) {
    await this.repository.manager.delete(ErpInvoiceVoucherNetOff, {
      invoiceId,
      bankTransactionId: voucherId,
    });
    return { message: 'Đã xóa liên kết phiếu thành công' };
  }
}
