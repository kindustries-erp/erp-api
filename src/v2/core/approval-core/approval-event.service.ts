import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ApprovalEvent } from './entities/approval-event.entity';

/**
 * Đầu vào ghi nhật ký. `docType` là mã họ chứng từ, dùng chung cho PR, PO
 * và chứng từ kho (inventory-movements-*) trong approval-core.
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
 * Ghi một bước duyệt vào nhật ký. Luôn gọi trong cùng transaction với
 * thay đổi trạng thái của chứng từ, để nhật ký và trạng thái không lệch nhau.
 */
@Injectable()
export class ApprovalEventService {
  async record(
    manager: EntityManager,
    input: RecordApprovalEventInput,
  ): Promise<void> {
    await manager.getRepository(ApprovalEvent).insert({
      docType: input.docType,
      docId: input.docId,
      action: input.action,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      actorId: input.actorId,
      actorRoles: input.actorRoles,
      comment: input.comment ?? null,
    });
  }
}
