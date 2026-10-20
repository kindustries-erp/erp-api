import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { KgaraCashflowVoucher } from '../entities/kgara_cashflow_voucher.entity';
import {
  loadPeriodVoucherRows,
  type PeriodVoucherRow,
} from '../helpers/garage-period-voucher-rows.helper';
import {
  monthWindow,
  toPnlMonthRow,
  type PnlMonthRef,
  type PnlMonthRow,
} from '../helpers/garage-pnl-month.helper';
import { GaragePnlService } from './garage-pnl.service';

export type { PeriodVoucherRow } from '../helpers/garage-period-voucher-rows.helper';

/** Số yêu cầu `getPnlReport` chạy song song khi lấy P&L nhiều tháng. */
const PNL_CONCURRENCY = 3;

/** Truy vấn riêng cho báo cáo Garage theo kỳ: phiếu thu chi xưởng và P&L theo tháng. */
@Injectable()
export class GaragePeriodReportQueries {
  constructor(
    @InjectRepository(KgaraCashflowVoucher)
    private readonly voucherRepo: Repository<KgaraCashflowVoucher>,
    private readonly pnlService: GaragePnlService,
  ) {}

  /** Phiếu thu/chi trong kỳ; truy vấn dùng chung với Hub qua `loadPeriodVoucherRows`. */
  loadVouchers(
    from?: string,
    to?: string,
    branchId?: string,
  ): Promise<PeriodVoucherRow[]> {
    return loadPeriodVoucherRows(this.voucherRepo, from, to, branchId);
  }

  /**
   * P&L `count` tháng liên tiếp kết thúc ở `end` (cũ đến mới). Lỗi của một tháng
   * làm hỏng cả báo cáo thay vì lặng lẽ ghi số 0.
   */
  async loadPnlMonthly(end: PnlMonthRef, count = 12): Promise<PnlMonthRow[]> {
    const months = monthWindow(end, count);
    const rows: PnlMonthRow[] = [];
    for (let i = 0; i < months.length; i += PNL_CONCURRENCY) {
      const chunk = months.slice(i, i + PNL_CONCURRENCY);
      const reports = await Promise.all(
        chunk.map((m) => this.pnlService.getPnlReport(m.year, m.month)),
      );
      chunk.forEach((m, idx) => rows.push(toPnlMonthRow(m, reports[idx])));
    }
    return rows;
  }
}
