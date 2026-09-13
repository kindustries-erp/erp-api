import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ErpEmailAttachment } from './erp_email_attachment.entity';

@Entity({ name: 'erp_email_messages' })
@Index('idx_erp_email_messages_mailbox_uid', ['mailbox', 'uid'])
@Index('idx_erp_email_messages_message_id', ['messageId'])
export class ErpEmailMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, default: 'INBOX' })
  mailbox: string;

  @Column({ type: 'bigint', nullable: true })
  uid: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  messageId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  sourceHost: string | null;

  @Column({ type: 'varchar', length: 50, default: 'IMAP' })
  sourceProvider: string;

  @Column({ type: 'text', nullable: true })
  subject: string | null;

  @Column({ type: 'jsonb', nullable: true })
  fromJson: unknown;

  @Column({ type: 'jsonb', nullable: true })
  toJson: unknown;

  @Column({ type: 'jsonb', nullable: true })
  ccJson: unknown;

  @Column({ type: 'jsonb', nullable: true })
  bccJson: unknown;

  @Column({ type: 'text', nullable: true })
  bodyText: string | null;

  @Column({ type: 'text', nullable: true })
  bodyHtml: string | null;

  @Column({ type: 'jsonb', nullable: true })
  headersJson: unknown;

  @Column({ type: 'jsonb', nullable: true })
  rawMetaJson: unknown;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  receivedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  ingestedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => ErpEmailAttachment, (attachment) => attachment.message)
  attachments: ErpEmailAttachment[];
}
