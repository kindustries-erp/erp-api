import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Thực chi nào trả cho dòng DNTT nào. Căn cứ để tính payment_status của chứng từ nguồn (PO).
 * Bảng `cashflow_payment_request_line_payments` (migration 20261108110000).
 */
@Entity('cashflow_payment_request_line_payments')
export class CashflowPaymentRequestLinePayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'payment_id' })
  paymentId: string;

  @Column({ type: 'uuid', name: 'line_id' })
  lineId: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, name: 'amount' })
  amount: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
