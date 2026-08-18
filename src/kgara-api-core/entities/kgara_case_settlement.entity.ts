import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { KgaraCase } from './kgara_case.entity';
import { KgaraGrossProfit } from './kgara_gross_profit.entity';
import { ErpBankTransaction } from '../../bank-transactions-core/entities/erp_bank_transaction.entity';

@Entity('kgara_case_settlements')
@Index('IDX_case_settlements_case_id', ['caseId'])
export class KgaraCaseSettlement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'case_id' })
  caseId: string;

  @Column({ type: 'uuid', name: 'gross_profit_id', nullable: true })
  grossProfitId?: string;

  @Column({ type: 'uuid', name: 'bank_transaction_id', nullable: true })
  bankTransactionId?: string;

  @Column({ type: 'varchar', length: 20, name: 'settlement_type' })
  settlementType: 'RECEIPT' | 'PAYMENT';

  @Column({
    type: 'varchar',
    length: 30,
    name: 'source_channel',
    default: 'ON_SYSTEM',
  })
  sourceChannel: 'ON_SYSTEM' | 'OFF_SYSTEM_MANUAL';

  @Column({ type: 'varchar', length: 100, nullable: true })
  category?: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  amount: number;

  @Column({ type: 'date', name: 'trans_date', nullable: true })
  transDate?: string;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'partner_name',
    nullable: true,
  })
  partnerName?: string;

  @Column({ type: 'text', nullable: true })
  note?: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => KgaraCase, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'case_id' })
  case: KgaraCase;

  @ManyToOne(() => KgaraGrossProfit, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'gross_profit_id' })
  grossProfit?: KgaraGrossProfit;

  @ManyToOne(() => ErpBankTransaction, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'bank_transaction_id' })
  bankTransaction?: ErpBankTransaction;
}
