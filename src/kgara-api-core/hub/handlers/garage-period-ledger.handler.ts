import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { KgaraCashflowVoucher } from '../../entities/kgara_cashflow_voucher.entity';

import {
  classifyVoucher,
  summarizeLedger,
  type LedgerVoucherRow,
} from '../../helpers/garage-ledger-classifier';
import { loadPeriodVoucherRows } from '../../helpers/garage-period-voucher-rows.helper';
import type { PeriodLedger } from '../garage-hub.types';

/**
 * Đọc sổ quỹ xưởng trong kỳ: lấy phiếu từ truy vấn, gán nhóm dòng tiền và cộng tổng.
 * Phiếu đã hủy bị loại khỏi danh sách lẫn tổng.
 */
@Injectable()
export class GaragePeriodLedgerHandler {
  constructor(
    @InjectRepository(KgaraCashflowVoucher)
    private readonly voucherRepo: Repository<KgaraCashflowVoucher>,
  ) {}

  async loadLedger(
    from?: string,
    to?: string,
    branchId?: string,
  ): Promise<PeriodLedger> {
    const rows = await loadPeriodVoucherRows(
      this.voucherRepo,
      from,
      to,
      branchId,
    );

    const vouchers: LedgerVoucherRow[] = [];
    for (const row of rows) {
      const category = classifyVoucher({
        voucherType: row.type,
        paymentStatus: row.paymentStatus,
      });
      if (category) vouchers.push({ ...row, category });
    }

    return {
      vouchers,
      totals: summarizeLedger(vouchers),
    };
  }
}
