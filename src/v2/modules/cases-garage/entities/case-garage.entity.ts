import { Column, Entity, Index, OneToMany, type Relation } from 'typeorm';
import { CoreSoftDeletableEntity } from '@/v2/core/base-core';
import {
  CaseOrigin,
  CaseStatus,
  DEFAULT_CASE_ACCOUNT_KEY,
} from './case-garage.enums';
import type { CaseServiceGarage } from './case-service-garage.entity';

const MONEY = {
  type: 'numeric',
  precision: 18,
  scale: 2,
  nullable: true,
} as const;

/**
 * Vụ việc (phiếu dịch vụ) garage v2: một dòng cho mỗi xe vào xưởng.
 * Tên property là camelCase tiếng Anh; cột DB là snake_case tương ứng (từ điển trong `kgara-case.field-map`).
 * Xe `KGARA_SYNC` dùng cùng `id` với `kgara_cases.id` và chỉ sửa được nhóm ERP-local.
 */
@Entity('cases_garage')
@Index('UQ_cases_garage_legacy_case_id', ['legacyCaseId'], { unique: true })
@Index('UQ_cases_garage_external_id', ['externalId'], {
  unique: true,
  where: '"external_id" IS NOT NULL',
})
@Index(
  'UQ_cases_garage_case_code_active',
  ['branchExternalId', 'accountKey', 'caseCode'],
  {
    unique: true,
    where: '"is_deleted" = false AND "external_deleted_at" IS NULL',
  },
)
export class CaseGarage extends CoreSoftDeletableEntity {
  // ── Định danh và nguồn ────────────────────────────────────────────────────
  @Index()
  @Column({ type: 'varchar', length: 20, default: CaseOrigin.NATIVE })
  origin: CaseOrigin;

  /** `kgara_cases.id` của xe sync; null với xe nhập tay. */
  @Column({ type: 'uuid', name: 'legacy_case_id', nullable: true })
  legacyCaseId: string | null;

  /** HdPhieuDichVuID của KGara; null với xe nhập tay. */
  @Column({ type: 'varchar', length: 100, name: 'external_id', nullable: true })
  externalId: string | null;

  /** Số chứng từ (V1 `so_chung_tu`). */
  @Index()
  @Column({ type: 'varchar', length: 100, name: 'case_code' })
  caseCode: string;

  // ── Chi nhánh (giống V1: chi nhánh KGara + tài khoản) ─────────────────────
  @Index()
  @Column({ type: 'varchar', length: 100, name: 'branch_external_id' })
  branchExternalId: string;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'account_key',
    default: DEFAULT_CASE_ACCOUNT_KEY,
  })
  accountKey: string;

  /** Chi nhánh hệ thống (`branches_management`), nối qua bảng liên kết nguồn ngoài; FK ở migration. */
  @Column({ type: 'uuid', name: 'branch_id', nullable: true })
  branchId: string | null;

  // ── Xe ────────────────────────────────────────────────────────────────────
  @Column({
    type: 'varchar',
    length: 50,
    name: 'license_plate',
    nullable: true,
  })
  licensePlate: string | null;

  /** Số khung (VIN). */
  @Index()
  @Column({
    type: 'varchar',
    length: 100,
    name: 'chassis_number',
    nullable: true,
  })
  chassisNumber: string | null;

  @Index()
  @Column({
    type: 'varchar',
    length: 100,
    name: 'vehicle_brand_code',
    nullable: true,
  })
  vehicleBrandCode: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'vehicle_brand_name',
    nullable: true,
  })
  vehicleBrandName: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    name: 'vehicle_model_code',
    nullable: true,
  })
  vehicleModelCode: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'vehicle_model_name',
    nullable: true,
  })
  vehicleModelName: string | null;

  @Column({ type: 'smallint', name: 'manufacture_year', nullable: true })
  manufactureYear: number | null;

  // ── Khách hàng và đối tượng thanh toán ────────────────────────────────────
  @Column({
    type: 'varchar',
    length: 100,
    name: 'customer_code',
    nullable: true,
  })
  customerCode: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'customer_name',
    nullable: true,
  })
  customerName: string | null;

  /** Nguồn khách theo KGara (V1 `kgara_classification`), chỉ đọc. */
  @Column({
    type: 'varchar',
    length: 100,
    name: 'customer_source_name',
    nullable: true,
  })
  customerSourceName: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'customer_source_code',
    nullable: true,
  })
  customerSourceCode: string | null;

  @Index()
  @Column({ type: 'varchar', length: 100, name: 'payer_code', nullable: true })
  payerCode: string | null;

  @Column({ type: 'varchar', length: 255, name: 'payer_name', nullable: true })
  payerName: string | null;

  // ── Trạng thái ────────────────────────────────────────────────────────────
  @Column({ type: 'varchar', length: 30, default: CaseStatus.INTAKE })
  status: CaseStatus;

  /** Mã số gốc của KGara (0 tiếp nhận, 1 báo giá, 2 đang làm, 3 hoàn thành, 9 hủy). */
  @Column({ type: 'int', name: 'kgara_status_code', nullable: true })
  kgaraStatusCode: number | null;

  @Column({ type: 'varchar', length: 100, name: 'status_name', nullable: true })
  statusName: string | null;

  // ── Ngày ──────────────────────────────────────────────────────────────────
  @Column({ type: 'timestamptz', name: 'issued_at', nullable: true })
  issuedAt: Date | null;

  @Column({ type: 'timestamptz', name: 'received_at', nullable: true })
  receivedAt: Date | null;

  @Column({ type: 'timestamptz', name: 'completed_at', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'timestamptz', name: 'delivered_at', nullable: true })
  deliveredAt: Date | null;

  // ── Tiền (numeric giữ string theo TypeORM, response ép number) ───────────
  @Column({ ...MONEY, name: 'total_amount_with_tax' })
  totalAmountWithTax: string | null;

  @Column({ ...MONEY, name: 'paid_amount' })
  paidAmount: string | null;

  @Column({ ...MONEY, name: 'outstanding_amount' })
  outstandingAmount: string | null;

  @Column({ ...MONEY, name: 'revenue' })
  revenue: string | null;

  @Column({ ...MONEY, name: 'cost' })
  cost: string | null;

  @Column({ ...MONEY, name: 'profit' })
  profit: string | null;

  // ── ERP-local (sửa được cả ở xe sync) ─────────────────────────────────────
  @Index()
  @Column({ type: 'uuid', name: 'category_id', nullable: true })
  categoryId: string | null;

  @Index()
  @Column({ type: 'varchar', length: 100, nullable: true })
  classification: string | null;

  /** User chủ động chọn "Chưa phân loại": sync không tự gán lại. */
  @Column({
    type: 'boolean',
    name: 'classification_manually_cleared',
    default: false,
  })
  classificationManuallyCleared: boolean;

  @Column({ type: 'boolean', name: 'exclude_from_reports', default: false })
  excludeFromReports: boolean;

  @Column({ type: 'boolean', name: 'exclude_from_debt', default: false })
  excludeFromDebt: boolean;

  @Column({ type: 'text', name: 'internal_notes', nullable: true })
  internalNotes: string | null;

  // ── Xóa phía KGara (chỉ xe sync) ──────────────────────────────────────────
  @Index()
  @Column({ type: 'timestamptz', name: 'external_deleted_at', nullable: true })
  externalDeletedAt: Date | null;

  @Column({ type: 'int', name: 'external_delete_count', default: 0 })
  externalDeleteCount: number;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy: string | null;

  @OneToMany('CaseServiceGarage', (line: any) => line.case)
  services?: Relation<CaseServiceGarage[]>;
}
