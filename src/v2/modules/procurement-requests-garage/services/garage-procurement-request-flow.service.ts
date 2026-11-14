import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  AbstractTransactionalFlow,
  NO_PROCUREMENT_FLOW_EVENTS,
  type SaveAndActPort,
} from '@/v2/core/procurement-flow-core';
import type { RequestActor } from '@/v2/core/procurement-requests-core/services/abstract-purchase-request-command.service';
import { GarageProcurementRequest } from '../entities/procurement-request.entity';
import { GarageProcurementRequestCommandService } from './procurement-request-command.service';
import type {
  CreateProcurementRequestDto,
  UpdateProcurementRequestHeaderDto,
} from '../dto/procurement-request.dto';

type RequestLines = CreateProcurementRequestDto['lines'];

/** Dữ liệu lưu: đầu đề + dòng. `header` rỗng khi cập nhật chỉ đổi dòng. */
export interface SaveRequestInput {
  header: CreateProcurementRequestDto | UpdateProcurementRequestHeaderDto;
  lines: RequestLines;
}

/**
 * Orchestrator PR Garage: lưu nháp (tạo hoặc cập nhật) rồi gửi duyệt trong MỘT transaction.
 * Lỗi gửi duyệt thì rollback cả bước lưu, không để lại đề nghị nháp mồ côi.
 * Thông báo gửi sau commit ở facade (cần header đã commit).
 */
@Injectable()
export class GarageProcurementRequestFlowService extends AbstractTransactionalFlow {
  protected readonly events = NO_PROCUREMENT_FLOW_EVENTS;

  constructor(
    protected readonly dataSource: DataSource,
    private readonly command: GarageProcurementRequestCommandService,
  ) {
    super();
  }

  /** `id` null = tạo mới; có id = cập nhật đề nghị nháp. Trả về header sau khi gửi duyệt. */
  saveAndSubmit(
    id: string | null,
    input: SaveRequestInput,
    actor: RequestActor,
    approverId: string | null,
  ): Promise<GarageProcurementRequest> {
    const port: SaveAndActPort<SaveRequestInput, GarageProcurementRequest> = {
      save: async (manager, targetId, data) => {
        if (!targetId) {
          const created = await this.command.createDraft(
            actor,
            data.header as CreateProcurementRequestDto,
            data.lines,
            manager,
          );
          return { id: created.id };
        }
        await this.command.updateHeader(
          targetId,
          data.header as UpdateProcurementRequestHeaderDto,
          manager,
        );
        await this.command.replaceDraftLines(targetId, data.lines, manager);
        return { id: targetId };
      },
      act: (manager, _emit, savedId) =>
        this.command.transition(
          savedId,
          'submit',
          actor,
          undefined,
          approverId,
          manager,
        ),
    };
    return this.saveAndAct(port, id, input);
  }
}
