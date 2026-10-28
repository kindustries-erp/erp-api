import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { QueryErpBusinessPartnerOptionsDto } from '../dto/query-erp-business-partner-options.dto';
import { CANDIDATE_ROWS_SQL } from './erp-business-partner-invoice-sync.service';

export interface BusinessPartnerOptionItem {
  partnerId: string | null;
  code: string | null;
  name: string;
  taxCode: string | null;
  partnerType: string | null;
  source: 'MASTER' | 'INVOICE';
}

/**
 * Danh sách chọn Đối tượng cho sao kê: đối tác trong danh mục trước,
 * sau đó là người mua/bán trong hóa đơn có MST nhưng chưa có trong danh mục.
 */
@Injectable()
export class ErpBusinessPartnerOptionsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async listOptions(dto: QueryErpBusinessPartnerOptionsDto): Promise<{
    items: BusinessPartnerOptionItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;
    const search = dto.search?.trim();
    const pattern = search ? `%${search}%` : null;

    const rows: (BusinessPartnerOptionItem & { total: string })[] =
      await this.dataSource.query(
        `
        WITH cand AS (${CANDIDATE_ROWS_SQL}),
        invoice_only AS (
          SELECT DISTINCT ON (c."taxCode")
                 NULL::text AS "partnerId", NULL::text AS code, c.name,
                 c."taxCode" AS "taxCode", NULL::text AS "partnerType",
                 'INVOICE'::text AS source
          FROM cand c
          WHERE NOT EXISTS (
            SELECT 1 FROM erp_business_partners p
            WHERE p.is_deleted = false AND p.tax_code = c."taxCode"
          )
          ORDER BY c."taxCode", c."invoiceCount" DESC
        ),
        masters AS (
          SELECT p.id::text AS "partnerId", p.code, p.name, p.tax_code AS "taxCode",
                 p.partner_type AS "partnerType", 'MASTER'::text AS source
          FROM erp_business_partners p
          WHERE p.is_deleted = false
        ),
        all_items AS (
          SELECT * FROM masters
          UNION ALL
          SELECT * FROM invoice_only
        )
        SELECT x."partnerId", x.code, x.name, x."taxCode", x."partnerType", x.source,
               COUNT(*) OVER()::text AS total
        FROM all_items x
        WHERE ($2::text IS NULL OR x.name ILIKE $2 OR x."taxCode" ILIKE $2 OR x.code ILIKE $2)
        ORDER BY (x.source = 'MASTER') DESC, x.name ASC
        LIMIT $3 OFFSET $4
        `,
        [dto.direction, pattern, pageSize, (page - 1) * pageSize],
      );

    const total = rows.length > 0 ? Number(rows[0].total) : 0;
    return {
      items: rows.map(({ total: _total, ...item }) => item),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
