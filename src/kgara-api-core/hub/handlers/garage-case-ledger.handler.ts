import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { KgaraCashflowVoucher } from '../../entities/kgara_cashflow_voucher.entity';
import { classifyVoucher } from '../../helpers/garage-ledger-classifier';

/** Dự thu và dự chi gắn với một phiếu dịch vụ (phiếu thu/chi chưa thực tế). */
export interface CaseLedgerAmounts {
  expectedIn: number;
  plannedOut: number;
}

/** Số `IN (...)` tối đa mỗi truy vấn, tránh câu SQL quá dài khi xuất nhiều phiếu. */
const CASE_ID_CHUNK = 2000;

/**
 * Dự thu/dự chi theo từng phiếu dịch vụ, dùng cho bảng kê phiếu dịch vụ.
 * Phân loại bằng `classifyVoucher` để khớp sổ quỹ kỳ; phiếu đã hủy không vào kết quả.
 */
@Injectable()
export class GarageCaseLedgerHandler {
  constructor(
    @InjectRepository(KgaraCashflowVoucher)
    private readonly voucherRepo: Repository<KgaraCashflowVoucher>,
  ) {}

  async loadCaseLedger(
    caseIds: string[],
  ): Promise<Record<string, CaseLedgerAmounts>> {
    const result: Record<string, CaseLedgerAmounts> = {};
    const ids = [...new Set(caseIds.filter(Boolean))];
    for (let i = 0; i < ids.length; i += CASE_ID_CHUNK) {
      const chunk = ids.slice(i, i + CASE_ID_CHUNK);
      const vouchers = await this.voucherRepo
        .createQueryBuilder('v')
        .select([
          'v.caseId AS "caseId"',
          'v.voucherType AS "voucherType"',
          'v.paymentStatus AS "paymentStatus"',
          'v.amount AS amount',
        ])
        .where('v.caseId IN (:...chunk)', { chunk })
        .getRawMany<{
          caseId: string;
          voucherType: 'RECEIPT' | 'PAYMENT';
          paymentStatus: string | null;
          amount: string | number;
        }>();

      for (const v of vouchers) {
        const category = classifyVoucher({
          voucherType: v.voucherType,
          paymentStatus: v.paymentStatus,
        });
        if (category !== 'EXPECTED_IN' && category !== 'PLANNED_OUT') continue;
        const entry = result[v.caseId] ?? { expectedIn: 0, plannedOut: 0 };
        const amount = Number(v.amount) || 0;
        if (category === 'EXPECTED_IN') entry.expectedIn += amount;
        else entry.plannedOut += amount;
        result[v.caseId] = entry;
      }
    }
    return result;
  }
}
