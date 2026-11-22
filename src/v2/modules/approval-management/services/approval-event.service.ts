import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  ApprovalEventRecorder,
  RecordApprovalEventInput,
} from '@/v2/core/approval-core/approval-event.recorder';
import { ApprovalEvent } from '../entities/approval-event.entity';

/** Cài đặt cụ thể của cổng ghi nhật ký: lưu vào bảng erp_approval_events. */
@Injectable()
export class ApprovalEventService extends ApprovalEventRecorder {
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
