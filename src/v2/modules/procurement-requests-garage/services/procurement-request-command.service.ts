import { ConflictException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ApprovalEventService } from '@/v2/core/approval-core/approval-event.service';
import {
  AbstractPurchaseRequestCommandService,
  DraftHeaderPatch,
  DraftLineFields,
} from '@/v2/core/procurement-requests-core/services/abstract-purchase-request-command.service';
import type { DraftLineInput } from '@/v2/core/procurement-requests-core/services/procurement-request-engine.service';
import { GarageLineItemResolver } from '@/v2/modules/items-garage/services/garage-line-item-resolver.service';
import { GarageProcurementOrder } from '@/v2/modules/procurement-orders-garage/entities/procurement-order.entity';
import { GarageProcurementRequest } from '../entities/procurement-request.entity';
import { GarageProcurementRequestLine } from '../entities/procurement-request-line.entity';

@Injectable()
export class GarageProcurementRequestCommandService extends AbstractPurchaseRequestCommandService<
  GarageProcurementRequest,
  GarageProcurementRequestLine
> {
  protected readonly headerEntity = GarageProcurementRequest;
  protected readonly lineEntity = GarageProcurementRequestLine;
  protected readonly lineForeignKey = 'requestId' as const;
  protected readonly docType = 'GARAGE_PROCUREMENT_REQUEST';
  protected readonly numberPrefix = 'GDNM';

  constructor(
    dataSource: DataSource,
    events: ApprovalEventService,
    private readonly itemResolver: GarageLineItemResolver,
  ) {
    super(dataSource, events);
  }

  /** Chuẩn hóa mã hàng theo danh mục garage trước khi ghi dòng; mã chưa có sẽ được tạo. */
  protected prepareLines(
    manager: EntityManager,
    lines: Array<DraftLineInput & DraftLineFields>,
  ): Promise<Array<DraftLineInput & DraftLineFields>> {
    return this.itemResolver.resolveLines(manager, lines);
  }

  /**
   * Đổi chi nhánh đề nghị bị chặn khi đã có đơn mua tham chiếu, để đơn mua luôn
   * cùng chi nhánh với đề nghị nguồn. Không đổi thì không kiểm tra.
   */
  async updateHeader(
    id: string,
    patch: DraftHeaderPatch & { branchId?: string | null },
    outerManager?: EntityManager,
  ): Promise<GarageProcurementRequest> {
    const db = outerManager ?? this.dataSource;
    if (patch.branchId !== undefined) {
      const current = await db
        .getRepository(GarageProcurementRequest)
        .findOne({ where: { id } });
      const changed =
        current !== null &&
        (current.branchId ?? null) !== (patch.branchId ?? null);
      if (changed) {
        const orders = await db
          .getRepository(GarageProcurementOrder)
          .count({ where: { requestId: id } });
        if (orders > 0) {
          throw new ConflictException(
            'Đề nghị đã có đơn mua, không đổi được chi nhánh',
          );
        }
      }
    }
    return super.updateHeader(id, patch, outerManager);
  }

  /** Đơn mua garage (kể cả đã xóa mềm) giữ khóa ngoại RESTRICT tới đề nghị. */
  protected async assertNoDependentOrders(
    manager: EntityManager,
    id: string,
  ): Promise<void> {
    const count = await manager.count(GarageProcurementOrder, {
      where: { requestId: id },
    });
    if (count > 0) {
      throw new ConflictException(
        'Không xóa cứng được đề nghị đã có đơn mua tham chiếu',
      );
    }
  }
}
