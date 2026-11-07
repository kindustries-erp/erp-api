import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface PaymentRequestListQuery {
  status?: string;
  page?: number;
  pageSize?: number;
}

/** Truy vấn chỉ đọc DNTT Garage: danh sách có phân trang, chi tiết kèm dòng và thực chi. */
@Injectable()
export class GaragePaymentRequestQueryService {
  constructor(private readonly dataSource: DataSource) {}

  async list(query: PaymentRequestListQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const params: unknown[] = [pageSize, (page - 1) * pageSize];
    let where = 'r.is_deleted = false';
    if (query.status) {
      params.push(query.status);
      where += ` AND r.status = $${params.length}`;
    }
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT r.id, r.code, r.status, r.partner_name AS "partnerName",
              r.supplier_id AS "supplierId", r.amount::text AS amount,
              coalesce(paid.s, 0)::text AS "paidAmount",
              (r.amount - coalesce(paid.s, 0))::text AS "remainingAmount",
              r.requires_approval AS "requiresApproval", r.created_at AS "createdAt",
              count(*) OVER() AS total
         FROM cashflow_payment_requests r
         LEFT JOIN LATERAL (
           SELECT sum(lp.amount) AS s
             FROM cashflow_payment_request_lines l
             JOIN cashflow_payment_request_line_payments lp ON lp.line_id = l.id
             JOIN cashflow_payments p ON p.id = lp.payment_id AND p.status = 'POSTED'
            WHERE l.request_id = r.id
         ) paid ON true
        WHERE ${where}
        ORDER BY r.created_at DESC
        LIMIT $1 OFFSET $2`,
      params,
    );
    const total = rows.length > 0 ? Number(rows[0].total) : 0;
    return {
      rows: rows.map(({ total: _total, ...rest }) => rest),
      total,
      page,
      pageSize,
    };
  }

  async detail(id: string) {
    const [header] = await this.dataSource.query(
      `SELECT r.*, r.amount::text AS amount
         FROM cashflow_payment_requests r
        WHERE r.id = $1 AND r.is_deleted = false`,
      [id],
    );
    if (!header) {
      throw new NotFoundException('Không tìm thấy đề nghị thanh toán');
    }

    const lines = await this.dataSource.query(
      `SELECT l.id, l.ref_type AS "refType", l.ref_id AS "refId",
              l.amount::text AS amount,
              po.order_no AS "orderNo", po.status AS "orderStatus",
              po.payment_status AS "orderPaymentStatus",
              coalesce((SELECT sum(lp.amount)
                          FROM cashflow_payment_request_line_payments lp
                          JOIN cashflow_payments p ON p.id = lp.payment_id AND p.status = 'POSTED'
                         WHERE lp.line_id = l.id), 0)::text AS "paidAmount"
         FROM cashflow_payment_request_lines l
         LEFT JOIN erp_garage_proc_orders po
                ON po.id = l.ref_id AND l.ref_type = 'GARAGE_PO'
        WHERE l.request_id = $1
        ORDER BY l.created_at, l.id`,
      [id],
    );

    const payments = await this.dataSource.query(
      `SELECT p.id, p.code, p.amount::text AS amount, p.trans_date AS "transDate",
              p.channel, p.status, p.note, p.created_at AS "createdAt"
         FROM cashflow_payments p
        WHERE p.payment_request_id = $1
        ORDER BY p.created_at, p.id`,
      [id],
    );

    return { ...header, lines, payments };
  }
}
