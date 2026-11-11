import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  AbstractTransactionalFlow,
  NO_PROCUREMENT_FLOW_EVENTS,
  type SaveAndActPort,
} from '@/v2/core/procurement-flow-core';
import type { OrderActor } from '@/v2/core/procurement-orders-core/services/abstract-procurement-order-command.service';
import { GarageProcurementOrder } from '../entities/procurement-order.entity';
import type {
  CreateProcurementOrderDto,
  UpdateProcurementOrderHeaderDto,
} from '../dto/procurement-order.dto';
import { GarageProcurementOrderCommandService } from './procurement-order-command.service';

type OrderLines = CreateProcurementOrderDto['lines'];

/** Dữ liệu lưu: đầu đơn + dòng. */
export interface SaveOrderInput {
  header:
    | Omit<CreateProcurementOrderDto, 'lines'>
    | UpdateProcurementOrderHeaderDto;
  lines: OrderLines;
}

/**
 * Orchestrator PO Garage: lưu nháp (tạo hoặc cập nhật) rồi gửi duyệt/ghi nhận trong MỘT transaction.
 * Số lượng giữ trên PR nguồn cũng nằm trong transaction này: lỗi gửi duyệt thì rollback cả việc giữ số lượng,
 * không để lại PO nháp mồ côi chiếm phần còn lại của PR.
 */
@Injectable()
export class GarageProcurementOrderFlowService extends AbstractTransactionalFlow {
  protected readonly events = NO_PROCUREMENT_FLOW_EVENTS;

  constructor(
    protected readonly dataSource: DataSource,
    private readonly command: GarageProcurementOrderCommandService,
  ) {
    super();
  }

  /** `id` null = tạo mới; có id = cập nhật đơn nháp. Khóa duyệt tắt thì submit tự duyệt (ghi nhận). */
  saveAndSubmit(
    id: string | null,
    input: SaveOrderInput,
    actor: OrderActor,
    approverId: string | null,
  ): Promise<GarageProcurementOrder> {
    const port: SaveAndActPort<SaveOrderInput, GarageProcurementOrder> = {
      save: async (manager, targetId, data) => {
        if (!targetId) {
          const created = await this.command.createDraft(
            actor,
            data.header as Omit<CreateProcurementOrderDto, 'lines'>,
            data.lines,
            manager,
          );
          return { id: created.id };
        }
        await this.command.updateHeader(
          targetId,
          data.header as UpdateProcurementOrderHeaderDto,
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
