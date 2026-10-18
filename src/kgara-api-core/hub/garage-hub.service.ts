import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { GarageCaseLifecycleHandler } from './handlers/garage-case-lifecycle.handler';
import { GarageCashflowSettleHandler } from './handlers/garage-cashflow-settle.handler';
import { GaragePnlCommissionHandler } from './handlers/garage-pnl-commission.handler';
import { KgaraCashflowVoucher } from '../entities/kgara_cashflow_voucher.entity';
import { KgaraOperatingExpense } from '../entities/kgara_operating_expense.entity';
import {
  CaseTransitionEvent,
  CaseTransitionResult,
  CashflowSettledEvent,
  CashflowSettledResult,
  PnlCommissionEvent,
  PnlCommissionSyncResult,
  GarageHealthOverview,
} from './garage-hub.types';

@Injectable()
export class GarageHubService {
  private readonly logger = new Logger(GarageHubService.name);

  constructor(
    private readonly caseLifecycleHandler: GarageCaseLifecycleHandler,
    private readonly cashflowSettleHandler: GarageCashflowSettleHandler,
    private readonly pnlCommissionHandler: GaragePnlCommissionHandler,
    @InjectRepository(KgaraCashflowVoucher)
    private readonly voucherRepo: Repository<KgaraCashflowVoucher>,
    @InjectRepository(KgaraOperatingExpense)
    private readonly opexRepo: Repository<KgaraOperatingExpense>,
  ) {}

  /**
   * Use Case 1: Điều phối sự kiện vòng đời case (Hoàn tất -> Dự thu, Revert -> Cancelled)
   */
  async handleCaseTransition(
    event: CaseTransitionEvent,
  ): Promise<CaseTransitionResult> {
    return this.caseLifecycleHandler.handleCaseTransition(event);
  }

  /**
   * Use Case 2: Điều phối khi phiếu thu chi xưởng được thanh toán / đổi trạng thái
   */
  async handleCashflowSettled(
    event: CashflowSettledEvent,
    customManager?: EntityManager,
  ): Promise<CashflowSettledResult> {
    return this.cashflowSettleHandler.handleCashflowSettled(
      event,
      customManager,
    );
  }

  /**
   * Use Case 3: Điều phối chốt hoa hồng tự động từ P&L sang sổ quỹ và chi phí OPEX
   */
  async handlePnlCommissionSync(
    event: PnlCommissionEvent,
  ): Promise<PnlCommissionSyncResult> {
    return this.pnlCommissionHandler.handlePnlCommissionSync(event);
  }

  /**
   * Use Case 4: Giám sát toàn vẹn và sức khỏe tài chính xưởng
   */
  async getHealthOverview(
    targetYear?: number,
    targetMonth?: number,
  ): Promise<GarageHealthOverview> {
    const now = new Date();
    const year = targetYear || now.getFullYear();
    const month = targetMonth || now.getMonth() + 1;
    const todayStr = now.toISOString().slice(0, 10);

    // 1. Thống kê phiếu dự thu
    const expectedVouchers = await this.voucherRepo.find({
      where: {
        voucherType: 'RECEIPT',
        paymentStatus: 'EXPECTED',
      },
    });

    const totalActiveCount = expectedVouchers.length;
    const totalActiveAmount = expectedVouchers.reduce(
      (sum, v) => sum + (Number(v.amount) || 0),
      0,
    );

    const overdueVouchers = expectedVouchers.filter(
      (v) => v.transDate && v.transDate < todayStr,
    );
    const overdueCount = overdueVouchers.length;
    const overdueAmount = overdueVouchers.reduce(
      (sum, v) => sum + (Number(v.amount) || 0),
      0,
    );

    // 2. Đối soát hoa hồng OPEX vs Cashflow
    const opexRows = await this.opexRepo.find({
      where: [
        { periodYear: year, periodMonth: month, categoryKey: 'HOA_HONG_SALE' },
        { periodYear: year, periodMonth: month, categoryKey: 'HOA_HONG_DV' },
      ],
    });
    const opexCommissionTotal = opexRows.reduce(
      (sum, r) => sum + (Number(r.amount) || 0),
      0,
    );

    const cashflowVouchers = await this.voucherRepo.find({
      where: {
        pnlPeriodYear: year,
        pnlPeriodMonth: month,
        isAutoCommission: true,
      },
    });
    // Không tính các phiếu đã bị CANCELLED
    const activeCashflowCommission = cashflowVouchers.filter(
      (v) => v.paymentStatus !== 'CANCELLED',
    );
    const cashflowCommissionTotal = activeCashflowCommission.reduce(
      (sum, v) => sum + (Number(v.amount) || 0),
      0,
    );

    const difference = Math.abs(opexCommissionTotal - cashflowCommissionTotal);

    return {
      asOf: now.toISOString(),
      expectedReceipts: {
        totalActiveCount,
        totalActiveAmount,
        overdueCount,
        overdueAmount,
      },
      commissionCheck: {
        year,
        month,
        opexCommissionTotal,
        cashflowCommissionTotal,
        isBalanced: difference === 0,
        difference,
      },
    };
  }
}
