import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ErpJournalEntryLine } from './erp_journal_entry_line.entity';

@Entity('erp_chart_of_accounts')
export class ErpChartOfAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'account_code', type: 'varchar', length: 64, unique: true })
  accountCode: string;

  @Column({ name: 'account_name', type: 'varchar', length: 255 })
  accountName: string;

  @Column({ name: 'account_type', type: 'varchar', length: 32 })
  accountType: string;

  @Column({ name: 'normal_balance', type: 'varchar', length: 16 })
  normalBalance: string;

  @Column({ name: 'parent_account_id', type: 'uuid', nullable: true })
  parentAccountId: string | null;

  @ManyToOne(() => ErpChartOfAccount, (account) => account.childAccounts, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'parent_account_id' })
  parentAccount: ErpChartOfAccount | null;

  @OneToMany(() => ErpChartOfAccount, (account) => account.parentAccount)
  childAccounts: ErpChartOfAccount[];

  @Column({ name: 'level', type: 'integer', default: 1 })
  level: number;

  @Column({ name: 'is_cash_account', type: 'boolean', default: false })
  isCashAccount: boolean;

  @Column({
    name: 'is_receivable_account',
    type: 'boolean',
    default: false,
  })
  isReceivableAccount: boolean;

  @Column({ name: 'is_payable_account', type: 'boolean', default: false })
  isPayableAccount: boolean;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => ErpJournalEntryLine, (line) => line.account)
  journalEntryLines: ErpJournalEntryLine[];
}
