import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ErpBankAccount } from './erp_bank_account.entity';

@Entity({ name: 'erp_bank_account_balances' })
export class ErpBankAccountBalance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'bank_account_id' })
  bankAccountId: string;

  @ManyToOne(() => ErpBankAccount)
  @JoinColumn({ name: 'bank_account_id' })
  bankAccount: ErpBankAccount;

  @Column({ type: 'date', name: 'period_date' })
  periodDate: Date;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 4,
    name: 'opening_balance',
    default: 0,
  })
  openingBalance: number;

  @Column({ type: 'varchar', length: 10, name: 'currency', default: 'VND' })
  currency: string;

  @Column({ type: 'text', name: 'note', nullable: true })
  note: string | null;

  @Column({ type: 'boolean', name: 'is_deleted', default: false })
  isDeleted: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
