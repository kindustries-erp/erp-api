import { Column, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

/** Cột nền của sổ giao dịch tồn. Module sở hữu khai báo bảng (xem BaseStockBalanceEntity). */
export abstract class BaseStockTransactionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 32, name: 'ledger_scope' })
  ledgerScope: string;

  @Column({ type: 'uuid', nullable: true, name: 'branch_id' })
  branchId: string | null;

  @Column({ type: 'varchar', length: 128, name: 'item_code' })
  itemCode: string;

  /** RECEIPT | ISSUE | ADJUSTMENT, kèm _CANCEL khi là bút toán đảo. */
  @Column({ type: 'varchar', length: 40, name: 'transaction_type' })
  transactionType: string;

  @Column({ type: 'varchar', length: 64, name: 'document_type' })
  documentType: string;

  @Column({ type: 'uuid', name: 'document_id' })
  documentId: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 3,
    name: 'qty_in',
    default: 0,
  })
  qtyIn: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 3,
    name: 'qty_out',
    default: 0,
  })
  qtyOut: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    name: 'unit_cost',
    default: 0,
  })
  unitCost: string;

  @Column({ type: 'timestamptz', name: 'transaction_date' })
  transactionDate: Date;

  @Column({ type: 'uuid', nullable: true, name: 'created_by' })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
