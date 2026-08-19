import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ErpInvoice } from '../entities/erp_invoice.entity';
import { ErpInvoiceVoucherNetOff } from '../entities/erp_invoice_voucher_netoff.entity';

export interface SmartNetOffSuggestion {
  txn: {
    id: string;
    transDate: string;
    referenceNumber?: string;
    seqNo?: string;
    description: string;
    debitAmount: number;
    creditAmount: number;
    sourceType: string;
    correspondentName?: string;
    bankAccount?: {
      bankName?: string;
      accountNumber?: string;
    };
    cashBook?: {
      name?: string;
    };
    remainingAmount: number;
  };
  score: {
    score: number;
    amountMatch: boolean;
    invoiceNoMatch: boolean;
    correspondentMatch: boolean;
    badge:
      | 'PERFECT'
      | 'HIGH'
      | 'LIKELY'
      | 'POSSIBLE'
      | 'NOTICE_STRONG'
      | 'NOTICE';
  };
  matchedKeywords: string[];
}

export function removeVietnameseAccents(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

export function extractPartnerKeywords(
  name: string | undefined | null,
): string[] {
  if (!name || name.trim().length <= 2) return [];
  const normalized = name
    .toLowerCase()
    .replace(
      /công ty|tnhh|cổ phần|\bmtv\b|\bcp\b|chi nhánh|doanh nghiệp|tư nhân/gi,
      ' ',
    )
    .trim();

  const words = normalized.split(/\s+/).filter((w) => w.length > 2);
  const unaccentedWords = removeVietnameseAccents(normalized)
    .split(/\s+/)
    .filter((w) => w.length > 2);

  return Array.from(new Set([...words, ...unaccentedWords]));
}

@Injectable()
export class InvoiceSmartNetoffService {
  private readonly logger = new Logger(InvoiceSmartNetoffService.name);

  constructor(
    @InjectRepository(ErpInvoice)
    private readonly invoiceRepo: Repository<ErpInvoice>,
    @InjectRepository(ErpInvoiceVoucherNetOff)
    private readonly netOffRepo: Repository<ErpInvoiceVoucherNetOff>,
  ) {}

  async getSuggestionsForInvoices(
    invoiceIds: string[],
  ): Promise<Record<string, SmartNetOffSuggestion[]>> {
    if (!invoiceIds || invoiceIds.length === 0) return {};

    const invoices = await this.invoiceRepo.find({
      where: { id: In(invoiceIds), isDeleted: false },
    });

    if (invoices.length === 0) return {};

    const results: Record<string, SmartNetOffSuggestion[]> = {};

    for (const invoice of invoices) {
      const suggestions = await this.getSuggestionsForSingleInvoice(invoice);
      results[invoice.id] = suggestions;
    }

    return results;
  }

  async getSuggestionsForSingleInvoice(
    invoice: ErpInvoice,
  ): Promise<SmartNetOffSuggestion[]> {
    const netOffSumRes = await this.netOffRepo
      .createQueryBuilder('netoff')
      .select('COALESCE(SUM(netoff.netOffAmount), 0)', 'totalNetOff')
      .where('netoff.invoiceId = :invoiceId', { invoiceId: invoice.id })
      .getRawOne();

    const alreadyNetOff = parseFloat(netOffSumRes?.totalNetOff || '0');
    const invoiceTotal = parseFloat(String(invoice.totalAmount || '0'));
    const invoiceRemaining = Math.max(0, invoiceTotal - alreadyNetOff);

    if (invoiceRemaining <= 0) {
      return [];
    }

    const direction = invoice.direction || 'IN';
    const partnerName =
      direction === 'IN' ? invoice.sellerName : invoice.buyerName;
    const partnerKeywords = extractPartnerKeywords(partnerName);
    const invoiceNo = (invoice.invoiceNo || '').trim();

    // Query candidates directly from DB
    const queryParams: any[] = [invoiceRemaining];
    let paramIdx = 2;

    let textConditionSql = '';
    const textConditions: string[] = [];

    if (invoiceNo.length > 0) {
      textConditions.push(`txn.description ILIKE $${paramIdx}`);
      queryParams.push(`%${invoiceNo}%`);
      paramIdx++;
    }

    for (const kw of partnerKeywords) {
      textConditions.push(
        `(txn.correspondent_name ILIKE $${paramIdx} OR txn.description ILIKE $${paramIdx})`,
      );
      queryParams.push(`%${kw}%`);
      paramIdx++;
    }

    if (textConditions.length > 0) {
      textConditionSql = `OR ${textConditions.join(' OR ')}`;
    }

    const sql = `
      SELECT 
        txn.id,
        txn.trans_date as "transDate",
        txn.reference_number as "referenceNumber",
        txn.seq_no as "seqNo",
        txn.description,
        COALESCE(txn.debit_amount, 0)::numeric as "debitAmount",
        COALESCE(txn.credit_amount, 0)::numeric as "creditAmount",
        txn.source_type as "sourceType",
        txn.correspondent_name as "correspondentName",
        b.bank_name as "bankName",
        b.account_number as "accountNumber",
        c.name as "cashBookName",
        (GREATEST(COALESCE(txn.credit_amount, 0), COALESCE(txn.debit_amount, 0)) - COALESCE(no_sum.used_amount, 0))::numeric as "remainingAmount"
      FROM erp_bank_transactions txn
      LEFT JOIN erp_bank_accounts b ON txn.bank_account_id = b.id
      LEFT JOIN erp_cash_books c ON txn.cash_book_id = c.id
      LEFT JOIN (
        SELECT bank_transaction_id, SUM(net_off_amount) as used_amount
        FROM erp_invoice_voucher_netoff
        GROUP BY bank_transaction_id
      ) no_sum ON no_sum.bank_transaction_id = txn.id
      WHERE txn.is_deleted = false
        AND (${direction === 'IN' ? 'txn.debit_amount > 0' : 'txn.credit_amount > 0'})
        AND (GREATEST(COALESCE(txn.credit_amount, 0), COALESCE(txn.debit_amount, 0)) - COALESCE(no_sum.used_amount, 0)) > 0
        AND (
          ABS(GREATEST(COALESCE(txn.credit_amount, 0), COALESCE(txn.debit_amount, 0)) - $1) < 1
          ${textConditionSql}
        )
      ORDER BY txn.trans_date DESC
      LIMIT 50
    `;

    const candidates: any[] = await this.invoiceRepo.manager.query(
      sql,
      queryParams,
    );

    const scoredSuggestions: SmartNetOffSuggestion[] = [];

    const invoiceMonth = invoice.invoiceDate
      ? String(invoice.invoiceDate).substring(0, 7)
      : null;

    for (const raw of candidates) {
      const txnAmt =
        direction === 'IN'
          ? parseFloat(raw.debitAmount) || 0
          : parseFloat(raw.creditAmount) || 0;

      const amtDiff = Math.abs(txnAmt - invoiceRemaining);
      const amountMatch = amtDiff < 1; // Khớp tiền chính xác (sai lệch < 1đ)

      const desc = (raw.description || '').toLowerCase();
      const corr = (raw.correspondentName || '').toLowerCase();

      const invoiceNoMatch =
        invoiceNo.length > 0 && desc.includes(invoiceNo.toLowerCase());

      const matchedKw: string[] = [];
      if (invoiceNoMatch) matchedKw.push(invoiceNo);

      let correspondentMatch = false;
      for (const kw of partnerKeywords) {
        if (corr.includes(kw) || desc.includes(kw)) {
          correspondentMatch = true;
          if (!matchedKw.includes(kw)) matchedKw.push(kw);
        }
      }

      // Check same month bonus
      const txnMonth = raw.transDate
        ? new Date(raw.transDate).toISOString().substring(0, 7)
        : null;
      const sameMonth = invoiceMonth && txnMonth && invoiceMonth === txnMonth;

      let score = 0;
      let badge: SmartNetOffSuggestion['score']['badge'] | null = null;

      if (amountMatch) {
        score += 10;
        if (invoiceNoMatch && correspondentMatch) {
          badge = 'PERFECT';
          score += 8 + 5;
        } else if (invoiceNoMatch) {
          badge = 'HIGH';
          score += 8;
        } else if (correspondentMatch) {
          badge = 'LIKELY';
          score += 5;
        } else {
          // Chỉ khớp tiền chính xác 100%, không có số HĐ và đối tác
          badge = 'POSSIBLE';
        }
      } else {
        // Tiền KHÔNG khớp chính xác
        if (invoiceNoMatch && correspondentMatch) {
          badge = 'NOTICE_STRONG';
          score += 8 + 5;
        } else if (invoiceNoMatch) {
          badge = 'NOTICE';
          score += 8;
        } else {
          // Tiền không khớp VÀ không có số HĐ -> SKIP HOÀN TOÀN!
          continue;
        }
      }

      if (sameMonth) score += 2;

      scoredSuggestions.push({
        txn: {
          id: raw.id,
          transDate: raw.transDate
            ? new Date(raw.transDate).toISOString()
            : new Date().toISOString(),
          referenceNumber: raw.referenceNumber || undefined,
          seqNo: raw.seqNo || undefined,
          description: raw.description || '',
          debitAmount: parseFloat(raw.debitAmount) || 0,
          creditAmount: parseFloat(raw.creditAmount) || 0,
          sourceType: raw.sourceType || 'BANK',
          correspondentName: raw.correspondentName || undefined,
          bankAccount: raw.bankName
            ? {
                bankName: raw.bankName,
                accountNumber: raw.accountNumber || undefined,
              }
            : undefined,
          cashBook: raw.cashBookName ? { name: raw.cashBookName } : undefined,
          remainingAmount: parseFloat(raw.remainingAmount) || 0,
        },
        score: {
          score,
          amountMatch,
          invoiceNoMatch,
          correspondentMatch,
          badge,
        },
        matchedKeywords: matchedKw,
      });
    }

    const BADGE_ORDER: Record<SmartNetOffSuggestion['score']['badge'], number> =
      {
        PERFECT: 6,
        HIGH: 5,
        LIKELY: 4,
        POSSIBLE: 3,
        NOTICE_STRONG: 2,
        NOTICE: 1,
      };

    scoredSuggestions.sort((a, b) => {
      const badgeDiff = BADGE_ORDER[b.score.badge] - BADGE_ORDER[a.score.badge];
      if (badgeDiff !== 0) return badgeDiff;
      if (b.score.score !== a.score.score) return b.score.score - a.score.score;
      return (
        new Date(b.txn.transDate).getTime() -
        new Date(a.txn.transDate).getTime()
      );
    });

    return scoredSuggestions.slice(0, 5);
  }
}
