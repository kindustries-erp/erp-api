import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { KgaraCase } from './kgara_case.entity';
import { KgaraGrossProfit } from './kgara_gross_profit.entity';
// Import ErpInvoice if it's available in this context, otherwise we just store the UUID
// import { ErpInvoice } from '../../erp-invoices-core/entities/erp_invoice.entity';

@Entity('kgara_case_linked_invoice')
export class KgaraCaseLinkedInvoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  caseDbId: string;

  @Column({ type: 'uuid', name: 'gross_profit_id', nullable: true })
  grossProfitId: string;

  @Column({ type: 'uuid' })
  invoiceId: string;

  @Column({ type: 'varchar', length: 10, default: 'IN' })
  linkType: 'IN' | 'OUT';

  @Column({ type: 'varchar', nullable: true })
  note: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => KgaraCase, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'caseDbId' })
  case: KgaraCase;

  @ManyToOne(() => KgaraGrossProfit, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'gross_profit_id' })
  grossProfit: KgaraGrossProfit;
}
