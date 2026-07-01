import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ErpBranch } from '../../branches-core/entities/erp_branch.entity';
import { ErpJournalEntryLine } from './erp_journal_entry_line.entity';

@Entity({ name: 'erp_journal_entries' })
export class ErpJournalEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'branch_id' })
  branchId: string;

  @ManyToOne(() => ErpBranch)
  @JoinColumn({ name: 'branch_id' })
  branch: ErpBranch;

  @Column({ type: 'varchar', length: 100, name: 'entry_no' })
  entryNo: string;

  @Column({ type: 'timestamp', name: 'date' })
  date: Date;

  @Column({ type: 'text', name: 'description', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 50, name: 'status', default: 'POSTED' })
  status: string;

  @Column({ type: 'varchar', length: 100, name: 'reference', nullable: true })
  reference: string | null;

  @Column({ type: 'uuid', name: 'source_id', nullable: true })
  sourceId: string | null;

  @Column({ type: 'varchar', length: 50, name: 'source_type', nullable: true })
  sourceType: string | null;

  @Column({ type: 'boolean', name: 'is_deleted', default: false })
  isDeleted: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => ErpJournalEntryLine, (line) => line.journalEntry, {
    cascade: true,
  })
  lines: ErpJournalEntryLine[];
}
