import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { ApprovalEvent } from '@/v2/core/approval-core/entities/approval-event.entity';
import {
  ForecastPrLineRow,
  ForecastPrRow,
  LegacyPrHeader,
  toLegacyPrHeader,
  toLegacyPrLine,
} from './legacy-purchase-request.mapper';

/** Mã loại chứng từ PR cũ và dự chi PR mới, cùng id đề nghị. Đọc nhật ký duyệt cả hai. */
export const LEGACY_PR_APPROVAL_DOC_TYPES = [
  'GARAGE_PROCUREMENT_REQUEST',
  'CASHFLOW_FORECAST_OUT',
] as const;

export interface LegacyPrListQuery {
  status?: string;
  branchId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

/** Điều kiện SQL cho từng trạng thái PR cũ (ngược với legacyPrStatus). */
const STATUS_SQL: Record<string, string> = {
  DRAFT: `f.status IN ('DRAFT', 'REJECTED')`,
  PENDING_APPROVAL: `f.status = 'PENDING_APPROVAL'`,
  APPROVED: `f.status IN ('OPEN', 'PARTIAL', 'SETTLED') AND e.closed_at IS NULL`,
  CLOSED: `e.closed_at IS NOT NULL`,
  CANCELLED: `f.status = 'CANCELLED' AND e.closed_at IS NULL`,
};

const LINE_SELECT_ALL = `
  SELECT l.forecast_id AS "forecastId", l.id, l.line_no AS "lineNo", l.line_type AS "lineType",
         l.item_id AS "itemId", l.item_code AS "itemCode", l.item_name AS "itemName",
         l.description, l.notes,
         l.qty_requested::text AS "qtyRequested", l.qty_ordered::text AS "qtyOrdered",
         l.unit_price::text AS "unitPrice", l.amount::text AS amount
    FROM cashflow_forecast_lines l
   WHERE l.forecast_id = ANY($1::uuid[])
   ORDER BY l.line_no, l.id`;

const FROM_SQL = `
  FROM cashflow_forecasts f
  LEFT JOIN cashflow_garage_forecast_ext e ON e.forecast_id = f.id`;

const HEADER_SELECT = `
  SELECT f.id, f.code, f.status, f.branch_id AS "branchId", f.amount::text AS amount,
         f.planned_date::text AS "plannedDate", f.created_at AS "createdAt",
         f.created_by AS "createdBy", f.title, f.requester_employee_id AS "requesterEmployeeId",
         f.note, f.submitted_by AS "submittedBy", f.approved_by AS "approvedBy",
         f.approver_id AS "approverId", f.rejected_by AS "rejectedBy",
         f.reject_reason AS "rejectReason", e.closed_at AS "closedAt", e.close_reason AS "closeReason"
  ${FROM_SQL}`;

/**
 * Đọc đề nghị mua hàng từ dự chi PURCHASE (chỉ đọc). Trả về dạng header/dòng PR cũ
 * để facade giữ nguyên response. Không ghi gì.
 */
@Injectable()
export class LegacyPurchaseRequestQueryService {
  constructor(private readonly dataSource: DataSource) {}

  async list(query: LegacyPrListQuery): Promise<{
    rows: LegacyPrHeader[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.max(1, Math.min(200, query.pageSize ?? 20));
    // Tham số lọc đánh số trước; LIMIT/OFFSET đứng cuối, nên đếm và lấy trang dùng chung danh sách này.
    const params: unknown[] = [];
    const where = [`f.kind = 'PURCHASE'`, `f.is_deleted = false`];

    if (query.status) {
      const cond = STATUS_SQL[query.status];
      if (!cond) return { rows: [], total: 0, page, pageSize };
      where.push(`(${cond})`);
    }
    if (query.branchId) {
      params.push(query.branchId);
      where.push(`f.branch_id = $${params.length}`);
    }
    const keyword = query.search?.trim();
    if (keyword) {
      params.push(`%${keyword}%`);
      const p = `$${params.length}`;
      where.push(
        `(f.code ILIKE ${p} OR f.title ILIKE ${p} OR f.note ILIKE ${p})`,
      );
    }
    const whereSql = where.join(' AND ');

    const [countRow] = await this.dataSource.query(
      `SELECT count(*)::int AS n ${FROM_SQL} WHERE ${whereSql}`,
      params,
    );
    const rows: ForecastPrRow[] = await this.dataSource.query(
      `${HEADER_SELECT}
        WHERE ${whereSql}
        ORDER BY f.created_at DESC, f.id
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, (page - 1) * pageSize],
    );
    // Dòng của cả trang trong một truy vấn, để tính tiến độ đặt hàng cho từng đề nghị.
    const ids = rows.map((r) => r.id);
    const lineRows: Array<ForecastPrLineRow & { forecastId: string }> =
      ids.length === 0
        ? []
        : await this.dataSource.query(LINE_SELECT_ALL, [ids]);
    const linesById = new Map<string, ReturnType<typeof toLegacyPrLine>[]>();
    for (const { forecastId, ...line } of lineRows) {
      const list = linesById.get(forecastId) ?? [];
      list.push(toLegacyPrLine(line));
      linesById.set(forecastId, list);
    }
    return {
      rows: rows.map((r) => toLegacyPrHeader(r, linesById.get(r.id) ?? [])),
      total: countRow?.n ?? 0,
      page,
      pageSize,
    };
  }

  async findOne(id: string): Promise<{
    header: LegacyPrHeader;
    lines: ReturnType<typeof toLegacyPrLine>[];
  }> {
    const [row] = await this.dataSource.query(
      `${HEADER_SELECT}
        WHERE f.id = $1 AND f.kind = 'PURCHASE' AND f.is_deleted = false`,
      [id],
    );
    if (!row) throw new NotFoundException('Không tìm thấy đề nghị mua');

    const lineRows: ForecastPrLineRow[] = await this.dataSource.query(
      `SELECT l.id, l.line_no AS "lineNo", l.line_type AS "lineType",
              l.item_id AS "itemId", l.item_code AS "itemCode", l.item_name AS "itemName",
              l.description, l.notes,
              l.qty_requested::text AS "qtyRequested", l.qty_ordered::text AS "qtyOrdered",
              l.unit_price::text AS "unitPrice", l.amount::text AS amount
         FROM cashflow_forecast_lines l
        WHERE l.forecast_id = $1
        ORDER BY l.line_no, l.id`,
      [id],
    );
    const lines = lineRows.map(toLegacyPrLine);
    return { header: toLegacyPrHeader(row, lines), lines };
  }

  /** Nhật ký duyệt của đề nghị, đọc cả bản ghi cũ (GARAGE_PROCUREMENT_REQUEST) và bản mới. */
  async approvalEvents(id: string): Promise<ApprovalEvent[]> {
    return this.dataSource.getRepository(ApprovalEvent).find({
      where: { docType: In([...LEGACY_PR_APPROVAL_DOC_TYPES]), docId: id },
      order: { createdAt: 'ASC' },
    });
  }
}
