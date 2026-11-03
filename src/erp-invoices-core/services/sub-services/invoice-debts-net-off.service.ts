import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { ErpInvoiceVoucherNetOff } from '../../entities/erp_invoice_voucher_netoff.entity';
import { InvoiceBranchService } from '../invoice-branch.service';
import { TransactionAccountingService } from '../../../bank-transactions-core/services/transaction-accounting.service';
import { readBranchIds } from '../../../common/utils/branch-ids.util';
import { KHONG_MST } from '../../../common/utils/invoice-partner-key.util';
import {
  DebtNetOffAllocateDto,
  DebtNetOffAllocationDto,
} from '../../dto/debt-net-off.dto';
import { InvoicePartnerType } from '../../dto/get-invoice-debts.dto';

interface LockedTransactionRow {
  id: string;
  debitAmount: string;
  creditAmount: string;
  netOffAmount: string;
  branchId: string | null;
  branchIds: string[] | null;
}

interface LockedInvoiceRow {
  id: string;
  direction: 'IN' | 'OUT';
  sellerTaxCode: string | null;
  buyerTaxCode: string | null;
  buyerCccd: string | null;
  totalAmount: string;
  taxInvoiceStatus: number | null;
  netOffAmount: string;
  adjustmentOffset: string;
}

const toCents = (value: number | string): number =>
  Math.round(Number(value) * 100);

/**
 * Cấn trừ một khoản sao kê/quỹ đã gắn đối tác vào nhiều hóa đơn còn mở của đối tác.
 * Khóa giao dịch trước, sau đó khóa hóa đơn theo id tăng dần để tránh deadlock.
 * Số liệu kiểm tra trên cent để tránh sai số số thực.
 */
@Injectable()
export class InvoiceDebtsNetOffService {
  private readonly logger = new Logger(InvoiceDebtsNetOffService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly branchService: InvoiceBranchService,
    private readonly transactionAccountingService: TransactionAccountingService,
  ) {}

  async allocate(taxCode: string, dto: DebtNetOffAllocateDto) {
    const partnerTaxCode = (taxCode ?? '').trim();
    if (!partnerTaxCode || partnerTaxCode === KHONG_MST) {
      throw new BadRequestException(
        'Đối tác không có MST nên không thể cấn trừ theo công nợ',
      );
    }
    this.assertNoDuplicateInvoices(dto.allocations);

    const allocations = dto.allocations.map((item) => ({
      invoiceId: item.invoiceId,
      amountCents: toCents(item.amount),
    }));
    if (allocations.some((item) => item.amountCents <= 0)) {
      throw new BadRequestException('Số tiền phân bổ phải lớn hơn 0');
    }

    const { txnBranchIds, invoiceIds } = await this.dataSource.transaction(
      async (manager) => {
        const txn = await this.lockTransaction(
          manager,
          dto.bankTransactionId,
          partnerTaxCode,
          dto.partnerType,
        );
        const unallocatedCents =
          toCents(this.transactionAmount(txn, dto.partnerType)) -
          toCents(txn.netOffAmount);
        const requestedCents = allocations.reduce(
          (sum, item) => sum + item.amountCents,
          0,
        );
        if (requestedCents > unallocatedCents) {
          throw new BadRequestException(
            'Tổng phân bổ vượt số chưa phân bổ của giao dịch',
          );
        }

        const invoices = await this.lockInvoices(
          manager,
          allocations.map((item) => item.invoiceId),
        );
        this.assertInvoicesAllocatable(
          invoices,
          allocations,
          partnerTaxCode,
          dto.partnerType,
        );

        for (const item of allocations) {
          await this.upsertNetOff(
            manager,
            item.invoiceId,
            dto.bankTransactionId,
            item.amountCents,
          );
        }

        return {
          txnBranchIds: readBranchIds(txn),
          invoiceIds: allocations.map((item) => item.invoiceId),
        };
      },
    );

    await this.afterCommit(dto.bankTransactionId, txnBranchIds, invoiceIds);

    return {
      bankTransactionId: dto.bankTransactionId,
      allocations: allocations.map((item) => ({
        invoiceId: item.invoiceId,
        amount: item.amountCents / 100,
      })),
      message: 'Đã cấn trừ công nợ thành công',
    };
  }

  private assertNoDuplicateInvoices(allocations: DebtNetOffAllocationDto[]) {
    const seen = new Set<string>();
    for (const item of allocations) {
      if (seen.has(item.invoiceId)) {
        throw new BadRequestException(
          `Hóa đơn ${item.invoiceId} bị trùng trong danh sách phân bổ`,
        );
      }
      seen.add(item.invoiceId);
    }
  }

  private transactionAmount(
    txn: LockedTransactionRow,
    partnerType: InvoicePartnerType,
  ): number {
    return partnerType === InvoicePartnerType.SUPPLIER
      ? Number(txn.debitAmount)
      : Number(txn.creditAmount);
  }

  private async lockTransaction(
    manager: EntityManager,
    bankTransactionId: string,
    partnerTaxCode: string,
    partnerType: InvoicePartnerType,
  ): Promise<LockedTransactionRow> {
    const rows: LockedTransactionRow[] = await manager.query(
      `
      SELECT t.id,
             t.debit_amount::text AS "debitAmount",
             t.credit_amount::text AS "creditAmount",
             (SELECT COALESCE(SUM(n.net_off_amount), 0)::text
                FROM erp_invoice_voucher_netoff n
               WHERE n.bank_transaction_id = t.id) AS "netOffAmount",
             t.branch_id AS "branchId",
             t.branch_ids AS "branchIds"
      FROM erp_bank_transactions t
      JOIN erp_business_partners p ON p.id = t.partner_id AND p.is_deleted = false
      WHERE t.id = $1
        AND t.is_deleted = false
        AND p.tax_code = $2
      FOR UPDATE OF t
      `,
      [bankTransactionId, partnerTaxCode],
    );
    const txn = rows[0];
    if (!txn) {
      throw new NotFoundException(
        'Giao dịch không tồn tại hoặc không thuộc đối tác này',
      );
    }

    const isSupplier = partnerType === InvoicePartnerType.SUPPLIER;
    const hasExpectedFlow = isSupplier
      ? Number(txn.debitAmount) > 0
      : Number(txn.creditAmount) > 0;
    if (!hasExpectedFlow) {
      throw new BadRequestException(
        isSupplier
          ? 'Nhà cung cấp chỉ cấn trừ với giao dịch chi'
          : 'Khách hàng chỉ cấn trừ với giao dịch thu',
      );
    }
    return txn;
  }

  private async lockInvoices(
    manager: EntityManager,
    invoiceIds: string[],
  ): Promise<LockedInvoiceRow[]> {
    return manager.query(
      `
      SELECT inv.id,
             inv.direction,
             inv.seller_tax_code AS "sellerTaxCode",
             inv.buyer_tax_code AS "buyerTaxCode",
             inv.buyer_cccd AS "buyerCccd",
             inv.total_amount::text AS "totalAmount",
             inv.tax_invoice_status AS "taxInvoiceStatus",
             COALESCE(n.net_off, 0)::text AS "netOffAmount",
             COALESCE(a.offset_amount, 0)::text AS "adjustmentOffset"
      FROM erp_invoices inv
      LEFT JOIN (
        SELECT invoice_id, SUM(net_off_amount) AS net_off
        FROM erp_invoice_voucher_netoff
        GROUP BY invoice_id
      ) n ON n.invoice_id = inv.id
      LEFT JOIN (
        SELECT original_invoice_id, SUM(offset_amount) AS offset_amount
        FROM erp_invoice_adjustment_netoff
        GROUP BY original_invoice_id
      ) a ON a.original_invoice_id = inv.id
      WHERE inv.id = ANY($1::uuid[])
        AND inv.is_deleted = false
        AND (inv.tax_invoice_status IS NULL OR inv.tax_invoice_status != 4)
      ORDER BY inv.id
      FOR UPDATE OF inv
      `,
      [invoiceIds],
    );
  }

  /**
   * Kiểm tra từng hóa đơn: thuộc đối tác, đúng chiều, không phải hóa đơn điều chỉnh/âm,
   * và số phân bổ không vượt số dư còn lại (cùng công thức với công nợ chi tiết).
   */
  private assertInvoicesAllocatable(
    invoices: LockedInvoiceRow[],
    allocations: { invoiceId: string; amountCents: number }[],
    partnerTaxCode: string,
    partnerType: InvoicePartnerType,
  ) {
    const expectedDirection =
      partnerType === InvoicePartnerType.SUPPLIER ? 'IN' : 'OUT';
    const byId = new Map(invoices.map((inv) => [inv.id, inv]));

    for (const item of allocations) {
      const inv = byId.get(item.invoiceId);
      if (!inv) {
        throw new NotFoundException(
          `Hóa đơn ${item.invoiceId} không tồn tại hoặc đã bị thay thế`,
        );
      }
      if (inv.direction !== expectedDirection) {
        throw new BadRequestException(
          `Hóa đơn ${item.invoiceId} không cùng chiều với đối tác`,
        );
      }
      const belongsToPartner =
        expectedDirection === 'IN'
          ? (inv.sellerTaxCode ?? '').trim() === partnerTaxCode
          : (inv.buyerTaxCode ?? '').trim() === partnerTaxCode ||
            (inv.buyerCccd ?? '').trim() === partnerTaxCode;
      if (!belongsToPartner) {
        throw new BadRequestException(
          `Hóa đơn ${item.invoiceId} không thuộc đối tác này`,
        );
      }
      const totalCents = toCents(inv.totalAmount);
      if (inv.taxInvoiceStatus === 3 || totalCents < 0) {
        throw new BadRequestException(
          `Hóa đơn ${item.invoiceId} là hóa đơn điều chỉnh/âm, không cấn trừ theo công nợ`,
        );
      }
      const remainingCents = Math.max(
        0,
        totalCents - toCents(inv.netOffAmount) - toCents(inv.adjustmentOffset),
      );
      if (item.amountCents > remainingCents) {
        throw new BadRequestException(
          `Số phân bổ vượt số dư còn lại của hóa đơn ${item.invoiceId}`,
        );
      }
    }
  }

  private async upsertNetOff(
    manager: EntityManager,
    invoiceId: string,
    bankTransactionId: string,
    amountCents: number,
  ) {
    const existing = await manager.findOne(ErpInvoiceVoucherNetOff, {
      where: { invoiceId, bankTransactionId },
    });
    if (existing) {
      existing.netOffAmount =
        (toCents(existing.netOffAmount) + amountCents) / 100;
      await manager.save(ErpInvoiceVoucherNetOff, existing);
      return;
    }
    const created = manager.create(ErpInvoiceVoucherNetOff, {
      invoiceId,
      bankTransactionId,
      netOffAmount: amountCents / 100,
    });
    await manager.save(ErpInvoiceVoucherNetOff, created);
  }

  /** Các bước phụ sau khi đã commit: gán chi nhánh cho hóa đơn và làm mới bút toán sao kê. */
  private async afterCommit(
    bankTransactionId: string,
    txnBranchIds: string[],
    invoiceIds: string[],
  ) {
    if (txnBranchIds.length === 1) {
      await this.branchService.assign(invoiceIds, txnBranchIds, {
        onlyIfUnassigned: true,
      });
    }
    try {
      await this.transactionAccountingService.refreshJournalEntriesForBankTransaction(
        bankTransactionId,
      );
    } catch (err: any) {
      this.logger.warn(
        `Failed to refresh journal entry for bank transaction ${bankTransactionId}: ${err?.message}`,
      );
    }
  }
}
