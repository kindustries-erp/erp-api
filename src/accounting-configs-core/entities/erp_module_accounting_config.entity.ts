import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ErpChartOfAccount } from '../../journal-entries/entities/erp_chart_of_account.entity';

@Entity('erp_module_accounting_configs')
export class ErpModuleAccountingConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'module_name', type: 'varchar', length: 64 })
  moduleName: string;

  @Column({ type: 'varchar', length: 64 })
  action: string;

  @Column({ name: 'debit_account_id', type: 'uuid', nullable: true })
  debitAccountId: string | null;

  @ManyToOne(() => ErpChartOfAccount)
  @JoinColumn({ name: 'debit_account_id' })
  debitAccount: ErpChartOfAccount | null;

  @Column({ name: 'credit_account_id', type: 'uuid', nullable: true })
  creditAccountId: string | null;

  @ManyToOne(() => ErpChartOfAccount)
  @JoinColumn({ name: 'credit_account_id' })
  creditAccount: ErpChartOfAccount | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
