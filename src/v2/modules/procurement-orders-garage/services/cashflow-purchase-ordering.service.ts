import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { assertOrderable } from '@/v2/core/procurement-requests-core/services/procurement-request-engine.service';
import { legacyPrStatus } from '@/v2/modules/cashflow-garage/helpers/legacy-pr-status';
import type {
  RequestLinkPort,
  RequestLineItem,
} from '@/v2/core/procurement-orders-core/services/request-link.port';

/** Số lượng lưu numeric(18,3): làm tròn 3 chữ số. */
const toQty = (n: number): string => String(Math.round(n * 1000) / 1000);

/**
 * Đặt hàng trên dự chi mua hàng (cashflow_forecast_lines.qty_ordered) thay cho PR cũ.
 * Cài RequestLinkPort. Trạng thái PR cũ được suy ra từ dự chi:
 * OPEN/PARTIAL/SETTLED -> APPROVED (đặt được); đã đóng (dấu đóng) -> CLOSED; còn lại -> CANCELLED/DRAFT.
 * Khóa dự chi trước, rồi các dòng, rồi mới cập nhật số lượng (cùng thứ tự với PR cũ).
 */
@Injectable()
export class CashflowPurchaseOrderingService implements RequestLinkPort {
  async reserve(
    manager: EntityManager,
    requestId: string,
    items: RequestLineItem[],
  ): Promise<void> {
    await this.apply(manager, requestId, items, 'reserve');
  }

  async release(
    manager: EntityManager,
    requestId: string,
    items: RequestLineItem[],
  ): Promise<void> {
    await this.apply(manager, requestId, items, 'release');
  }

  private async apply(
    manager: EntityManager,
    requestId: string,
    items: RequestLineItem[],
    mode: 'reserve' | 'release',
  ): Promise<void> {
    const [header] = await manager.query(
      `SELECT f.id, f.status, f.kind, e.closed_at AS "closedAt"
         FROM cashflow_forecasts f
         LEFT JOIN cashflow_garage_forecast_ext e ON e.forecast_id = f.id
        WHERE f.id = $1 AND f.is_deleted = false AND f.kind = 'PURCHASE'
        FOR UPDATE OF f`,
      [requestId],
    );
    if (!header) throw new NotFoundException('Không tìm thấy đề nghị mua');

    const lines: Array<{
      id: string;
      line_type: 'GOODS' | 'SERVICE';
      qty_requested: string;
      qty_ordered: string;
    }> = await manager.query(
      `SELECT id, line_type, qty_requested::text, qty_ordered::text
         FROM cashflow_forecast_lines
        WHERE forecast_id = $1
        FOR UPDATE`,
      [requestId],
    );

    const status = legacyPrStatus(header.status, header.closedAt);
    for (const item of items) {
      const line = lines.find((l) => l.id === item.requestLineId);
      if (!line) {
        throw new NotFoundException('Dòng đề nghị không thuộc chứng từ này');
      }
      if (item.lineType && item.lineType !== line.line_type) {
        throw new ConflictException(
          'Loại dòng đơn mua không khớp với dòng đề nghị',
        );
      }
      const qtyRequested = Number(line.qty_requested);
      const qtyOrdered = Number(line.qty_ordered);
      if (mode === 'reserve') {
        assertOrderable(status, { qtyRequested, qtyOrdered }, item.qty);
        await manager.query(
          `UPDATE cashflow_forecast_lines SET qty_ordered = $2, updated_at = now() WHERE id = $1`,
          [line.id, toQty(qtyOrdered + item.qty)],
        );
      } else {
        await manager.query(
          `UPDATE cashflow_forecast_lines SET qty_ordered = $2, updated_at = now() WHERE id = $1`,
          [line.id, toQty(Math.max(0, qtyOrdered - item.qty))],
        );
      }
    }
  }
}
