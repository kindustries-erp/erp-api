import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { toMoney } from '@/v2/core/debts-core';
import { CashflowVoucherGarage } from '../../cashflow-vouchers-garage/entities/cashflow-voucher-garage.entity';
import { DebtAllocationGarage } from '../../debts-garage/entities/debt-allocation-garage.entity';
import { DebtGarage } from '../../debts-garage/entities/debt-garage.entity';
import { GarageDebtLedgerProjector } from '../../debts-garage/services/garage-debt-ledger.projector';
import { GarageDebtSettlementService } from '../../debts-garage/services/garage-debt-settlement.service';
import { shouldHaveSettlement } from '@/kgara-api-core/helpers/garage-cashflow-payment-rules';
import { planVoucherAllocation } from '../helpers/voucher-allocation.planner';

/** Quy tắc V1: phiếu thu trừ nợ khi không phải dự thu/hủy; phiếu chi chỉ khi PAID và không thuộc nhóm opex/hoa hồng. */
export function voucherSettlesDebt(v: CashflowVoucherGarage): boolean {
  return (
    !!v.caseId &&
    shouldHaveSettlement({
      voucherType: v.voucherType,
      paymentStatus: v.status,
      paymentContent: v.paymentContent,
    })
  );
}

/**
 * Áp và đảo phân bổ của MỘT phiếu thu chi vào sổ nợ. Chỉ chạy trong `manager` của transaction
 * orchestrator; mọi thay đổi số dư đi qua `GarageDebtSettlementService` (khóa + idempotent).
 */
@Injectable()
export class GarageVoucherAllocationService {
  constructor(
    private readonly settlement: GarageDebtSettlementService,
    private readonly projector: GarageDebtLedgerProjector,
  ) {}

  /** Phiếu đủ điều kiện trừ nợ (theo quy tắc V1) gắn vụ việc: dựng nợ gốc (nếu chưa có) rồi chia tiền vào các khoản nợ. */
  async applyForVoucher(
    manager: EntityManager,
    voucher: CashflowVoucherGarage,
    actorId: string | null,
  ): Promise<number> {
    if (!voucherSettlesDebt(voucher) || !voucher.caseId) return 0;
    await this.projector.projectCase(manager, voucher.caseId);
    const debts = await manager.getRepository(DebtGarage).find({
      where: {
        caseId: voucher.caseId,
        branchExternalId: voucher.branchExternalId,
        isDeleted: false,
      },
      order: { id: 'ASC' },
    });
    const plan = planVoucherAllocation({
      voucherType: voucher.voucherType,
      payerType: voucher.payerType,
      amount: toMoney(voucher.amount),
      candidates: debts
        .filter((d) => d.status !== 'VOID')
        .map((d) => ({
          id: d.id,
          direction: d.direction,
          partyType: d.partyType,
          balance: toMoney(d.balanceAmount),
        })),
    });
    const allocations = manager.getRepository(DebtAllocationGarage);
    for (const item of [...plan].sort((a, b) =>
      a.debtId.localeCompare(b.debtId),
    )) {
      // Số lần đã ghi cho (phiếu, khoản nợ), kể cả đã đảo, để khóa idempotent của lần áp lại không trùng.
      const round = await allocations.count({
        where: { voucherId: voucher.id, debtId: item.debtId },
      });
      await this.settlement.apply(manager, {
        debtId: item.debtId,
        sourceType: 'CASHFLOW_VOUCHER',
        sourceId: voucher.voucherCode,
        amount: item.amount,
        idempotencyKey: `voucher:${voucher.id}:${item.debtId}:${round}`,
        voucherId: voucher.id,
        payerType: voucher.payerType,
        transDate: voucher.transDate,
        actorId,
        allowOverpay: item.allowOverpay,
      });
    }
    return plan.length;
  }

  /**
   * Đưa phân bổ của phiếu về đúng trạng thái hiện tại: hết điều kiện trừ nợ thì đảo hết,
   * đủ điều kiện mà chưa có phân bổ thì áp. Đã có phân bổ thì giữ (đổi số tiền đi qua đảo + áp lại).
   */
  async syncForVoucher(
    manager: EntityManager,
    voucher: CashflowVoucherGarage,
    actorId: string | null,
  ): Promise<void> {
    if (!voucherSettlesDebt(voucher)) {
      await this.reverseForVoucher(manager, voucher.id, actorId);
      return;
    }
    const live = await manager.getRepository(DebtAllocationGarage).count({
      where: { voucherId: voucher.id, reversedAt: null as never },
    });
    if (live === 0) await this.applyForVoucher(manager, voucher, actorId);
  }

  /** Bên trả mặc định của phiếu thu gắn vụ việc: còn nợ bảo hiểm thì BH trước (như V1), không thì KH. */
  async resolvePayer(
    manager: EntityManager,
    branchId: string,
    caseId: string | null | undefined,
  ): Promise<'KH' | 'BH'> {
    if (!caseId) return 'KH';
    const insurer = await manager.getRepository(DebtGarage).findOne({
      where: {
        caseId,
        branchExternalId: branchId,
        direction: 'RECEIVABLE',
        partyType: 'INSURER',
        isDeleted: false,
      },
    });
    return insurer &&
      insurer.status !== 'VOID' &&
      toMoney(insurer.balanceAmount) > 0
      ? 'BH'
      : 'KH';
  }

  /** Đảo mọi phân bổ còn hiệu lực của phiếu (hủy, đổi số tiền, đổi vụ việc). */
  async reverseForVoucher(
    manager: EntityManager,
    voucherId: string,
    actorId: string | null,
  ): Promise<number> {
    const live = await manager.getRepository(DebtAllocationGarage).find({
      where: { voucherId, reversedAt: null as never },
      order: { debtId: 'ASC', id: 'ASC' },
    });
    for (const allocation of live) {
      await this.settlement.reverse(manager, {
        allocationId: allocation.id,
        idempotencyKey: `voucher-reverse:${allocation.id}`,
        actorId,
      });
    }
    return live.length;
  }
}
