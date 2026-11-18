import { Entity, Index, OneToMany, Unique, type Relation } from 'typeorm';
import { BaseDebtEntity } from '@/v2/core/debts-core/entities/base-debt.entity';
import type { DebtAllocationGarage } from './debt-allocation-garage.entity';

/** Sổ công nợ garage: một dòng cho mỗi (nguồn phát sinh, chiều, đối tượng nợ). */
@Entity('debts_garage')
@Unique('UQ_debts_garage_origin', [
  'sourceType',
  'sourceId',
  'direction',
  'partyType',
])
@Index('IDX_debts_garage_scope', [
  'branchExternalId',
  'direction',
  'partyType',
  'status',
])
export class DebtGarage extends BaseDebtEntity {
  @OneToMany('DebtAllocationGarage', (allocation: any) => allocation.debt)
  allocations?: Relation<DebtAllocationGarage[]>;
}
