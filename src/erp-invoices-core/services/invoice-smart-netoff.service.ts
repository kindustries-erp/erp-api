import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ErpInvoice } from '../entities/erp_invoice.entity';
import { ErpInvoiceVoucherNetOff } from '../entities/erp_invoice_voucher_netoff.entity';

export interface SmartNetOffReason {
  key: string;
  label: string;
  /** true: tín hiệu cộng điểm; false: yếu tố trừ điểm */
  matched: boolean;
}

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
  reasons?: SmartNetOffReason[];
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

export const MIN_SUGGESTION_CONFIDENCE = 40;
const MAX_SUGGESTIONS = 5;
const CANDIDATE_LIMIT = 300;

/** Từ chung theo ngành/địa danh: không đủ một mình để coi là khớp đối tác */
export const WEAK_PARTNER_WORDS = new Set([
  'bao',
  'hiem',
  'bh',
  'ngan',
  'hang',
  'mien',
  'bac',
  'trung',
  'dien',
  'nuoc',
  'may',
  'thiet',
  'bi',
  'van',
  'tai',
  'giao',
  'nhan',
  'logistics',
  'dau',
  'khi',
  'gas',
  'xang',
]);

export interface PartnerKeywordGroups {
  strong: string[];
  weak: string[];
}

export function normalizeForMatch(value: string): string {
  return removeVietnameseAccents(value).toLowerCase();
}

/** Khớp theo ranh giới từ: 4567 không khớp trong 14567 */
export function matchesWord(text: string, token: string): boolean {
  const needle = normalizeForMatch(token).trim();
  if (needle.length === 0) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`).test(
    normalizeForMatch(text),
  );
}

export function classifyPartnerKeywords(
  keywords: string[],
): PartnerKeywordGroups {
  const seen = new Set<string>();
  const strong: string[] = [];
  const weak: string[] = [];
  for (const kw of keywords) {
    const key = normalizeForMatch(kw);
    if (seen.has(key)) continue;
    seen.add(key);
    (WEAK_PARTNER_WORDS.has(key) ? weak : strong).push(kw);
  }
  return { strong, weak };
}

interface SmartNetOffContext {
  direction: string;
  invoiceRemaining: number;
  invoiceTotal: number;
  invoiceNo: string;
  invoiceNoNormalized: string;
  serialNo: string;
  rawPlate: string;
  compactPlate: string;
  settlementOrder: string;
  taxCode: string;
  partner: PartnerKeywordGroups;
  /** YYYY-MM-DD */
  invoiceDate: string | null;
}

interface ScoredCandidate {
  raw: any;
  grossAmt: number;
  amountMatch: boolean;
  invoiceNoMatch: boolean;
  correspondentMatch: boolean;
  codeMatch: boolean;
  matchedKw: string[];
  reasons: SmartNetOffReason[];
  confidence: number;
  badge: SmartNetOffSuggestion['score']['badge'];
}

const BADGE_ORDER: Record<SmartNetOffSuggestion['score']['badge'], number> = {
  PERFECT: 6,
  HIGH: 5,
  LIKELY: 4,
  POSSIBLE: 3,
  NOTICE_STRONG: 2,
  NOTICE: 1,
};

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
    const taxCode = (
      direction === 'IN' ? invoice.sellerTaxCode : invoice.buyerTaxCode
    )?.trim();
    const invoiceNo = (invoice.invoiceNo || '').trim();
    const ctx: SmartNetOffContext = {
      direction,
      invoiceRemaining,
      invoiceTotal,
      invoiceNo,
      invoiceNoNormalized: (
        invoice.invoiceNoNormalized || invoiceNo.replace(/^0+/, '')
      ).trim(),
      serialNo: (invoice.serialNo || '').trim(),
      rawPlate: (invoice.licensePlate || '').trim(),
      compactPlate: cleanLicensePlate((invoice.licensePlate || '').trim()),
      settlementOrder: (invoice.settlementOrder || '').trim(),
      taxCode: taxCode && taxCode.length >= 5 ? taxCode : '',
      partner: classifyPartnerKeywords(extractPartnerKeywords(partnerName)),
      invoiceDate: invoice.invoiceDate
        ? new Date(invoice.invoiceDate).toISOString().substring(0, 10)
        : null,
    };

    // Chỉ lấy ứng viên theo tín hiệu mạnh (từ khóa yếu không đưa vào SQL)
    const queryParams: any[] = [
      invoiceRemaining,
      invoiceTotal,
      ctx.invoiceDate ?? '1970-01-01',
    ];
    let paramIdx = 4;
    const textConditions: string[] = [];

    if (ctx.invoiceNo.length > 0) {
      textConditions.push(`txn.description ILIKE $${paramIdx}`);
      queryParams.push(`%${ctx.invoiceNo}%`);
      paramIdx++;
    }
    if (
      ctx.invoiceNoNormalized.length >= 3 &&
      ctx.invoiceNoNormalized !== ctx.invoiceNo
    ) {
      textConditions.push(`txn.description ILIKE $${paramIdx}`);
      queryParams.push(`%${ctx.invoiceNoNormalized}%`);
      paramIdx++;
    }
    if (ctx.serialNo.length >= 3) {
      textConditions.push(`txn.description ILIKE $${paramIdx}`);
      queryParams.push(`%${ctx.serialNo}%`);
      paramIdx++;
    }
    if (ctx.taxCode) {
      textConditions.push(
        `(txn.correspondent_name ILIKE $${paramIdx} OR txn.description ILIKE $${paramIdx})`,
      );
      queryParams.push(`%${ctx.taxCode}%`);
      paramIdx++;
    }
    if (ctx.rawPlate.length >= 4) {
      textConditions.push(`txn.description ILIKE $${paramIdx}`);
      queryParams.push(`%${ctx.rawPlate}%`);
      paramIdx++;
    }
    if (ctx.settlementOrder.length >= 4) {
      textConditions.push(`txn.description ILIKE $${paramIdx}`);
      queryParams.push(`%${ctx.settlementOrder}%`);
      paramIdx++;
    }
    for (const kw of ctx.partner.strong) {
      textConditions.push(
        `(txn.correspondent_name ILIKE $${paramIdx} OR txn.description ILIKE $${paramIdx})`,
      );
      queryParams.push(`%${kw}%`);
      paramIdx++;
    }

    const textConditionSql =
      textConditions.length > 0 ? `OR ${textConditions.join(' OR ')}` : '';

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
      ORDER BY ABS(txn.trans_date::date - $3::date) ASC, txn.trans_date DESC
      LIMIT ${CANDIDATE_LIMIT}
    `;

    const candidates: any[] = await this.invoiceRepo.manager.query(
      sql,
      queryParams,
    );

    const evaluated = candidates
      .map((raw) => this.scoreCandidate(raw, ctx))
      .filter((ev): ev is ScoredCandidate => ev !== null);

    // Cùng số tiền với nhiều giao dịch và không có mã chứng từ: nghi ngờ, trừ điểm
    const sameAmountCount = new Map<number, number>();
    for (const ev of evaluated) {
      if (ev.amountMatch) {
        sameAmountCount.set(
          ev.grossAmt,
          (sameAmountCount.get(ev.grossAmt) ?? 0) + 1,
        );
      }
    }
    for (const ev of evaluated) {
      if (
        ev.amountMatch &&
        !ev.codeMatch &&
        (sameAmountCount.get(ev.grossAmt) ?? 0) >= 2
      ) {
        ev.confidence -= 10;
        ev.reasons.push({
          key: 'AMBIGUOUS_AMOUNT',
          label: 'Nhiều giao dịch cùng số tiền',
          matched: false,
        });
      }
    }

    return evaluated
      .filter((ev) => ev.confidence >= MIN_SUGGESTION_CONFIDENCE)
      .sort((a, b) => {
        if (b.confidence !== a.confidence) return b.confidence - a.confidence;
        const badgeDiff = BADGE_ORDER[b.badge] - BADGE_ORDER[a.badge];
        if (badgeDiff !== 0) return badgeDiff;
        return (
          new Date(b.raw.transDate ?? 0).getTime() -
          new Date(a.raw.transDate ?? 0).getTime()
        );
      })
      .slice(0, MAX_SUGGESTIONS)
      .map((ev) => this.toSuggestion(ev));
  }

  /**
   * Chấm một ứng viên. Trả null nếu không có tín hiệu đặc hiệu
   * (số HĐ/ký hiệu, biển số, lệnh, MST hoặc từ khóa đối tác mạnh).
   */
  private scoreCandidate(
    raw: any,
    ctx: SmartNetOffContext,
  ): ScoredCandidate | null {
    const grossAmt =
      ctx.direction === 'IN'
        ? parseFloat(raw.debitAmount) || 0
        : parseFloat(raw.creditAmount) || 0;
    const remainingAmt = parseFloat(raw.remainingAmount) || 0;

    const matchRemaining =
      Math.abs(grossAmt - ctx.invoiceRemaining) < 1 ||
      Math.abs(remainingAmt - ctx.invoiceRemaining) < 1;
    const matchTotal =
      Math.abs(grossAmt - ctx.invoiceTotal) < 1 ||
      Math.abs(remainingAmt - ctx.invoiceTotal) < 1;
    const amountMatch = matchRemaining || matchTotal;

    const desc: string = raw.description || '';
    const corr: string = raw.correspondentName || '';

    const reasons: SmartNetOffReason[] = [];
    const matchedKw: string[] = [];
    let confidence = 0;

    if (matchRemaining) {
      confidence += 40;
      reasons.push({
        key: 'AMOUNT_REMAINING',
        label: 'Khớp đúng số còn phải thu',
        matched: true,
      });
    } else if (matchTotal) {
      confidence += 30;
      reasons.push({
        key: 'AMOUNT_TOTAL',
        label: 'Khớp đúng tổng hóa đơn',
        matched: true,
      });
    }

    // Đối tác & MST (từ khóa yếu không đủ để tính là khớp)
    const taxHit =
      ctx.taxCode.length > 0 &&
      (matchesWord(corr, ctx.taxCode) || matchesWord(desc, ctx.taxCode));
    const strongHits = ctx.partner.strong.filter(
      (kw) => matchesWord(corr, kw) || matchesWord(desc, kw),
    );
    const correspondentMatch = taxHit || strongHits.length > 0;

    // Số HĐ: bản đầy đủ đủ tin cậy; bản rút gọn ngắn cần đối tác/MST hoặc tiền khớp chính xác
    const rawNoHit =
      ctx.invoiceNo.length >= 6 && matchesWord(desc, ctx.invoiceNo);
    const normNoHit =
      ctx.invoiceNoNormalized.length >= 3 &&
      matchesWord(desc, ctx.invoiceNoNormalized) &&
      (ctx.invoiceNoNormalized.length > 5 || correspondentMatch || amountMatch);
    const serialHit =
      ctx.serialNo.length >= 3 && matchesWord(desc, ctx.serialNo);
    const invoiceNoMatch = rawNoHit || normNoHit || serialHit;

    const plateHit =
      (ctx.rawPlate.length >= 4 && matchesWord(desc, ctx.rawPlate)) ||
      (ctx.compactPlate.length >= 4 &&
        cleanLicensePlate(desc).includes(ctx.compactPlate));
    const settlementHit =
      ctx.settlementOrder.length >= 4 && matchesWord(desc, ctx.settlementOrder);
    const codeMatch = invoiceNoMatch || plateHit || settlementHit;

    if (!codeMatch && !correspondentMatch) {
      return null;
    }

    if (rawNoHit) {
      confidence += 35;
      matchedKw.push(ctx.invoiceNo);
      reasons.push({
        key: 'INVOICE_NO',
        label: `Số HĐ ${ctx.invoiceNo} có trong nội dung`,
        matched: true,
      });
    } else if (normNoHit) {
      confidence += 30;
      matchedKw.push(ctx.invoiceNoNormalized);
      reasons.push({
        key: 'INVOICE_NO_SHORT',
        label: `Số HĐ ${ctx.invoiceNoNormalized} có trong nội dung`,
        matched: true,
      });
    }
    if (serialHit) {
      confidence += 25;
      matchedKw.push(ctx.serialNo);
      reasons.push({
        key: 'SERIAL',
        label: `Ký hiệu ${ctx.serialNo} có trong nội dung`,
        matched: true,
      });
    }
    if (plateHit) {
      confidence += 25;
      matchedKw.push(ctx.rawPlate);
      reasons.push({
        key: 'PLATE',
        label: `Biển số ${ctx.rawPlate} có trong nội dung`,
        matched: true,
      });
    }
    if (settlementHit) {
      confidence += 25;
      matchedKw.push(ctx.settlementOrder);
      reasons.push({
        key: 'SETTLEMENT_ORDER',
        label: `Lệnh ${ctx.settlementOrder} có trong nội dung`,
        matched: true,
      });
    }

    if (taxHit) {
      confidence += 25;
      matchedKw.push(ctx.taxCode);
      reasons.push({
        key: 'TAX_CODE',
        label: `MST ${ctx.taxCode} khớp`,
        matched: true,
      });
    }
    if (strongHits.length > 0) {
      confidence += strongHits.length >= 2 ? 25 : 20;
      matchedKw.push(...strongHits);
      reasons.push({
        key: 'PARTNER_STRONG',
        label: `Đối tác: ${strongHits.join(', ')}`,
        matched: true,
      });
    }

    // Ngày giao dịch so với ngày hóa đơn
    if (raw.transDate && ctx.invoiceDate) {
      const txnDate = new Date(raw.transDate);
      const diffDays = Math.round(
        (txnDate.getTime() - new Date(ctx.invoiceDate).getTime()) / 86400000,
      );
      if (Math.abs(diffDays) <= 7) {
        confidence += 5;
        reasons.push({
          key: 'DATE_NEAR',
          label: `Cách ngày hóa đơn ${Math.abs(diffDays)} ngày`,
          matched: true,
        });
      }
      if (
        txnDate.toISOString().substring(0, 7) ===
        ctx.invoiceDate.substring(0, 7)
      ) {
        confidence += 3;
      }
      if (diffDays < -30 || diffDays > 180) {
        confidence -= 15;
        reasons.push({
          key: 'DATE_FAR',
          label: `Lệch ${Math.abs(diffDays)} ngày so với hóa đơn`,
          matched: false,
        });
      }
    }

    let badge: SmartNetOffSuggestion['score']['badge'];
    if (amountMatch) {
      badge =
        codeMatch && correspondentMatch
          ? 'PERFECT'
          : codeMatch
            ? 'HIGH'
            : 'LIKELY';
    } else {
      badge = codeMatch && correspondentMatch ? 'NOTICE_STRONG' : 'NOTICE';
    }

    return {
      raw,
      grossAmt,
      amountMatch,
      invoiceNoMatch,
      correspondentMatch,
      codeMatch,
      matchedKw: Array.from(new Set(matchedKw)),
      reasons,
      confidence,
      badge,
    };
  }

  private toSuggestion(ev: ScoredCandidate): SmartNetOffSuggestion {
    const raw = ev.raw;
    const confidence = Math.max(0, Math.min(100, ev.confidence));
    return {
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
        score: confidence,
        amountMatch: ev.amountMatch,
        invoiceNoMatch: ev.invoiceNoMatch,
        correspondentMatch: ev.correspondentMatch,
        badge: ev.badge,
      },
      matchedKeywords: ev.matchedKw,
      reasons: ev.reasons,
    };
  }
}
