import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
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

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => ErpJournalEntryLine, (line) => line.account)
  journalEntryLines: ErpJournalEntryLine[];
}
