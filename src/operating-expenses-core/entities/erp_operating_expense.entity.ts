import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ErpBranch } from '../../branches-core/entities/erp_branch.entity';
import { ErpBusinessPartner } from '../../business-partners-core/entities/erp_business_partner.entity';

@Entity({ name: 'erp_operating_expenses' })
export class ErpOperatingExpense {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, name: 'expense_no' })
  expenseNo: string;

  @Column({ type: 'uuid', name: 'branch_id', nullable: true })
  branchId: string | null;

  @ManyToOne(() => ErpBranch)
  @JoinColumn({ name: 'branch_id' })
  branch?: ErpBranch;

  @Column({ type: 'uuid', name: 'supplier_id', nullable: true })
  supplierId: string | null;

  @ManyToOne(() => ErpBusinessPartner)
  @JoinColumn({ name: 'supplier_id' })
  supplier?: ErpBusinessPartner;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'supplier_name_snapshot',
    nullable: true,
  })
  supplierNameSnapshot: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'expense_category',
    nullable: true,
  })
  expenseCategory: string | null;

  @Column({ type: 'text', name: 'title', nullable: true })
  title: string | null;

  @Column({ type: 'date', name: 'document_date', nullable: true })
  documentDate: string | null;

  @Column({ type: 'date', name: 'due_date', nullable: true })
  dueDate: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'invoice_status',
    default: 'NOT_REQUIRED',
  })
  invoiceStatus: string;

  @Column({ type: 'varchar', length: 50, name: 'status', default: 'DRAFT' })
  status: string;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'payment_status',
    default: 'UNPAID',
  })
  paymentStatus: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    name: 'total_amount',
    default: 0,
  })
  totalAmount: number;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'recurrence_type',
    default: 'ONE_TIME',
  })
  recurrenceType: string;

  @Column({ type: 'int', name: 'recurrence_interval', default: 1 })
  recurrenceInterval: number;

  @Column({ type: 'date', name: 'recurrence_start_date', nullable: true })
  recurrenceStartDate: string | null;

  @Column({ type: 'date', name: 'recurrence_end_date', nullable: true })
  recurrenceEndDate: string | null;

  @Column({ type: 'date', name: 'next_due_date', nullable: true })
  nextDueDate: string | null;

  @Column({ type: 'boolean', name: 'auto_generate_next', default: false })
  autoGenerateNext: boolean;

  @Column({ type: 'uuid', name: 'parent_recurring_id', nullable: true })
  parentRecurringId: string | null;

  @Column({ type: 'text', name: 'notes', nullable: true })
  notes: string | null;

  @Column({ type: 'boolean', name: 'is_deleted', default: false })
  isDeleted: boolean;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: string;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt: string;
}
