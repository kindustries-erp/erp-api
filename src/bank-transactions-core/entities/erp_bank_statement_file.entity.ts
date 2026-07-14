import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ErpBankAccount } from './erp_bank_account.entity';
import { ErpCashBook } from './erp_cash_book.entity';

@Entity('erp_bank_statement_files')
export class ErpBankStatementFile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'branch_id', type: 'uuid' })
  branchId: string;

  @Column({ name: 'bank_account_id', type: 'uuid', nullable: true })
  bankAccountId: string | null;

  @Column({ name: 'cash_book_id', type: 'uuid', nullable: true })
  cashBookId: string | null;

  @Column({ name: 'period_date', type: 'varchar', length: 50, nullable: true })
  periodDate: string | null;

  @Column({ name: 'file_id', type: 'uuid' })
  fileId: string;

  @Column({ name: 'note', type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  isDeleted: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => ErpBankAccount)
  @JoinColumn({ name: 'bank_account_id' })
  bankAccount: ErpBankAccount;

  @ManyToOne(() => ErpCashBook)
  @JoinColumn({ name: 'cash_book_id' })
  cashBook: ErpCashBook;
}
