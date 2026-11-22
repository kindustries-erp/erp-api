/** Công đoạn sửa chữa hiện tại của xe (lõi cases-core chỉ lưu mã `progressStage`). */
export enum CaseProgressStage {
  WAITING_PARTS = 'WAITING_PARTS',
  REPAIRING = 'REPAIRING',
  PAINTING = 'PAINTING',
  QC = 'QC',
  READY_FOR_DELIVERY = 'READY_FOR_DELIVERY',
}
