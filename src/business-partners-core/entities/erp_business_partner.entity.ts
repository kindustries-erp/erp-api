import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'erp_business_partners' })
export class ErpBusinessPartner {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, name: 'code' })
  code: string;

  @Column({ type: 'varchar', length: 255, name: 'name' })
  name: string;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'display_name',
    nullable: true,
  })
  displayName: string | null;

  @Column({ type: 'varchar', length: 255, name: 'partner_type' })
  partnerType: string;

  @Column({ type: 'varchar', length: 255, name: 'tax_code', nullable: true })
  taxCode: string | null;

  @Column({ type: 'varchar', length: 255, name: 'phone', nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 255, name: 'email', nullable: true })
  email: string | null;

  @Column({ type: 'text', name: 'address', nullable: true })
  address: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'contact_name',
    nullable: true,
  })
  contactName: string | null;

  @Column({ type: 'varchar', length: 255, name: 'status', default: 'ACTIVE' })
  status: string;

  @Column({ type: 'text', name: 'notes', nullable: true })
  notes: string | null;

  @Column({ type: 'boolean', name: 'is_deleted', default: false })
  isDeleted: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
