import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'gw_payables' })
export class GreenwayPayable {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100, name: 'external_id' })
  externalId: string;

  @Column({ type: 'varchar', length: 100, name: 'code', nullable: true })
  code: string | null;

  @Column({ type: 'varchar', length: 255, name: 'name', nullable: true })
  name: string | null;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 2,
    name: 'total_amount',
    nullable: true,
  })
  totalAmount: number | null;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 2,
    name: 'paid_amount',
    nullable: true,
  })
  paidAmount: number | null;

  @Index()
  @Column({
    type: 'varchar',
    length: 100,
    name: 'branch_external_id',
    nullable: true,
  })
  branchExternalId: string | null;

  @Column({ type: 'jsonb', name: 'raw_data', nullable: true })
  rawData: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
