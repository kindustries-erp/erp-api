import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ErpBranch } from '../../branches-core/entities/erp_branch.entity';

@Entity({ name: 'erp_bank_accounts' })
export class ErpBankAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'branch_id' })
  branchId: string;

  @ManyToOne(() => ErpBranch)
  @JoinColumn({ name: 'branch_id' })
  branch: ErpBranch;

  @Column({ type: 'varchar', length: 50, name: 'bank_code' })
  bankCode: string;

  @Column({ type: 'varchar', length: 255, name: 'bank_name' })
  bankName: string;

  @Column({ type: 'varchar', length: 50, name: 'account_number' })
  accountNumber: string;

  @Column({ type: 'varchar', length: 255, name: 'account_name' })
  accountName: string;

  @Column({ type: 'varchar', length: 10, name: 'currency', default: 'VND' })
  currency: string;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', name: 'is_deleted', default: false })
  isDeleted: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
