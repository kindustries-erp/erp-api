import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'gw_cases' })
export class GreenwayCase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100, name: 'external_id' })
  externalId: string;

  @Column({ type: 'varchar', length: 100, name: 'case_code', nullable: true })
  caseCode: string | null;

  @Column({ type: 'varchar', length: 255, name: 'case_name', nullable: true })
  caseName: string | null;

  @Column({ type: 'int', name: 'status_code', nullable: true })
  statusCode: number | null;

  @Column({ type: 'varchar', length: 100, name: 'status_name', nullable: true })
  statusName: string | null;

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
