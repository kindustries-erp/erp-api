import type { EntityManager } from 'typeorm';

/**
 * Đầu vào ghi nhật ký. `docType` là mã họ chứng từ, dùng chung cho PR, PO
 * và chứng từ kho (inventory-movements-*).
 */
export interface RecordApprovalEventInput {
  docType: string;
  docId: string;
  action: string;
  fromStatus: string;
  toStatus: string;
  actorId: string;
  actorRoles: string[];
  comment?: string | null;
}

/**
 * Cổng ghi nhật ký bước duyệt cho lõi chứng từ. Luôn gọi trong cùng transaction
 * với thay đổi trạng thái của chứng từ, để nhật ký và trạng thái không lệch nhau.
 * Cài đặt cụ thể (entity, bảng) nằm ở module approval-management.
 */
export abstract class ApprovalEventRecorder {
  abstract record(
    manager: EntityManager,
    input: RecordApprovalEventInput,
  ): Promise<void>;
}
