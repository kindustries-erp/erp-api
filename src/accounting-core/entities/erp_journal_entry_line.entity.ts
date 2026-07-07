import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ErpJournalEntry } from './erp_journal_entry.entity';
import { ErpChartOfAccount } from './erp_chart_of_account.entity';

@Entity({ name: 'erp_journal_entry_lines' })
export class ErpJournalEntryLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'journal_entry_id' })
  journalEntryId: string;

  @ManyToOne('ErpJournalEntry', (entry: any) => entry.lines)
  @JoinColumn({ name: 'journal_entry_id' })
  journalEntry: import('typeorm').Relation<ErpJournalEntry>;

  @Column({ type: 'uuid', name: 'account_id' })
  accountId: string;

  @ManyToOne(() => ErpChartOfAccount)
  @JoinColumn({ name: 'account_id' })
  account: ErpChartOfAccount;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 4,
    name: 'debit',
    default: 0,
  })
  debit: number;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 4,
    name: 'credit',
    default: 0,
  })
  credit: number;

  @Column({ type: 'text', name: 'description', nullable: true })
  description: string | null;

  @Column({ type: 'int', name: 'sort', nullable: true })
  sort: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
