import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ErpBranch } from '../../branches-core/entities/erp_branch.entity';

@Entity({ name: 'erp_chart_of_accounts' })
export class ErpChartOfAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'branch_id' })
  branchId: string;

  @ManyToOne(() => ErpBranch)
  @JoinColumn({ name: 'branch_id' })
  branch: ErpBranch;

  @Column({ type: 'varchar', length: 50, name: 'account_code', unique: true })
  accountCode: string;

  @Column({ type: 'varchar', length: 255, name: 'account_name' })
  accountName: string;

  @Column({ type: 'varchar', length: 50, name: 'account_type' })
  accountType: string;

  @Column({ type: 'uuid', name: 'parent_id', nullable: true })
  parentId: string | null;

  @ManyToOne(() => ErpChartOfAccount, (account) => account.children)
  @JoinColumn({ name: 'parent_id' })
  parent: ErpChartOfAccount | null;

  @OneToMany(() => ErpChartOfAccount, (account) => account.parent)
  children: ErpChartOfAccount[];

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', name: 'is_deleted', default: false })
  isDeleted: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
