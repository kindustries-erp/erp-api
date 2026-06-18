import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'erp_boms' })
export class ErpBom {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, name: 'bom_code' })
  bomCode: string;

  @Column({ type: 'varchar', length: 255, name: 'bom_name' })
  bomName: string;

  @Column({ type: 'uuid', name: 'finished_good_item_id', nullable: true })
  finishedGoodItemId: string | null;

  @Column({ type: 'varchar', length: 255, name: 'version' })
  version: string;

  @Column({ type: 'varchar', length: 255, name: 'status', default: 'ACTIVE' })
  status: string;

  @Column({ type: 'date', name: 'effective_from', nullable: true })
  effectiveFrom: string | null;

  @Column({ type: 'date', name: 'effective_to', nullable: true })
  effectiveTo: string | null;

  @Column({ type: 'text', name: 'notes', nullable: true })
  notes: string | null;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy: string | null;

  @Column({ type: 'boolean', name: 'is_deleted', default: false })
  isDeleted: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
