import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SysFile } from '../../files/entities/sys-file.entity';
import { ErpEmailMessage } from './erp_email_message.entity';

@Entity({ name: 'erp_email_attachments' })
@Index('idx_erp_email_attachments_message_id', ['messageId'])
@Index('idx_erp_email_attachments_sys_file_id', ['sysFileId'])
export class ErpEmailAttachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  messageId: string;

  @Column({ type: 'uuid' })
  sysFileId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  filename: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  contentType: string | null;

  @Column({ type: 'int', nullable: true })
  size: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  contentId: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  disposition: string | null;

  @Column({ type: 'int', default: 0 })
  attachmentIndex: number;

  @Column({ type: 'jsonb', nullable: true })
  metadataJson: unknown;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => ErpEmailMessage, (message) => message.attachments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'messageId' })
  message: ErpEmailMessage;

  @ManyToOne(() => SysFile, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sysFileId' })
  sysFile: SysFile;
}
