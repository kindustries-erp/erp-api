import type { EntityManager, EntityTarget } from 'typeorm';
import type {
  DebtOriginPort,
  UpsertDebtOriginCommand,
  VoidDebtOriginCommand,
} from '../contracts/debt-origin.port';
import { DebtBalanceEngine } from '../engines/debt-balance.engine';
import type { BaseDebtEntity } from '../entities/base-debt.entity';
import { nextDebtStatus } from './debt-settlement.helper';

/** Cài khung `DebtOriginPort` (abstract, không @Injectable). Module con khai báo `debtTarget`. */
export abstract class AbstractDebtOriginService implements DebtOriginPort {
  protected abstract readonly debtTarget: EntityTarget<BaseDebtEntity>;

  async upsertOrigin(
    manager: EntityManager,
    c: UpsertDebtOriginCommand,
  ): Promise<{ debtId: string; created: boolean }> {
    const repo = manager.getRepository(this.debtTarget);
    const key = {
      sourceType: c.sourceType,
      sourceId: c.sourceId,
      direction: c.direction,
      partyType: c.partyType,
    };
    const found = await repo
      .createQueryBuilder('d')
      .setLock('pessimistic_write')
      .where(
        'd.sourceType = :sourceType AND d.sourceId = :sourceId AND d.direction = :direction AND d.partyType = :partyType',
        key,
      )
      .getOne();

    const fields = {
      branchExternalId: c.branchExternalId,
      caseId: c.caseId ?? null,
      partnerId: c.partnerId ?? null,
      partyCode: c.partyCode,
      partyName: c.partyName ?? null,
      licensePlate: c.licensePlate ?? null,
      dueBaseDate: c.dueBaseDate ?? null,
      excluded: c.excluded ?? false,
      originalAmount: Math.max(0, c.originalAmount).toFixed(2),
    };

    if (found) {
      Object.assign(found, fields);
      // Nguồn vừa gọi upsert tức là nợ đang hiệu lực: mở lại dòng đã VOID.
      if (found.status === 'VOID') found.status = 'OPEN';
      this.rebalance(found);
      const saved = await repo.save(found);
      return { debtId: saved.id, created: false };
    }
    const row = repo.create({
      ...key,
      ...fields,
      origin: c.origin ?? 'SYNC',
      settledAmount: '0.00',
    } as never) as unknown as BaseDebtEntity;
    this.rebalance(row);
    const saved = await repo.save(row);
    return { debtId: saved.id, created: true };
  }

  async voidOrigin(
    manager: EntityManager,
    c: VoidDebtOriginCommand,
  ): Promise<boolean> {
    const repo = manager.getRepository(this.debtTarget);
    const found = await repo
      .createQueryBuilder('d')
      .setLock('pessimistic_write')
      .where(
        'd.sourceType = :sourceType AND d.sourceId = :sourceId AND d.direction = :direction AND d.partyType = :partyType',
        c,
      )
      .getOne();
    if (!found) return false;
    found.status = 'VOID';
    await repo.save(found);
    return true;
  }

  /** Giữ nguyên `settledAmount`, chỉ tính lại dư và trạng thái bằng engine. */
  private rebalance(row: BaseDebtEntity): void {
    const b = DebtBalanceEngine.compute(row.originalAmount, row.settledAmount);
    row.balanceAmount = b.balance.toFixed(2);
    row.status = nextDebtStatus(row.status, b.balance);
  }
}
