/**
 * Status nhỏ (công đoạn) của xe trong từng status v2 (lõi cases-core chỉ lưu mã `progressStage`).
 * Mỗi giá trị thuộc đúng một `CaseStatus`, xem `helpers/case-progress-stage.map.ts`.
 */
export enum CaseProgressStage {
  // INTAKE
  AWAITING_INSPECTION = 'AWAITING_INSPECTION',
  INSPECTED = 'INSPECTED',
  AWAITING_QUOTE = 'AWAITING_QUOTE',
  // QUOTED
  AWAITING_APPROVAL = 'AWAITING_APPROVAL',
  CUSTOMER_APPROVED = 'CUSTOMER_APPROVED',
  QUOTE_REVISION = 'QUOTE_REVISION',
  // IN_PROGRESS
  WAITING_PARTS = 'WAITING_PARTS',
  REPAIRING = 'REPAIRING',
  PAINTING = 'PAINTING',
  QC = 'QC',
  READY_FOR_DELIVERY = 'READY_FOR_DELIVERY',
  // COMPLETED
  AWAITING_PAYMENT = 'AWAITING_PAYMENT',
  DELIVERED = 'DELIVERED',
  // CANCELLED
  CUSTOMER_CANCELLED = 'CUSTOMER_CANCELLED',
  INTERNAL_CANCELLED = 'INTERNAL_CANCELLED',
}

/** Loại dòng nhật ký tiến độ xưởng (`case_progress_logs_garage.kind`). */
export enum CaseProgressLogKind {
  STAGE = 'STAGE',
  NOTE = 'NOTE',
}
