import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ErpJournalEntry } from './erp_journal_entry.entity';
import { ErpChartOfAccount } from './erp_chart_of_account.entity';

@Entity('erp_journal_entry_lines')
export class ErpJournalEntryLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'journal_entry_id', type: 'uuid' })
  journalEntryId: string;

  @ManyToOne(() => ErpJournalEntry, (entry) => entry.lines, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'journal_entry_id' })
  journalEntry: ErpJournalEntry;

  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string;

  @ManyToOne(() => ErpChartOfAccount, (account) => account.journalEntryLines)
  @JoinColumn({ name: 'account_id' })
  account: ErpChartOfAccount;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  debit: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  credit: number;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'integer', default: 0 })
  sort: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
