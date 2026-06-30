import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'gw_case_services' })
export class GreenwayCaseService {
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
    name: 'service_code',
    nullable: true,
  })
  serviceCode: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'service_name',
    nullable: true,
  })
  serviceName: string | null;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 4,
    name: 'quantity',
    nullable: true,
  })
  quantity: number | null;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 2,
    name: 'price',
    nullable: true,
  })
  price: number | null;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 2,
    name: 'total_amount',
    nullable: true,
  })
  totalAmount: number | null;

  @Column({ type: 'jsonb', name: 'raw_data', nullable: true })
  rawData: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
