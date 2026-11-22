import { Entity, Index } from 'typeorm';
import { BaseApprovalEventEntity } from '@/v2/core/approval-core/entities/base-approval-event.entity';

/**
 * Nhật ký mọi bước chuyển trạng thái của chứng từ duyệt: PR, PO (erp và garage)
 * và chứng từ kho (inventory-movements-*). Bảng chỉ ghi thêm, không sửa, không xóa.
 */
@Entity({ name: 'erp_approval_events' })
@Index('IDX_erp_approval_events_doc', ['docType', 'docId', 'createdAt'])
export class ApprovalEvent extends BaseApprovalEventEntity {}
