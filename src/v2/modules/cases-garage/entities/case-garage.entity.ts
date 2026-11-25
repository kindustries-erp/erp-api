import { Column, Entity, Index, OneToMany, type Relation } from 'typeorm';
import { BaseCaseEntity } from '@/v2/core/cases-core';
import {
  CaseOrigin,
  CaseStatus,
  DEFAULT_CASE_ACCOUNT_KEY,
} from './case-garage.enums';
import type { CaseLineGarage } from './case-line-garage.entity';

/**
 * Vụ việc (phiếu dịch vụ) garage v2: một dòng cho mỗi xe vào xưởng. Kế thừa `BaseCaseEntity` (cases-core).
 * Tên property là camelCase tiếng Anh; cột DB là snake_case tương ứng (từ điển trong `kgara-case.field-map`).
 * Xe `KGARA_SYNC` dùng cùng `id` với `kgara_cases.id`. Mọi field (trừ định danh/nguồn và tiền suy ra từ công nợ)
 * sửa được ở v2: giá trị sửa nằm ở cột hiệu lực + `overrides`, giá trị KGara nằm ở `sourceSnapshot`.
 */
@Entity('cases_garage')
@Index('UQ_cases_garage_external_id', ['externalId'], {
  unique: true,
  where: '"external_id" IS NOT NULL',
})
@Index('UQ_cases_garage_case_code_active', ['accountKey', 'caseCode'], {
  unique: true,
  where: '"is_deleted" = false AND "external_deleted_at" IS NULL',
})
@Index('IDX_cases_garage_branch_tracked', ['branchId', 'workshopTrackedAt'], {
  where: '"workshop_tracked_at" IS NOT NULL',
})
export class CaseGarage extends BaseCaseEntity<CaseStatus> {
  // ── Định danh và nguồn ────────────────────────────────────────────────────
  @Index()
  @Column({ type: 'varchar', length: 20, default: CaseOrigin.NATIVE })
  origin: CaseOrigin;

  /** HdPhieuDichVuID của KGara; null với xe nhập tay. */
  @Column({ type: 'varchar', length: 100, name: 'external_id', nullable: true })
  externalId: string | null;

  // ── Nguồn KGara (chỉ dùng khi đồng bộ; lọc chi nhánh dùng `branchId` ERP) ──
  /** Đơn vị KGara (DonViID) của phiếu sync; null với xe nhập tay. GR/GN dùng chung UUID nên không dùng để lọc. */
  @Index()
  @Column({
    type: 'varchar',
    length: 100,
    name: 'branch_external_id',
    nullable: true,
  })
  branchExternalId: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'account_key',
    default: DEFAULT_CASE_ACCOUNT_KEY,
  })
  accountKey: string;

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

  /** Mã số gốc của KGara (0 tiếp nhận, 1 báo giá, 2 đang làm, 3 hoàn thành, 9 hủy). */
  @Column({ type: 'int', name: 'kgara_status_code', nullable: true })
  kgaraStatusCode: number | null;

  @Column({ type: 'varchar', length: 100, name: 'status_name', nullable: true })
  statusName: string | null;

  // ── Quy tắc báo cáo ───────────────────────────────────────────────────────
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

  // ── Xóa phía KGara (chỉ xe sync) ──────────────────────────────────────────
  @Index()
  @Column({ type: 'timestamptz', name: 'external_deleted_at', nullable: true })
  externalDeletedAt: Date | null;

  // ── Nhóm tiến độ riêng garage ─────────────────────────────────────────────
  @Column({
    type: 'varchar',
    length: 100,
    name: 'advisor_code',
    nullable: true,
  })
  advisorCode: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'advisor_name',
    nullable: true,
  })
  advisorName: string | null;

  // ── Bảng tiến độ xưởng ────────────────────────────────────────────────────
  /** Thời điểm nhân viên xưởng đưa xe vào bảng tiến độ; NULL là không có trên bảng. */
  @Column({ type: 'timestamptz', name: 'workshop_tracked_at', nullable: true })
  workshopTrackedAt: Date | null;

  /** Người đưa xe vào bảng (`users.id`, trỏ mềm, không FK). */
  @Column({ type: 'uuid', name: 'workshop_tracked_by', nullable: true })
  workshopTrackedBy: string | null;

  // ── Override v2 trên dữ liệu sync ─────────────────────────────────────────
  /** Giá trị mới nhất sync từ v1 (khóa camelCase). */
  @Column({ type: 'jsonb', name: 'source_snapshot', default: () => "'{}'" })
  sourceSnapshot: Record<string, unknown>;

  /** Tập field đã sửa ở v2 (khóa camelCase → true). */
  @Column({ type: 'jsonb', name: 'overrides', default: () => "'{}'" })
  overrides: Record<string, true>;

  @OneToMany('CaseLineGarage', (line: any) => line.case)
  services?: Relation<CaseLineGarage[]>;
}
