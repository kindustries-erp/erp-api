import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { KgaraCase } from '@/kgara-api-core/entities/kgara_case.entity';
import { KgaraCashflowVoucher } from '@/kgara-api-core/entities/kgara_cashflow_voucher.entity';
import { KgaraCaseSettlement } from '@/kgara-api-core/entities/kgara_case_settlement.entity';
import {
  removeOpexForVoucher,
  syncOpexFromVoucher,
} from '@/kgara-api-core/helpers/garage-cashflow-opex-sync.helper';
import { GarageHubService } from '@/kgara-api-core/hub/garage-hub.service';
import { resolveStoredNetPayable } from '@/kgara-api-core/utils/kgara-parser.util';
import type { CashflowVoucherGarage } from '../../cashflow-vouchers-garage/entities/cashflow-voucher-garage.entity';
import type { DebtAllocationGarage } from '../../debts-garage/entities/debt-allocation-garage.entity';
import type { DebtGarage } from '../../debts-garage/entities/debt-garage.entity';
import { voucherSettlesDebt } from '../services/garage-voucher-allocation.service';
import {
  toLegacyPaymentMethod,
  toLegacyVoucherFields,
} from './legacy-voucher.mapper';

/**
 * Cầu nối v2 → bảng V1 (`kgara_cashflow_vouchers`, `kgara_case_settlements`, `kgara_cases`, opex) trong CÙNG
 * transaction với lệnh v2, cùng UUID, để 21 file V1 còn đọc các bảng cũ vẫn thấy đúng. Gỡ khi các báo cáo chuyển v2.
 */
@Injectable()
export class LegacyKgaraMirrorService {
  constructor(private readonly hub: GarageHubService) {}

  /** Phiếu v2 → phiếu V1 + settlement (theo quy tắc V1) + opex + còn phải thu của vụ việc (cũ và mới). */
  async mirrorVoucher(
    manager: EntityManager,
    voucher: CashflowVoucherGarage,
    ctx: { previousCaseId?: string | null; actorId?: string | null } = {},
  ): Promise<void> {
    const vouchers = manager.getRepository(KgaraCashflowVoucher);
    const existing = await vouchers.findOne({ where: { id: voucher.id } });
    const row = vouchers.create({
      ...(existing ?? {}),
      ...toLegacyVoucherFields(voucher),
    });
    const saved = await vouchers.save(row);

    if (voucher.status === 'CANCELLED')
      await removeOpexForVoucher(manager, voucher.id);
    else if (this.hub) {
      await this.hub.handleCashflowSettled(
        { voucher: saved, user: { sub: ctx.actorId ?? undefined } },
        manager,
      );
    } else await syncOpexFromVoucher(manager, saved);

    await this.mirrorSettlement(manager, voucher);
    for (const caseId of new Set([voucher.caseId, ctx.previousCaseId])) {
      if (caseId) await this.recalcCaseDebt(manager, caseId);
    }
  }

  /** Phân bổ thủ công (không gắn phiếu) → settlement V1 cùng UUID, kênh ngoài hệ thống. */
  async mirrorManualAllocation(
    manager: EntityManager,
    allocation: DebtAllocationGarage,
    debt: DebtGarage,
  ): Promise<void> {
    if (allocation.voucherId || !debt.caseId) return;
    const settlements = manager.getRepository(KgaraCaseSettlement);
    await settlements.save(
      settlements.create({
        id: allocation.id,
        caseId: debt.caseId,
        settlementType: debt.direction === 'RECEIVABLE' ? 'RECEIPT' : 'PAYMENT',
        sourceChannel:
          allocation.sourceType === 'BANK_TRANSACTION'
            ? 'ON_SYSTEM'
            : 'OFF_SYSTEM_MANUAL',
        paymentMethod: 'OTHER',
        payerType: allocation.payerType as 'KH' | 'BH',
        amount: Number(allocation.amount),
        transDate: allocation.transDate ?? undefined,
        partnerName: debt.partyName ?? undefined,
        receiptNumber: allocation.sourceId ?? undefined,
      }),
    );
    await this.recalcCaseDebt(manager, debt.caseId);
  }

  /** Đảo phân bổ thủ công → gỡ settlement V1 tương ứng. */
  async unmirrorManualAllocation(
    manager: EntityManager,
    allocationId: string,
    caseId: string | null | undefined,
  ): Promise<void> {
    await manager
      .getRepository(KgaraCaseSettlement)
      .delete({ id: allocationId });
    if (caseId) await this.recalcCaseDebt(manager, caseId);
  }

  private async mirrorSettlement(
    manager: EntityManager,
    v: CashflowVoucherGarage,
  ): Promise<void> {
    const repo = manager.getRepository(KgaraCaseSettlement);
    const existing = await repo.findOne({ where: { cashflowVoucherId: v.id } });
    if (!voucherSettlesDebt(v)) {
      if (existing) await repo.delete({ id: existing.id });
      return;
    }
    await repo.save(
      repo.create({
        ...(existing ?? {}),
        caseId: v.caseId as string,
        settlementType: v.voucherType,
        amount: Number(v.amount),
        transDate: v.transDate,
        bankTransactionId: v.erpBankTransactionId ?? undefined,
        cashflowVoucherId: v.id,
        sourceChannel: 'ON_SYSTEM',
        paymentMethod: toLegacyPaymentMethod(v.paymentMethod),
        payerType:
          v.voucherType === 'RECEIPT' ? (v.payerType as 'KH' | 'BH') : 'KH',
        note: v.note ?? undefined,
        partnerName: v.partnerName ?? undefined,
      }),
    );
  }

  /** Cùng công thức `_recalculateCaseDebt` của V1: đã thu = tổng settlement RECEIPT, còn phải thu = max(0, ròng - đã thu). */
  async recalcCaseDebt(manager: EntityManager, caseId: string): Promise<void> {
    const cases = manager.getRepository(KgaraCase);
    const kCase = await cases.findOne({ where: { id: caseId } });
    if (!kCase) return;
    const settlements = await manager
      .getRepository(KgaraCaseSettlement)
      .find({ where: { caseId } });
    const net = resolveStoredNetPayable(kCase);
    const paid =
      settlements.length > 0
        ? settlements
            .filter((s) => s.settlementType === 'RECEIPT')
            .reduce((sum, s) => sum + Number(s.amount || 0), 0)
        : Number(kCase.rawData?.TienDaThanhToan || 0);
    kCase.tienDaThanhToan = paid;
    kCase.tienConPhaiThanhToan = Math.max(0, net - paid);
    await cases.save(kCase);
  }
}
