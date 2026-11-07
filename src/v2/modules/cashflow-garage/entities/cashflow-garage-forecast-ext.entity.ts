import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Thông tin riêng của dự thu/dự chi Garage, 1-1 với `cashflow_forecasts`. Bảng `cashflow_garage_forecast_ext`. */
@Entity('cashflow_garage_forecast_ext')
export class CashflowGarageForecastExt {
  @PrimaryColumn({ type: 'uuid', name: 'forecast_id' })
  forecastId: string;

  @Column({ type: 'uuid', name: 'case_id', nullable: true })
  caseId: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'license_plate',
    nullable: true,
  })
  licensePlate: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    name: 'payment_content',
    nullable: true,
  })
  paymentContent: string | null;

  /** Dấu đóng (PR cũ Đóng thủ công). Dự chi gốc CANCELLED kèm closed_at. Xem migration 20261108120000. */
  @Column({ type: 'timestamptz', name: 'closed_at', nullable: true })
  closedAt: Date | null;

  @Column({ type: 'uuid', name: 'closed_by', nullable: true })
  closedBy: string | null;

  @Column({ type: 'text', name: 'close_reason', nullable: true })
  closeReason: string | null;

  @Column({ type: 'boolean', name: 'is_auto_expected', default: false })
  isAutoExpected: boolean;

  @Column({ type: 'boolean', name: 'is_auto_commission', default: false })
  isAutoCommission: boolean;

  /** Có tính vào công nợ phiếu dịch vụ không (xem migration 20261108100000). */
  @Column({ type: 'boolean', name: 'debt_counted', default: true })
  debtCounted: boolean;

  @Column({ type: 'smallint', name: 'pnl_period_year', nullable: true })
  pnlPeriodYear: number | null;

  @Column({ type: 'smallint', name: 'pnl_period_month', nullable: true })
  pnlPeriodMonth: number | null;

  @Column({
    type: 'varchar',
    length: 20,
    name: 'pnl_commission_type',
    nullable: true,
  })
  pnlCommissionType: string | null;

  @Column({ type: 'uuid', name: 'pnl_commission_anchor_id', nullable: true })
  pnlCommissionAnchorId: string | null;

  /** Người tạo gốc dạng chữ (email/nhãn hệ thống). Chỉ dùng cho response tương thích. */
  @Column({
    type: 'varchar',
    length: 255,
    name: 'legacy_created_by',
    nullable: true,
  })
  legacyCreatedBy: string | null;

  /** Nhãn phương thức gốc, ví dụ "Chuyển khoản". Chỉ dùng cho response tương thích. */
  @Column({
    type: 'varchar',
    length: 64,
    name: 'legacy_payment_method',
    nullable: true,
  })
  legacyPaymentMethod: string | null;
}
