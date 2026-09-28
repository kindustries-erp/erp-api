import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('erp_document_sequences')
@Index(
  'uq_erp_document_sequences_prefix_period_branch',
  ['prefix', 'period', 'branchId'],
  {
    unique: true,
  },
)
export class ErpDocumentSequence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 32 })
  prefix: string; // VD: HĐM, HĐB, UNC, UNT, PC, PT, CT

  @Column({ type: 'varchar', length: 16 })
  period: string; // VD: 20260928 (YYYYMMDD)

  @Column({ type: 'uuid', name: 'branch_id', nullable: true })
  branchId: string | null;

  @Column({ type: 'int', name: 'current_value', default: 0 })
  currentValue: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
