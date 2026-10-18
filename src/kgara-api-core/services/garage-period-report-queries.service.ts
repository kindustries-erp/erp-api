import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { KgaraCashflowVoucher } from '../entities/kgara_cashflow_voucher.entity';
import {
  monthWindow,
  toPnlMonthRow,
  type PnlMonthRef,
  type PnlMonthRow,
} from '../helpers/garage-pnl-month.helper';
import { GaragePnlService } from './garage-pnl.service';

/** Một phiếu thu/chi xưởng trong kỳ, đã chuẩn hóa để ghi ra Excel. */
export interface PeriodVoucherRow {
  voucherCode: string;
  transDate: string;
  type: 'RECEIPT' | 'PAYMENT';
  /** Trạng thái duyệt của phiếu chi (chỉ có với PAYMENT). */
  paymentStatus?: 'PENDING' | 'APPROVED' | 'PAID' | 'EXPECTED' | null;
  paymentContent: string;
  partnerName: string;
  licensePlate: string;
  soChungTu: string;
  paymentMethod: string;
  note: string;
  amount: number;
}

/** Số yêu cầu `getPnlReport` chạy song song khi lấy P&L nhiều tháng. */
const PNL_CONCURRENCY = 3;

const toDay = (value?: string) => (value ? value.slice(0, 10) : undefined);

/** Truy vấn riêng cho báo cáo Garage theo kỳ: phiếu thu chi xưởng và P&L theo tháng. */
@Injectable()
export class GaragePeriodReportQueries {
  constructor(
    @InjectRepository(KgaraCashflowVoucher)
    private readonly voucherRepo: Repository<KgaraCashflowVoucher>,
    private readonly pnlService: GaragePnlService,
  ) {}

  /**
   * Phiếu thu/chi theo `trans_date` trong kỳ. Bảng không có cột chi nhánh nên
   * lọc qua phiếu dịch vụ: phiếu không gắn phiếu dịch vụ luôn được giữ.
   */
  async loadVouchers(
    from?: string,
    to?: string,
    branchId?: string,
  ): Promise<PeriodVoucherRow[]> {
    const qb = this.voucherRepo
      .createQueryBuilder('voucher')
      .leftJoinAndSelect('voucher.case', 'c');

    const dayFrom = toDay(from);
    const dayTo = toDay(to);
    if (dayFrom) qb.andWhere('voucher.transDate >= :dayFrom', { dayFrom });
    if (dayTo) qb.andWhere('voucher.transDate <= :dayTo', { dayTo });
    if (branchId) {
      qb.andWhere(
        '(voucher.caseId IS NULL OR c.branchExternalId = :branchId OR c.branchExternalId IS NULL)',
        { branchId },
      );
    }

    const vouchers = await qb
      .orderBy('voucher.transDate', 'ASC')
      .addOrderBy('voucher.createdAt', 'ASC')
      .getMany();

    return vouchers.map((v) => ({
      voucherCode: v.voucherCode,
      transDate: String(v.transDate ?? '').slice(0, 10),
      type: v.voucherType === 'PAYMENT' ? 'PAYMENT' : 'RECEIPT',
      paymentStatus:
        v.voucherType === 'PAYMENT' ? (v.paymentStatus ?? null) : null,
      paymentContent: v.paymentContent ?? '',
      partnerName: v.partnerName ?? '',
      licensePlate: v.licensePlate || v.case?.bienSoXe || '',
      soChungTu: v.case?.soChungTu ?? '',
      paymentMethod: v.paymentMethod ?? '',
      note: v.note ?? '',
      amount: Number(v.amount) || 0,
    }));
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
