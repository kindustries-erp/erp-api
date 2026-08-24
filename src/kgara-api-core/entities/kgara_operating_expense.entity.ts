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

  @Column({ type: 'text', nullable: true })
  note?: string | null;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy?: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
