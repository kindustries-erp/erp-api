import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ErpInvoice } from './erp_invoice.entity';

@Entity({ name: 'erp_einvoice_syncs' })
@Index(['companyTaxCode', 'fromDate', 'toDate'])
@Index(['status'])
export class ErpEInvoiceSync {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20, name: 'company_tax_code' })
  companyTaxCode: string;

  @Column({ type: 'varchar', length: 20, name: 'sync_type' })
  syncType: string; // 'purchase' | 'sold'

  @Column({ type: 'varchar', length: 20, name: 'query_type' })
  queryType: string; // 'query' | 'sco-query' | 'all'

  @Column({ type: 'timestamptz', name: 'from_date' })
  fromDate: Date;

  @Column({ type: 'timestamptz', name: 'to_date' })
  toDate: Date;

  @Column({ type: 'int', name: 'total_found', default: 0 })
  totalFound: number;

  @Column({ type: 'int', name: 'total_pdf_success', default: 0 })
  totalPdfSuccess: number;

  @Column({ type: 'int', name: 'total_pdf_failed', default: 0 })
  totalPdfFailed: number;

  @Column({
    type: 'varchar',
    length: 30,
    name: 'status',
    default: 'in_progress',
  })
  status: string; // 'in_progress' | 'completed' | 'failed'

  @Column({ type: 'text', name: 'error_message', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => ErpInvoice, (inv) => inv.sync)
  invoices: ErpInvoice[];
}
