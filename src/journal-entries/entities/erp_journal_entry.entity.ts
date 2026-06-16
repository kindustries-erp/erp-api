import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { ErpAccountingPeriod } from './erp_accounting_period.entity';
import { ErpJournalEntryLine } from './erp_journal_entry_line.entity';
import { ErpJournalEntryAttachment } from './erp_journal_entry_attachment.entity';

@Entity('erp_journal_entries')
export class ErpJournalEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'voucher_no', type: 'varchar', length: 64, unique: true })
  voucherNo: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ name: 'period_id', type: 'uuid', nullable: true })
  periodId: string | null;

  @ManyToOne(() => ErpAccountingPeriod, (period) => period.journalEntries)
  @JoinColumn({ name: 'period_id' })
  period: ErpAccountingPeriod;

  @Column({ type: 'varchar', length: 32, default: 'POSTED' })
  status: string;

  @Column({
    name: 'reference_type',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  referenceType: string | null;

  @Column({
    name: 'reference_id',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  referenceId: string | null;

  @Column({
    name: 'total_debit',
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  totalDebit: number;

  @Column({
    name: 'total_credit',
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  totalCredit: number;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => ErpJournalEntryLine, (line) => line.journalEntry, {
    cascade: true,
  })
  lines: ErpJournalEntryLine[];

  @OneToMany(
    () => ErpJournalEntryAttachment,
    (attachment) => attachment.journalEntry,
    { cascade: true },
  )
  attachments: ErpJournalEntryAttachment[];
}
