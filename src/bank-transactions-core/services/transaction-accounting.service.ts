import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ErpBankTransaction } from '../entities/erp_bank_transaction.entity';
import { PostBankTransactionDto } from '../dto/post-bank-transaction.dto';
import { AccountingCoreService } from '../../accounting-core/services/accounting-core.service';
import { UpdateBankTransactionDto } from '../dto/update-bank-transaction.dto';
import { CreateBankTransactionDto } from '../dto/create-bank-transaction.dto';

@Injectable()
export class TransactionAccountingService {
  constructor(
    @InjectRepository(ErpBankTransaction)
    private readonly transactionRepo: Repository<ErpBankTransaction>,
    private readonly dataSource: DataSource,
    private readonly accountingCoreService: AccountingCoreService,
  ) {}

  async createManualTransaction(dto: CreateBankTransactionDto) {
    if (!dto.bankAccountId && !dto.cashBookId) {
      throw new BadRequestException(
        'Must provide either bankAccountId or cashBookId',
      );
    }
    const txn = this.transactionRepo.create(dto);
    return this.transactionRepo.save(txn);
  }

  async getTransactionPosting(id: string) {
    const txn = await this.transactionRepo.findOne({
      where: { id, isDeleted: false },
    });
    if (!txn) {
      throw new NotFoundException(`Transaction ${id} not found`);
    }

    const entries = await this.accountingCoreService.getJournalEntriesBySource(
      txn.id,
      txn.sourceType,
    );

    if (entries.length === 0) {
      return {
        postingStatus: 'UNPOSTED',
        journalEntryId: null,
        postingDate: null,
        description: txn.accountingDescription || txn.description || null,
        lines: [],
        totalDebit: 0,
        totalCredit: 0,
        isBalanced: true,
      };
    }

    const latest = entries[0];
    const lineMap = new Map<
      string,
      {
        id: string;
        accountId: string;
        debit: number;
        credit: number;
        description: string;
      }
    >();

    for (const entry of entries) {
      for (const line of entry.lines || []) {
        const accountId = line.accountId;
        const key = accountId || line.id;
        if (!lineMap.has(key)) {
          lineMap.set(key, {
            id: line.id,
            accountId,
            debit: 0,
            credit: 0,
            description: line.description || entry.description || '',
          });
        }
        const item = lineMap.get(key)!;
        item.debit += Number(line.debit) || 0;
        item.credit += Number(line.credit) || 0;
      }
    }

    const lines = Array.from(lineMap.values());
    const totalDebit = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
    const totalCredit = lines.reduce((sum, l) => sum + (l.credit || 0), 0);

    return {
      postingStatus: 'POSTED',
      journalEntryId: entries.length === 1 ? latest.id : null,
      postingDate: latest.date ? latest.date.toISOString().slice(0, 10) : null,
      description: latest.description || txn.accountingDescription || null,
      lines,
      totalDebit,
      totalCredit,
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
    };
  }

  async postTransaction(id: string, dto: PostBankTransactionDto) {
    const txn = await this.transactionRepo.findOne({
      where: { id, isDeleted: false },
      relations: ['bankAccount', 'cashBook'],
    });
    if (!txn) {
      throw new NotFoundException(`Transaction ${id} not found`);
    }

    if (!txn.branchId) {
      throw new BadRequestException(
        'Giao dịch chưa có chi nhánh. Vui lòng gán chi nhánh trước khi hạch toán.',
      );
    }

    if (!dto.lines || dto.lines.length === 0) {
      throw new BadRequestException('Vui lòng nhập ít nhất 1 dòng hạch toán.');
    }

    const cleanedLines = dto.lines.map((line) => ({
      accountId: line.accountId,
      debit: Number(line.debit || 0),
      credit: Number(line.credit || 0),
      description: (line.description || '').trim(),
    }));

    for (const line of cleanedLines) {
      if (!line.accountId) {
        throw new BadRequestException('Thiếu tài khoản hạch toán.');
      }
      if (line.debit < 0 || line.credit < 0) {
        throw new BadRequestException('Giá trị Nợ/Có không hợp lệ.');
      }
      if (line.debit > 0 && line.credit > 0) {
        throw new BadRequestException(
          'Một dòng hạch toán không thể đồng thời có cả Nợ và Có.',
        );
      }
      if (line.debit <= 0 && line.credit <= 0) {
        throw new BadRequestException(
          'Mỗi dòng hạch toán phải có ít nhất một giá trị Nợ hoặc Có lớn hơn 0.',
        );
      }
    }

    const totalDebit = cleanedLines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = cleanedLines.reduce(
      (sum, line) => sum + line.credit,
      0,
    );

    if (Math.abs(totalDebit - totalCredit) >= 0.01) {
      throw new BadRequestException(
        'Hạch toán không cân bằng: Tổng Nợ phải bằng Tổng Có.',
      );
    }

    const uniqueAccountIds = Array.from(
      new Set(cleanedLines.map((line) => line.accountId).filter(Boolean)),
    );
    const accountRows = await this.dataSource.query(
      `SELECT id FROM erp_chart_of_accounts WHERE id = ANY($1::uuid[]) AND is_deleted = false`,
      [uniqueAccountIds],
    );
    if (accountRows.length !== uniqueAccountIds.length) {
      throw new BadRequestException(
        'Có tài khoản không tồn tại hoặc đã bị xóa. Vui lòng kiểm tra lại.',
      );
    }

    await this.accountingCoreService.deleteJournalEntryBySource(
      txn.id,
      txn.sourceType,
    );

    const postingDate = dto.postingDate
      ? new Date(dto.postingDate)
      : txn.transDate;
    const description =
      dto.description?.trim() ||
      txn.accountingDescription ||
      txn.description ||
      txn.referenceNumber ||
      '';

    await this.accountingCoreService.createJournalEntry({
      branchId: txn.branchId,
      date: postingDate,
      documentDate: txn.transDate,
      description,
      subjectName: txn.correspondentName || undefined,
      sourceType: txn.sourceType,
      sourceId: txn.id,
      reference: txn.referenceNumber,
      isReceipt: Number(txn.creditAmount || 0) > 0,
      lines: cleanedLines,
    });

    if (dto.description !== undefined) {
      txn.accountingDescription = dto.description?.trim() || null;
      await this.transactionRepo.save(txn);
    }

    return this.getTransactionPosting(id);
  }

  async unpostTransaction(id: string) {
    const txn = await this.transactionRepo.findOne({
      where: { id, isDeleted: false },
    });
    if (!txn) {
      throw new NotFoundException(`Transaction ${id} not found`);
    }

    await this.accountingCoreService.deleteJournalEntryBySource(
      txn.id,
      txn.sourceType,
    );

    return this.getTransactionPosting(id);
  }

  async updateTransaction(id: string, dto: UpdateBankTransactionDto) {
    const txn = await this.transactionRepo.findOne({
      where: { id, isDeleted: false },
      relations: ['bankAccount', 'cashBook'],
    });
    if (!txn) {
      throw new NotFoundException(`Transaction ${id} not found`);
    }
    Object.assign(txn, dto);
    const saved = await this.transactionRepo.save(txn);

    await this.refreshJournalEntriesForBankTransaction(saved.id);

    return saved;
  }

  async refreshJournalEntriesForBankTransaction(txnId: string): Promise<void> {
    const txn = await this.transactionRepo.findOne({
      where: { id: txnId, isDeleted: false },
      relations: ['bankAccount', 'cashBook'],
    });
    if (!txn) return;

    const [apAccountRes, arAccountRes] = await Promise.all([
      this.dataSource.query(
        `SELECT id FROM erp_chart_of_accounts WHERE account_code = $1 AND is_deleted = false LIMIT 1`,
        ['331'],
      ),
      this.dataSource.query(
        `SELECT id FROM erp_chart_of_accounts WHERE account_code = $1 AND is_deleted = false LIMIT 1`,
        ['131'],
      ),
    ]);
    const apAccountId = apAccountRes.length > 0 ? apAccountRes[0].id : null;
    const arAccountId = arAccountRes.length > 0 ? arAccountRes[0].id : null;

    let defaultAccountId: string | null = null;
    if (txn.sourceType === 'BANK') {
      defaultAccountId = txn.bankAccount?.accountingAccountId || null;
      if (!defaultAccountId) {
        const res = await this.dataSource.query(
          `SELECT id FROM erp_chart_of_accounts WHERE account_code = $1 AND is_deleted = false LIMIT 1`,
          ['1121'],
        );
        if (res && res.length > 0) defaultAccountId = res[0].id;
      }
    } else if (txn.sourceType === 'CASH') {
      defaultAccountId = txn.cashBook?.accountingAccountId || null;
      if (!defaultAccountId) {
        const res = await this.dataSource.query(
          `SELECT id FROM erp_chart_of_accounts WHERE account_code = $1 AND is_deleted = false LIMIT 1`,
          ['1111'],
        );
        if (res && res.length > 0) defaultAccountId = res[0].id;
      }
    }
    if (!defaultAccountId) return;

    const netOffRows: any[] = await this.dataSource.query(
      `SELECT n.id, n.net_off_amount, i.direction, i.seller_name, i.buyer_name, i.invoice_no, i.serial_no, i.branch_id, i.description as invoice_desc
       FROM erp_invoice_voucher_netoff n
       JOIN erp_invoices i ON i.id = n.invoice_id AND i.is_deleted = false
       WHERE n.bank_transaction_id = $1
       ORDER BY n.created_at ASC`,
      [txnId],
    );

    const totalAmount =
      Number(txn.creditAmount) > 0
        ? Number(txn.creditAmount)
        : Number(txn.debitAmount);
    const isReceipt = Number(txn.creditAmount) > 0;
    const baseDescription = txn.accountingDescription || txn.description || '';

    type Group = {
      subject: string | null;
      amount: number;
      counterpartAccountId: string | null;
      branchId: string;
      description: string;
    };
    const groups: Group[] = [];

    if (netOffRows.length === 0) {
      groups.push({
        subject: txn.correspondentName || null,
        amount: totalAmount,
        counterpartAccountId: txn.correspondentAccountingAccountId,
        branchId: txn.branchId,
        description: baseDescription,
      });
    } else {
      const groupMap = new Map<string, Group>();

      for (const row of netOffRows) {
        const subject: string | null =
          row.direction === 'IN'
            ? row.seller_name || null
            : row.buyer_name || null;

        let counterpartAccountId = txn.correspondentAccountingAccountId;
        if (row.direction === 'IN' && apAccountId)
          counterpartAccountId = apAccountId;
        if (row.direction === 'OUT' && arAccountId)
          counterpartAccountId = arAccountId;

        const branchId = txn.branchId;

        const key = `${subject || ''}_${counterpartAccountId}_${branchId}`;
        if (!groupMap.has(key)) {
          const invoiceRef = row.serial_no
            ? `${row.invoice_no}-${row.serial_no}`
            : row.invoice_no;
          const desc = row.invoice_desc
            ? `${invoiceRef}_${baseDescription} - ${row.invoice_desc}`
            : `${invoiceRef}_${baseDescription}`;
          groupMap.set(key, {
            subject: subject || null,
            amount: 0,
            counterpartAccountId,
            branchId,
            description: desc,
          });
        }
        groupMap.get(key)!.amount += Number(row.net_off_amount);
      }

      const netOffTotal = netOffRows.reduce(
        (sum: number, r: any) => sum + Number(r.net_off_amount),
        0,
      );

      for (const group of groupMap.values()) {
        groups.push(group);
      }

      const remaining = Math.round((totalAmount - netOffTotal) * 100) / 100;
      if (remaining > 0.01) {
        groups.push({
          subject: txn.correspondentName || null,
          amount: remaining,
          counterpartAccountId: txn.correspondentAccountingAccountId,
          branchId: txn.branchId,
          description: baseDescription,
        });
      }
    }

    const existingEntries = await this.dataSource.query(
      `SELECT date FROM erp_journal_entries WHERE source_id = $1 AND source_type = $2 AND is_deleted = false LIMIT 1`,
      [txn.id, txn.sourceType],
    );
    const postingDate =
      existingEntries.length > 0 ? existingEntries[0].date : new Date();

    await this.accountingCoreService.deleteJournalEntryBySource(
      txn.id,
      txn.sourceType,
    );

    const baseEntryNo = await this.accountingCoreService.generateEntryNo(
      txn.sourceType === 'BANK' ? 'BANK' : 'CASH',
      txn.transDate,
      txn.branchId,
      isReceipt,
    );

    const validGroups = groups.filter((g) => g.counterpartAccountId);
    for (let i = 0; i < validGroups.length; i++) {
      const group = validGroups[i];
      const entryNo =
        validGroups.length === 1
          ? baseEntryNo
          : `${baseEntryNo}${String.fromCharCode(97 + i)}`;

      const counterpartAccountId = group.counterpartAccountId as string;
      const debitAccount = isReceipt ? defaultAccountId : counterpartAccountId;
      const creditAccount = isReceipt ? counterpartAccountId : defaultAccountId;

      await this.accountingCoreService.createJournalEntry({
        entryNo,
        branchId: group.branchId,
        date: postingDate,
        documentDate: txn.transDate,
        description: group.description,
        subjectName: group.subject || undefined,
        sourceType: txn.sourceType,
        sourceId: txn.id,
        reference: txn.referenceNumber,
        isReceipt,
        lines: [
          {
            accountId: debitAccount,
            debit: group.amount,
            credit: 0,
            description: group.description,
          },
          {
            accountId: creditAccount,
            debit: 0,
            credit: group.amount,
            description: group.description,
          },
        ],
      });
    }
  }

  async linkInvoiceToTransaction(
    txnId: string,
    payload: { invoiceId: string; netOffAmount?: number },
  ) {
    const txn = await this.transactionRepo.findOne({
      where: { id: txnId, isDeleted: false },
    });
    if (!txn) {
      throw new NotFoundException(`Transaction ${txnId} not found`);
    }

    const invoice = await this.dataSource.query(
      `SELECT id, branch_id, direction, buyer_name, seller_name, invoice_no FROM erp_invoices WHERE id = $1 AND is_deleted = false LIMIT 1`,
      [payload.invoiceId],
    );
    if (!invoice || invoice.length === 0) {
      throw new NotFoundException(`Invoice ${payload.invoiceId} not found`);
    }
    const invRow = invoice[0];

    const existing = await this.dataSource.query(
      `SELECT id FROM erp_invoice_voucher_netoff WHERE invoice_id = $1 AND bank_transaction_id = $2 LIMIT 1`,
      [payload.invoiceId, txnId],
    );

    const netOffAmount =
      payload.netOffAmount ?? Number(txn.creditAmount || txn.debitAmount || 0);

    if (existing && existing.length > 0) {
      await this.dataSource.query(
        `UPDATE erp_invoice_voucher_netoff SET net_off_amount = $1, updated_at = now() WHERE id = $2`,
        [netOffAmount, existing[0].id],
      );
    } else {
      await this.dataSource.query(
        `INSERT INTO erp_invoice_voucher_netoff (id, invoice_id, bank_transaction_id, net_off_amount, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, now(), now())`,
        [payload.invoiceId, txnId, netOffAmount],
      );
    }

    // Bi-directional sync: Đồng bộ cấn trừ sang các Phiếu dịch vụ Garage đang liên kết với Hóa đơn này
    try {
      const linkedCases = await this.dataSource.query(
        `SELECT l."caseDbId", l."linkType", c.id, c.tien_co_thue, c.doanh_thu
         FROM kgara_case_linked_invoice l
         JOIN kgara_cases c ON c.id = l."caseDbId"
         WHERE l."invoiceId" = $1`,
        [payload.invoiceId],
      );

      for (const lc of linkedCases) {
        const caseId = lc.caseDbId || lc.id;
        const isOut = (lc.linkType || invRow.direction) === 'OUT';
        const targetSettlementType = isOut ? 'RECEIPT' : 'PAYMENT';

        const existingCaseSettlement = await this.dataSource.query(
          `SELECT id FROM kgara_case_settlements WHERE case_id = $1 AND bank_transaction_id = $2 LIMIT 1`,
          [caseId, txnId],
        );

        if (existingCaseSettlement && existingCaseSettlement.length > 0) {
          await this.dataSource.query(
            `UPDATE kgara_case_settlements SET amount = $1, updated_at = now() WHERE id = $2`,
            [netOffAmount, existingCaseSettlement[0].id],
          );
        } else {
          await this.dataSource.query(
            `INSERT INTO kgara_case_settlements (id, case_id, bank_transaction_id, settlement_type, source_channel, amount, trans_date, partner_name, note, created_at, updated_at)
             VALUES (gen_random_uuid(), $1, $2, $3, 'ON_SYSTEM', $4, $5, $6, $7, now(), now())`,
            [
              caseId,
              txnId,
              targetSettlementType,
              netOffAmount,
              txn.transDate || null,
              txn.correspondentName ||
                invRow.buyer_name ||
                invRow.seller_name ||
                null,
              `Cấn trừ tự động từ hóa đơn ${invRow.invoice_no || ''}`.trim(),
            ],
          );
        }

        // Cập nhật lại công nợ phiếu dịch vụ
        await this.dataSource.query(
          `WITH sums AS (
             SELECT COALESCE(SUM(amount), 0) as total_receipts
             FROM kgara_case_settlements
             WHERE case_id = $1 AND settlement_type = 'RECEIPT'
           )
           UPDATE kgara_cases
           SET tien_da_thanh_toan = sums.total_receipts,
               tien_con_phai_thanh_toan = GREATEST(0, COALESCE(tien_co_thue, doanh_thu, 0) - sums.total_receipts),
               updated_at = now()
           FROM sums
           WHERE id = $1`,
          [caseId],
        );
      }
    } catch (caseSyncErr) {
      // Non-blocking
    }

    // Refresh journal entries if needed
    try {
      await this.refreshJournalEntriesForBankTransaction(txnId);
    } catch {
      // Non-blocking
    }

    return { message: 'Đã liên kết hóa đơn thành công' };
  }

  async removeInvoiceFromTransaction(
    txnId: string,
    invoiceIdOrNetOffId: string,
  ) {
    // 1. Tìm các invoice_id bị ảnh hưởng trước khi xóa netoff
    const affectedNetOffs = await this.dataSource.query(
      `SELECT id, invoice_id FROM erp_invoice_voucher_netoff
       WHERE bank_transaction_id = $1 AND (invoice_id = $2 OR id = $2)`,
      [txnId, invoiceIdOrNetOffId],
    );

    const affectedInvoiceIds = Array.from(
      new Set(affectedNetOffs.map((r: any) => r.invoice_id).filter(Boolean)),
    );

    // 2. Xóa bản ghi net-off
    await this.dataSource.query(
      `DELETE FROM erp_invoice_voucher_netoff
       WHERE bank_transaction_id = $1 AND (invoice_id = $2 OR id = $2)`,
      [txnId, invoiceIdOrNetOffId],
    );

    // 3. Bi-directional cascade delete: Tự động xóa cấn trừ sao kê ở các Phiếu dịch vụ kết nối
    try {
      for (const invId of affectedInvoiceIds) {
        const linkedCases = await this.dataSource.query(
          `SELECT DISTINCT "caseDbId" FROM kgara_case_linked_invoice WHERE "invoiceId" = $1`,
          [invId],
        );

        for (const lc of linkedCases) {
          const caseId = lc.caseDbId;
          await this.dataSource.query(
            `DELETE FROM kgara_case_settlements WHERE case_id = $1 AND bank_transaction_id = $2`,
            [caseId, txnId],
          );

          // Cập nhật lại công nợ phiếu dịch vụ
          await this.dataSource.query(
            `WITH sums AS (
               SELECT COALESCE(SUM(amount), 0) as total_receipts
               FROM kgara_case_settlements
               WHERE case_id = $1 AND settlement_type = 'RECEIPT'
             )
             UPDATE kgara_cases
             SET tien_da_thanh_toan = sums.total_receipts,
                 tien_con_phai_thanh_toan = GREATEST(0, COALESCE(tien_co_thue, doanh_thu, 0) - sums.total_receipts),
                 updated_at = now()
             FROM sums
             WHERE id = $1`,
            [caseId],
          );
        }
      }
    } catch (caseDelSyncErr) {
      // Non-blocking
    }

    // Refresh journal entries if needed
    try {
      await this.refreshJournalEntriesForBankTransaction(txnId);
    } catch {
      // Non-blocking
    }

    return { message: 'Đã gỡ liên kết hóa đơn thành công' };
  }
}
