import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'sinvoice_configs' })
export class SinvoiceConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 32,
    name: 'supplier_tax_code',
    nullable: true,
  })
  supplierTaxCode: string | null;

  @Column({ type: 'varchar', length: 255, name: 'username', nullable: true })
  username: string | null;

  @Column({ type: 'varchar', length: 255, name: 'password', nullable: true })
  password: string | null;

  @Column({ type: 'varchar', length: 255, name: 'app_key', nullable: true })
  appKey: string | null;

  @Column({
    type: 'varchar',
    length: 500,
    name: 'api_url',
    nullable: true,
    default:
      'https://api-vinvoice.viettel.vn/services/einvoiceapplication/api/',
  })
  apiUrl: string | null;

  @Column({
    type: 'varchar',
    length: 32,
    name: 'environment',
    nullable: true,
    default: 'production',
  })
  environment: string | null;

  @Column({ type: 'boolean', name: 'is_active', default: false })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
