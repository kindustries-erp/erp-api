import { Column, Index } from 'typeorm';
import { CoreSoftDeletableEntity } from '../../base-core/entities/core-soft-deletable.entity';

/** Loại phiếu: thu hoặc chi. */
export type CashflowVoucherType = 'RECEIPT' | 'PAYMENT';

/**
 * Trạng thái phiếu: dự thu/dự chi chưa phát sinh tiền (EXPECTED, PENDING), đã duyệt (APPROVED, có ở V1),
 * đã thu chi (PAID), hủy (CANCELLED).
 * Hủy là trạng thái, không xóa cứng (xem chính sách xóa mềm).
 */
export type CashflowVoucherStatus =
  | 'EXPECTED'
  | 'PENDING'
  | 'APPROVED'
  | 'PAID'
  | 'CANCELLED';

/**
 * Entity nền cho phiếu thu chi. KHÔNG gắn @Entity(): module con đặt tên bảng.
 * Giữ các cột `pnl_*` và `is_auto_*` của bảng cũ để báo cáo lãi lỗ đọc được qua mirror.
 */
export abstract class BaseCashflowVoucherEntity extends CoreSoftDeletableEntity {
  @Index()
  @Column({ type: 'varchar', length: 100, name: 'branch_external_id' })
  branchExternalId: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50, name: 'voucher_code' })
  voucherCode: string;

  @Index()
  @Column({ type: 'varchar', length: 20, name: 'voucher_type' })
  voucherType: CashflowVoucherType;

  @Index()
  @Column({ type: 'varchar', length: 30, default: 'PENDING' })
  status: CashflowVoucherStatus;

  @Index()
  @Column({ type: 'date', name: 'trans_date' })
  transDate: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  amount: string;

  @Index()
  @Column({ type: 'uuid', name: 'case_id', nullable: true })
  caseId?: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'license_plate',
    nullable: true,
  })
  licensePlate?: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'payment_method',
    nullable: true,
  })
  paymentMethod?: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    name: 'payment_content',
    nullable: true,
  })
  paymentContent?: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'partner_name',
    nullable: true,
  })
  partnerName?: string | null;

  /** Bên trả của phiếu thu: KH hoặc BH (bảo hiểm). */
  @Column({ type: 'varchar', length: 10, name: 'payer_type', default: 'KH' })
  payerType: string;

  @Column({ type: 'uuid', name: 'erp_bank_transaction_id', nullable: true })
  erpBankTransactionId?: string | null;

  @Column({ type: 'uuid', name: 'erp_cash_voucher_id', nullable: true })
  erpCashVoucherId?: string | null;

  @Column({ type: 'text', nullable: true })
  note?: string | null;

  /** MANUAL (nhập ở v2) hoặc LEGACY (backfill từ bảng cũ). */
  @Column({ type: 'varchar', length: 20, default: 'MANUAL' })
  source: string;

  @Column({ type: 'varchar', length: 255, name: 'created_by', nullable: true })
  createdBy?: string | null;

  @Column({ type: 'boolean', name: 'is_auto_expected', default: false })
  isAutoExpected: boolean;

  @Column({ type: 'boolean', name: 'is_auto_commission', default: false })
  isAutoCommission: boolean;

  @Column({ type: 'smallint', name: 'pnl_period_year', nullable: true })
  pnlPeriodYear?: number | null;

  @Column({ type: 'smallint', name: 'pnl_period_month', nullable: true })
  pnlPeriodMonth?: number | null;

  @Column({
    type: 'varchar',
    length: 20,
    name: 'pnl_commission_type',
    nullable: true,
  })
  pnlCommissionType?: string | null;

  @Column({ type: 'uuid', name: 'pnl_commission_anchor_id', nullable: true })
  pnlCommissionAnchorId?: string | null;
}
