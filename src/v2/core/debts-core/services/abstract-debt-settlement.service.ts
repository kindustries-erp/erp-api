import { ConflictException, NotFoundException } from '@nestjs/common';
import type { EntityManager, EntityTarget } from 'typeorm';
import type { DebtBalance } from '../contracts/debt-account.contract';
import type {
  ApplyDebtAllocationCommand,
  DebtSettlementPort,
  DebtSettlementResult,
  ReverseDebtAllocationCommand,
} from '../contracts/debt-settlement.port';
import { DebtBalanceEngine, toMoney } from '../engines/debt-balance.engine';
import type { BaseDebtAllocationEntity } from '../entities/base-debt-allocation.entity';
import type { BaseDebtEntity } from '../entities/base-debt.entity';
import { nextDebtStatus, toDebtAllocation } from './debt-settlement.helper';

/**
 * Cài đặt khung của `DebtSettlementPort` (abstract, không @Injectable).
 * Module con khai báo hai entity đích; không có công thức số dư riêng ở con.
 * Mọi hàm chạy trong `manager` của transaction đang mở.
 */
export abstract class AbstractDebtSettlementService implements DebtSettlementPort {
  protected abstract readonly debtTarget: EntityTarget<BaseDebtEntity>;
  protected abstract readonly allocationTarget: EntityTarget<BaseDebtAllocationEntity>;

  async apply(
    manager: EntityManager,
    command: ApplyDebtAllocationCommand,
  ): Promise<DebtSettlementResult> {
    const debt = await this.lockDebt(manager, command.debtId);
    const allocations = manager.getRepository(this.allocationTarget);
    const existing = await allocations.findOne({
      where: { idempotencyKey: command.idempotencyKey } as never,
    });
    if (existing) {
      if (existing.debtId !== debt.id) {
        throw new ConflictException(
          'Idempotency-Key đã dùng cho khoản nợ khác',
        );
      }
      return this.result(existing, await this.compute(manager, debt), true);
    }

    const amount = toMoney(command.amount);
    if (amount <= 0) throw new ConflictException('Số tiền phân bổ phải dương');
    const before = await this.compute(manager, debt);
    if (!command.allowOverpay && amount > before.balance) {
      throw new ConflictException(
        `Phân bổ ${amount} vượt số dư còn lại ${before.balance}`,
      );
    }

    const saved = await allocations.save(
      allocations.create({
        branchExternalId: debt.branchExternalId,
        debtId: debt.id,
        sourceType: command.sourceType,
        sourceId: command.sourceId,
        voucherId: command.voucherId ?? null,
        amount: amount.toFixed(2),
        payerType: command.payerType ?? 'KH',
        transDate: command.transDate ?? null,
        idempotencyKey: command.idempotencyKey,
        actorId: command.actorId ?? null,
        origin: 'NATIVE',
      } as never) as unknown as BaseDebtAllocationEntity,
    );
    return this.result(saved, await this.persist(manager, debt), false);
  }

  async reverse(
    manager: EntityManager,
    command: ReverseDebtAllocationCommand,
  ): Promise<DebtSettlementResult> {
    const allocations = manager.getRepository(this.allocationTarget);
    const replay = await allocations.findOne({
      where: { idempotencyKey: command.idempotencyKey } as never,
    });
    const target =
      replay ??
      (await allocations.findOne({
        where: { id: command.allocationId } as never,
      }));
    if (!target) throw new NotFoundException('Không có phân bổ để đảo');
    const debt = await this.lockDebt(manager, target.debtId);

    if (replay) {
      return this.result(replay, await this.compute(manager, debt), true);
    }
    if (target.reversedAt || target.reversalOfId) {
      throw new ConflictException('Phân bổ đã được đảo');
    }
    const now = new Date();
    target.reversedAt = now;
    await allocations.save(target);
    // Dòng đảo cũng mang `reversedAt` nên không bao giờ tính vào số dư.
    const marker = await allocations.save(
      allocations.create({
        branchExternalId: debt.branchExternalId,
        debtId: debt.id,
        sourceType: target.sourceType,
        sourceId: target.sourceId,
        voucherId: target.voucherId,
        amount: target.amount,
        payerType: target.payerType,
        transDate: target.transDate,
        idempotencyKey: command.idempotencyKey,
        reversalOfId: target.id,
        reversedAt: now,
        actorId: command.actorId ?? null,
        origin: 'NATIVE',
      } as never) as unknown as BaseDebtAllocationEntity,
    );
    return this.result(marker, await this.persist(manager, debt), false);
  }

  async recalculate(
    manager: EntityManager,
    debtId: string,
  ): Promise<DebtBalance> {
    const debt = await this.lockDebt(manager, debtId);
    return this.persist(manager, debt);
  }

  private async lockDebt(
    manager: EntityManager,
    debtId: string,
  ): Promise<BaseDebtEntity> {
    const debt = await manager
      .getRepository(this.debtTarget)
      .createQueryBuilder('d')
      .setLock('pessimistic_write')
      .where('d.id = :debtId AND d.isDeleted = false', { debtId })
      .getOne();
    if (!debt) throw new NotFoundException('Không có khoản nợ');
    return debt;
  }

  private async compute(
    manager: EntityManager,
    debt: BaseDebtEntity,
  ): Promise<DebtBalance> {
    const raw = await manager
      .getRepository(this.allocationTarget)
      .createQueryBuilder('a')
      .select('COALESCE(SUM(a.amount), 0)', 'sum')
      .where('a.debtId = :id AND a.reversedAt IS NULL', { id: debt.id })
      .getRawOne<{ sum: string }>();
    return DebtBalanceEngine.compute(debt.originalAmount, raw?.sum ?? 0);
  }

  /** Tính lại từ phân bổ chưa đảo rồi ghi `settled/balance/status` lên dòng nợ đang khóa. */
  private async persist(
    manager: EntityManager,
    debt: BaseDebtEntity,
  ): Promise<DebtBalance> {
    const balance = await this.compute(manager, debt);
    debt.settledAmount = balance.allocated.toFixed(2);
    debt.balanceAmount = balance.balance.toFixed(2);
    debt.status = nextDebtStatus(debt.status, balance.balance);
    await manager.getRepository(this.debtTarget).save(debt);
    return balance;
  }

  private result(
    row: BaseDebtAllocationEntity,
    balance: DebtBalance,
    replayed: boolean,
  ): DebtSettlementResult {
    return { allocation: toDebtAllocation(row), balance, replayed };
  }
}
