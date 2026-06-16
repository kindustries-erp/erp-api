import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ErpJournalEntry } from './erp_journal_entry.entity';

@Entity('erp_journal_entry_attachments')
export class ErpJournalEntryAttachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'journal_entry_id', type: 'uuid' })
  journalEntryId: string;

  @ManyToOne(() => ErpJournalEntry, (entry) => entry.attachments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'journal_entry_id' })
  journalEntry: ErpJournalEntry;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName: string;

  @Column({ name: 'r2_file_key', type: 'varchar', length: 255 })
  r2FileKey: string;

  @Column({
    name: 'content_type',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  contentType: string | null;

  @Column({ name: 'file_size', type: 'integer', default: 0 })
  fileSize: number;

  @Column({ name: 'uploaded_by', type: 'uuid', nullable: true })
  uploadedBy: string | null;

  @CreateDateColumn({ name: 'uploaded_at', type: 'timestamptz' })
  uploadedAt: Date;
}
