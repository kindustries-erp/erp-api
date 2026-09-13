import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('kgara_operating_expenses')
@Index('idx_kgara_opex_period', ['periodYear', 'periodMonth'])
@Index('idx_kgara_opex_category', ['categoryKey'])
export class KgaraOperatingExpense {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'smallint', name: 'period_year' })
  periodYear: number;

  @Column({ type: 'smallint', name: 'period_month' })
  periodMonth: number;

  @Column({ type: 'varchar', length: 100, name: 'category_key' })
  categoryKey: string;

  @Column({ type: 'varchar', length: 255, name: 'category_name' })
  categoryName: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  amount: number;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    name: 'oj_amount',
    default: 0,
  })
  ojAmount: number;

  @Column({ type: 'text', nullable: true })
  note?: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    name: 'recurrence_type',
    nullable: true,
  })
  recurrenceType?: string | null;

  @Column({ type: 'smallint', name: 'recurrence_until_year', nullable: true })
  recurrenceUntilYear?: number | null;

  @Column({ type: 'smallint', name: 'recurrence_until_month', nullable: true })
  recurrenceUntilMonth?: number | null;

  @Column({ type: 'uuid', name: 'recurrence_anchor_id', nullable: true })
  @Index('idx_kgara_opex_recurrence_anchor')
  recurrenceAnchorId?: string | null;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy?: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
