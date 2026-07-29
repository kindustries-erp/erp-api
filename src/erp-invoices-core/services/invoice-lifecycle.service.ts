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
import { R2Service } from '../../r2/r2.service';
import { BankTransactionsCoreService } from '../../bank-transactions-core/bank-transactions-core.service';
import { AccountingCoreService } from '../../accounting-core/services/accounting-core.service';
import { ErpBankTransaction } from '../../bank-transactions-core/entities/erp_bank_transaction.entity';

@Injectable()
export class InvoiceLifecycleService {
  private readonly logger = new Logger(InvoiceLifecycleService.name);

  constructor(
    @InjectRepository(ErpInvoice)
    private readonly repository: Repository<ErpInvoice>,
    private readonly r2: R2Service,
    private readonly bankTransactionsCoreService: BankTransactionsCoreService,
    private readonly accountingCoreService: AccountingCoreService,
  ) {}

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  async findOne(id: string) {
    const data = await this.repository.findOne({
      where: { id, isDeleted: false },
      relations: ['items', 'voucherNetOffs', 'voucherNetOffs.bankTransaction'],
    });
    if (!data) throw new NotFoundException(`Invoice ${id} không tìm thấy`);
    return { message: 'Lấy thông tin thành công', data: toInvoiceDto(data) };
  }

  // ---------------------------------------------------------------------------
  // Create / Update / Delete
  // ---------------------------------------------------------------------------

  async create(dto: CreateErpInvoiceDto) {
    const invoice = this.repository.create({
      ...dto,
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
