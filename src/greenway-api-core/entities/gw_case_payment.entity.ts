import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'gw_case_payments' })
export class GreenwayCasePayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100, name: 'external_id' })
  externalId: string;

  @Index()
  @Column({ type: 'varchar', length: 100, name: 'case_external_id' })
  caseExternalId: string;

  @Column({
    type: 'varchar',
    length: 100,
    name: 'payment_method',
    nullable: true,
  })
  paymentMethod: string | null;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 2,
    name: 'amount',
    nullable: true,
  })
  amount: number | null;

  @Column({ type: 'timestamp', name: 'payment_date', nullable: true })
  paymentDate: Date | null;

  @Column({ type: 'jsonb', name: 'raw_data', nullable: true })
  rawData: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
