import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KgaraCase } from '../entities/kgara_case.entity';
import { KgaraCaseSettlement } from '../entities/kgara_case_settlement.entity';

export interface GarageSmartSettlementSuggestion {
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
    codeMatch: boolean;
    plateMatch: boolean;
    customerMatch: boolean;
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

export function extractCustomerKeywords(
  name: string | undefined | null,
): string[] {
  if (!name || name.trim().length <= 2) return [];
  const normalized = name
    .toLowerCase()
    .replace(
      /công ty|tnhh|cổ phần|\bmtv\b|\bcp\b|chi nhánh|doanh nghiệp|tư nhân|khách hàng/gi,
      ' ',
    )
    .trim();

  const words = normalized.split(/\s+/).filter((w) => w.length > 2);
  const unaccentedWords = removeVietnameseAccents(normalized)
    .split(/\s+/)
    .filter((w) => w.length > 2);

  return Array.from(new Set([...words, ...unaccentedWords]));
}

export function cleanLicensePlate(plate: string | undefined | null): string {
  if (!plate) return '';
  return plate.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

@Injectable()
export class GarageSmartSettlementService {
  private readonly logger = new Logger(GarageSmartSettlementService.name);

  constructor(
    @InjectRepository(KgaraCase)
    private readonly caseRepo: Repository<KgaraCase>,
    @InjectRepository(KgaraCaseSettlement)
    private readonly settlementRepo: Repository<KgaraCaseSettlement>,
  ) {}

  async getSuggestionsForCase(
    caseId: string,
    settlementType: 'RECEIPT' | 'PAYMENT' = 'RECEIPT',
  ): Promise<GarageSmartSettlementSuggestion[]> {
    const kCase = await this.caseRepo.findOne({
      where: { id: caseId },
    });

    if (!kCase) {
      throw new NotFoundException(`Garage Case ${caseId} không tìm thấy`);
    }

    // Calculate current settlement sum for this case
    const settlements = await this.settlementRepo.find({
      where: { caseId },
    });

    let targetAmount = 0;
    if (settlementType === 'RECEIPT') {
      const targetRevenue = Number(kCase.tienCoThue || kCase.doanhThu || 0);
      const totalCollected = settlements
        .filter((s) => s.settlementType === 'RECEIPT')
        .reduce((sum, s) => sum + Number(s.amount || 0), 0);
      targetAmount = Math.max(0, targetRevenue - totalCollected);
    } else {
      const targetCost = Number(kCase.chiPhi || 0);
      const totalPaid = settlements
        .filter((s) => s.settlementType === 'PAYMENT')
        .reduce((sum, s) => sum + Number(s.amount || 0), 0);
      targetAmount = Math.max(0, targetCost - totalPaid);
    }

    if (targetAmount <= 0) {
      return [];
    }

    const soChungTu = (kCase.soChungTu || '').trim();
    const rawPlate = (kCase.bienSoXe || '').trim();
    const normalizedPlate = cleanLicensePlate(rawPlate);
    const customerKeywords = extractCustomerKeywords(kCase.khachHangName);

    // Build SQL text conditions
    const queryParams: any[] = [targetAmount];
    let paramIdx = 2;

    const textConditions: string[] = [];

    if (soChungTu.length > 0) {
      textConditions.push(`txn.description ILIKE $${paramIdx}`);
      queryParams.push(`%${soChungTu}%`);
      paramIdx++;
    }

    if (rawPlate.length > 0) {
      textConditions.push(`txn.description ILIKE $${paramIdx}`);
      queryParams.push(`%${rawPlate}%`);
      paramIdx++;
    }

    if (
      normalizedPlate.length > 0 &&
      normalizedPlate !== rawPlate.toLowerCase()
    ) {
      textConditions.push(
        `REPLACE(REPLACE(REPLACE(LOWER(txn.description), '.', ''), '-', ''), ' ', '') ILIKE $${paramIdx}`,
      );
      queryParams.push(`%${normalizedPlate}%`);
      paramIdx++;
    }

    for (const kw of customerKeywords) {
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
        AND (${settlementType === 'RECEIPT' ? 'txn.credit_amount > 0' : 'txn.debit_amount > 0'})
        AND (GREATEST(COALESCE(txn.credit_amount, 0), COALESCE(txn.debit_amount, 0)) - COALESCE(no_sum.used_amount, 0)) > 0
        AND (
          ABS(GREATEST(COALESCE(txn.credit_amount, 0), COALESCE(txn.debit_amount, 0)) - $1) < 1
          ${textConditionSql}
        )
      ORDER BY txn.trans_date DESC
      LIMIT 50
    `;

    const candidates: any[] = await this.caseRepo.manager.query(
      sql,
      queryParams,
    );

    const scoredSuggestions: GarageSmartSettlementSuggestion[] = [];

    const caseMonth =
      kCase.ngayPhatSinh || kCase.ngayTiepNhan
        ? new Date(kCase.ngayPhatSinh || kCase.ngayTiepNhan!)
            .toISOString()
            .substring(0, 7)
        : null;

    for (const raw of candidates) {
      const txnAmt =
        settlementType === 'RECEIPT'
          ? parseFloat(raw.creditAmount) || 0
          : parseFloat(raw.debitAmount) || 0;

      const amtDiff = Math.abs(txnAmt - targetAmount);
      const amountMatch = amtDiff < 1; // Khớp tiền chính xác

      const desc = (raw.description || '').toLowerCase();
      const descCleaned = cleanLicensePlate(desc);
      const corr = (raw.correspondentName || '').toLowerCase();

      const codeMatch =
        soChungTu.length > 0 && desc.includes(soChungTu.toLowerCase());

      const plateMatch =
        (rawPlate.length > 0 && desc.includes(rawPlate.toLowerCase())) ||
        (normalizedPlate.length > 0 && descCleaned.includes(normalizedPlate));

      const matchedKw: string[] = [];
      if (codeMatch) matchedKw.push(soChungTu);
      if (plateMatch) matchedKw.push(rawPlate);

      let customerMatch = false;
      for (const kw of customerKeywords) {
        if (corr.includes(kw) || desc.includes(kw)) {
          customerMatch = true;
          if (!matchedKw.includes(kw)) matchedKw.push(kw);
        }
      }

      const txnMonth = raw.transDate
        ? new Date(raw.transDate).toISOString().substring(0, 7)
        : null;
      const sameMonth = caseMonth && txnMonth && caseMonth === txnMonth;

      let score = 0;
      let badge: GarageSmartSettlementSuggestion['score']['badge'] | null =
        null;

      const hasDocumentSignal = codeMatch || plateMatch;

      if (amountMatch) {
        score += 10;
        if (hasDocumentSignal && customerMatch) {
          badge = 'PERFECT';
          score += 8 + 5;
        } else if (hasDocumentSignal) {
          badge = 'HIGH';
          score += 8;
        } else if (customerMatch) {
          badge = 'LIKELY';
          score += 5;
        } else {
          // Chỉ khớp tiền chính xác
          badge = 'POSSIBLE';
        }
      } else {
        // Tiền KHÔNG khớp chính xác
        if (hasDocumentSignal && customerMatch) {
          badge = 'NOTICE_STRONG';
          score += 8 + 5;
        } else if (hasDocumentSignal) {
          badge = 'NOTICE';
          score += 8;
        } else {
          // Tiền không khớp VÀ không có chứng từ/biển số -> SKIP!
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
          codeMatch,
          plateMatch,
          customerMatch,
          badge,
        },
        matchedKeywords: matchedKw,
      });
    }

    const BADGE_ORDER: Record<
      GarageSmartSettlementSuggestion['score']['badge'],
      number
    > = {
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
