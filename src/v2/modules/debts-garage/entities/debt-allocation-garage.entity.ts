import { Entity, JoinColumn, ManyToOne, Unique, type Relation } from 'typeorm';
import { BaseDebtAllocationEntity } from '@/v2/core/debts-core/entities/base-debt-allocation.entity';
import type { DebtGarage } from './debt-garage.entity';

/** Phân bổ thanh toán vào sổ công nợ garage; `idempotency_key` duy nhất chống trừ nợ hai lần. */
@Entity('debt_allocations_garage')
@Unique('UQ_debt_allocations_garage_idempotency', ['idempotencyKey'])
export class DebtAllocationGarage extends BaseDebtAllocationEntity {
  @ManyToOne('DebtGarage', (debt: any) => debt.allocations, {
    onDelete: 'RESTRICT',
    nullable: false,
  })
  @JoinColumn({ name: 'debt_id' })
  debt?: Relation<DebtGarage>;
}
