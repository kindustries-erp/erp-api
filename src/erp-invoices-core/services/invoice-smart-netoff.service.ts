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

export const STOP_WORDS = new Set([
  'cong',
  'ty',
  'tnhh',
  'co',
  'phan',
  'cp',
  'mtv',
  'chi',
  'nhanh',
  'doanh',
  'nghiep',
  'tu',
  'nhan',
  'ho',
  'kinh',
  'thuong',
  'mai',
  'dich',
  'vu',
  'san',
  'xuat',
  'dau',
  'tu',
  'quoc',
  'te',
  'phat',
  'trien',
  'viet',
  'nam',
  'vietnam',
  'ha',
  'noi',
  'ho',
  'chi',
  'minh',
  'sai',
  'gon',
  'da',
  'nang',
  'binh',
  'duong',
  'dong',
  'nai',
  'tmdv',
  'xnk',
  'thanh',
  'toan',
  'chuyen',
  'khoan',
  'tien',
  'hang',
  'mua',
  'ban',
  'phu',
  'tung',
  'xe',
  'oto',
  'mot',
  'hai',
  'vien',
  'tap',
  'doan',
]);

export function cleanLicensePlate(str?: string | null): string {
  if (!str) return '';
  return str.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

export function extractPartnerKeywords(
  name: string | undefined | null,
): string[] {
  if (!name || name.trim().length <= 2) return [];
  const normalized = name
    .toLowerCase()
    .replace(
      /công ty|tnhh|cổ phần|\bmtv\b|\bcp\b|chi nhánh|doanh nghiệp|tư nhân|hộ kinh doanh|tập đoàn|thương mại|dịch vụ|sản xuất|đầu tư|quốc tế|phát triển|việt nam|viet nam|vietnam|\btmdv\b|\bxnk\b|một thành viên|hai thành viên|hợp danh/gi,
      ' ',
    )
    .trim();

  const words = normalized.split(/[\s,.-]+/).filter((w) => w.length >= 3);
  const unaccentedWords = removeVietnameseAccents(normalized)
    .split(/[\s,.-]+/)
    .filter((w) => w.length >= 3);

  const combined = Array.from(new Set([...words, ...unaccentedWords]));
  return combined.filter((w) => {
    const unaccented = removeVietnameseAccents(w.toLowerCase());
    return unaccented.length >= 3 && !STOP_WORDS.has(unaccented);
  });
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
    const taxCode = (
      direction === 'IN' ? invoice.sellerTaxCode : invoice.buyerTaxCode
    )?.trim();

    const invoiceNo = (invoice.invoiceNo || '').trim();
    const invoiceNoNormalized = (
      invoice.invoiceNoNormalized || invoiceNo.replace(/^0+/, '')
    ).trim();
    const serialNo = (invoice.serialNo || '').trim();
    const rawPlate = (invoice.licensePlate || '').trim();
    const compactPlate = cleanLicensePlate(rawPlate);
    const settlementOrder = (invoice.settlementOrder || '').trim();

    // Query candidates directly from DB
    const queryParams: any[] = [invoiceRemaining, invoiceTotal];
    let paramIdx = 3;

    const textConditions: string[] = [];

    // Exact invoice number (e.g. 0001234)
    if (invoiceNo.length > 0) {
      textConditions.push(`txn.description ILIKE $${paramIdx}`);
      queryParams.push(`%${invoiceNo}%`);
      paramIdx++;
    }

    // Normalized invoice number (e.g. 1234 without leading zeros, only if >= 3 chars and different)
    if (invoiceNoNormalized.length >= 3 && invoiceNoNormalized !== invoiceNo) {
      textConditions.push(`txn.description ILIKE $${paramIdx}`);
      queryParams.push(`%${invoiceNoNormalized}%`);
      paramIdx++;
    }

    // Serial number (e.g. 1C26TGA)
    if (serialNo.length >= 3) {
      textConditions.push(`txn.description ILIKE $${paramIdx}`);
      queryParams.push(`%${serialNo}%`);
      paramIdx++;
    }

    // Tax Code
    if (taxCode && taxCode.length >= 5) {
      textConditions.push(
        `(txn.correspondent_name ILIKE $${paramIdx} OR txn.description ILIKE $${paramIdx})`,
      );
      queryParams.push(`%${taxCode}%`);
      paramIdx++;
    }

    // License Plate
    if (rawPlate.length >= 4) {
      textConditions.push(`txn.description ILIKE $${paramIdx}`);
      queryParams.push(`%${rawPlate}%`);
      paramIdx++;

      if (compactPlate.length >= 4 && compactPlate !== rawPlate.toLowerCase()) {
        textConditions.push(
          `REPLACE(REPLACE(REPLACE(LOWER(txn.description), '.', ''), '-', ''), ' ', '') ILIKE $${paramIdx}`,
        );
        queryParams.push(`%${compactPlate}%`);
        paramIdx++;
      }
    }

    // Settlement Order
    if (settlementOrder.length >= 4) {
      textConditions.push(`txn.description ILIKE $${paramIdx}`);
      queryParams.push(`%${settlementOrder}%`);
      paramIdx++;
    }

    // Distinctive partner keywords
    for (const kw of partnerKeywords) {
      textConditions.push(
        `(txn.correspondent_name ILIKE $${paramIdx} OR txn.description ILIKE $${paramIdx})`,
      );
      queryParams.push(`%${kw}%`);
      paramIdx++;
    }

    let textConditionSql = '';
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
          ABS((GREATEST(COALESCE(txn.credit_amount, 0), COALESCE(txn.debit_amount, 0)) - COALESCE(no_sum.used_amount, 0)) - $1) < 1
          OR ABS(GREATEST(COALESCE(txn.credit_amount, 0), COALESCE(txn.debit_amount, 0)) - $1) < 1
          OR ABS(GREATEST(COALESCE(txn.credit_amount, 0), COALESCE(txn.debit_amount, 0)) - $2) < 1
          ${textConditionSql}
        )
      ORDER BY txn.trans_date DESC
      LIMIT 100
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
      const grossAmt =
        direction === 'IN'
          ? parseFloat(raw.debitAmount) || 0
          : parseFloat(raw.creditAmount) || 0;
      const remainingAmt = parseFloat(raw.remainingAmount) || 0;

      // Check amount match against remaining or total
      const matchGrossRemaining = Math.abs(grossAmt - invoiceRemaining) < 1;
      const matchRemainRemaining =
        Math.abs(remainingAmt - invoiceRemaining) < 1;
      const matchGrossTotal = Math.abs(grossAmt - invoiceTotal) < 1;
      const matchRemainTotal = Math.abs(remainingAmt - invoiceTotal) < 1;

      const amountMatch =
        matchGrossRemaining ||
        matchRemainRemaining ||
        matchGrossTotal ||
        matchRemainTotal;

      const desc = (raw.description || '').toLowerCase();
      const descCleaned = cleanLicensePlate(desc);
      const corr = (raw.correspondentName || '').toLowerCase();

      // InvoiceNo / SerialNo match
      const rawNoMatch =
        invoiceNo.length > 0 && desc.includes(invoiceNo.toLowerCase());
      const normNoMatch =
        invoiceNoNormalized.length >= 3 &&
        desc.includes(invoiceNoNormalized.toLowerCase());
      const serialMatch =
        serialNo.length >= 3 && desc.includes(serialNo.toLowerCase());

      const invoiceNoMatch = rawNoMatch || normNoMatch || serialMatch;

      // License plate match
      const plateMatch =
        (rawPlate.length >= 4 && desc.includes(rawPlate.toLowerCase())) ||
        (compactPlate.length >= 4 && descCleaned.includes(compactPlate));

      // Settlement order match
      const settlementMatch =
        settlementOrder.length >= 4 &&
        desc.includes(settlementOrder.toLowerCase());

      const codeMatch = invoiceNoMatch || plateMatch || settlementMatch;

      const matchedKw: string[] = [];
      if (rawNoMatch) matchedKw.push(invoiceNo);
      else if (normNoMatch) matchedKw.push(invoiceNoNormalized);
      if (serialMatch && !matchedKw.includes(serialNo))
        matchedKw.push(serialNo);
      if (plateMatch && !matchedKw.includes(rawPlate)) matchedKw.push(rawPlate);
      if (settlementMatch && !matchedKw.includes(settlementOrder)) {
        matchedKw.push(settlementOrder);
      }

      // Tax Code & Partner Match
      let correspondentMatch = false;
      if (taxCode && taxCode.length >= 5) {
        if (
          corr.includes(taxCode.toLowerCase()) ||
          desc.includes(taxCode.toLowerCase())
        ) {
          correspondentMatch = true;
          if (!matchedKw.includes(taxCode)) matchedKw.push(taxCode);
        }
      }

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
        if (codeMatch && correspondentMatch) {
          badge = 'PERFECT';
          score += 8 + 5;
        } else if (codeMatch) {
          badge = 'HIGH';
          score += 8;
        } else if (correspondentMatch) {
          badge = 'LIKELY';
          score += 5;
        } else {
          badge = 'POSSIBLE';
        }
      } else {
        // Tiền KHÔNG khớp chính xác
        if (codeMatch && correspondentMatch) {
          badge = 'NOTICE_STRONG';
          score += 8 + 5;
        } else if (codeMatch) {
          badge = 'NOTICE';
          score += 8;
        } else if (correspondentMatch && matchedKw.length > 0) {
          badge = 'NOTICE';
          score += 5;
        } else {
          // Tiền không khớp VÀ không có tín hiệu mã/đối tác -> SKIP
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
