import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  buildInvoicePartnerSqlParts,
  KHONG_MST,
  normalizeTaxCode,
} from '@/common/utils/invoice-partner-key.util';
import { CreateErpBusinessPartnerDto } from '../dto/create-erp-business-partner.dto';
import { nextPartnerCode } from '../helpers/erp-business-partner-code.helper';
import { ErpBusinessPartnerCommandService } from './erp-business-partner-command.service';
import { ErpBusinessPartnerQueryService } from './erp-business-partner-query.service';

export interface InvoicePartnerCandidate {
  taxCode: string;
  name: string;
  address: string | null;
  partnerType: 'CUSTOMER' | 'VENDOR';
}

interface CandidateRow {
  direction: 'IN' | 'OUT';
  taxCode: string;
  name: string;
  address: string | null;
  invoiceCount: number;
}

/**
 * Dòng người mua (HĐ OUT) và người bán (HĐ IN) có MST, gom theo (chiều, MST, tên).
 * Bỏ hóa đơn bị thay thế (status 4) và hóa đơn không có MST/CCCD.
 * Tham số $1 là chiều lọc (IN/OUT) hoặc NULL để lấy cả hai.
 */
const buildCandidateRowsSql = (): string => {
  const out = buildInvoicePartnerSqlParts('OUT');
  const inn = buildInvoicePartnerSqlParts('IN');
  return `
    SELECT src.direction, src.tax_code AS "taxCode", src.name,
           MAX(src.address) AS address, COUNT(*)::int AS "invoiceCount"
    FROM (
      SELECT 'OUT'::text AS direction, ${out.taxCodeExpr} AS tax_code,
             ${out.nameExpr} AS name, inv.buyer_address AS address
      FROM erp_invoices inv
      WHERE inv.is_deleted = false
        AND (inv.tax_invoice_status IS NULL OR inv.tax_invoice_status <> 4)
        AND inv.direction = 'OUT'
      UNION ALL
      SELECT 'IN'::text AS direction, ${inn.taxCodeExpr} AS tax_code,
             ${inn.nameExpr} AS name, inv.seller_address AS address
      FROM erp_invoices inv
      WHERE inv.is_deleted = false
        AND (inv.tax_invoice_status IS NULL OR inv.tax_invoice_status <> 4)
        AND inv.direction = 'IN'
    ) src
    WHERE src.tax_code <> '${KHONG_MST}'
      AND ($1::text IS NULL OR src.direction = $1)
    GROUP BY src.direction, src.tax_code, src.name
  `;
};

export const CANDIDATE_ROWS_SQL = buildCandidateRowsSql();

/**
 * Đồng bộ đối tác từ hóa đơn: mỗi MST một đối tác.
 * Loại đối tác theo chiều có nhiều hóa đơn hơn (hòa thì là khách hàng).
 * Tên lấy theo tên xuất hiện nhiều nhất cho MST đó.
 */
@Injectable()
export class ErpBusinessPartnerInvoiceSyncService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly query: ErpBusinessPartnerQueryService,
    private readonly command: ErpBusinessPartnerCommandService,
  ) {}

  /** Danh sách MST cần tạo đối tác (chưa có đối tác chưa xóa mềm nào trùng MST). */
  async findMissingCandidates(): Promise<InvoicePartnerCandidate[]> {
    const rows: CandidateRow[] = await this.dataSource.query(
      CANDIDATE_ROWS_SQL,
      [null],
    );
    const existing: { taxCode: string }[] = await this.dataSource.query(
      `SELECT tax_code AS "taxCode" FROM erp_business_partners
       WHERE is_deleted = false AND tax_code IS NOT NULL`,
    );
    const existingTax = new Set(
      existing.map((r) => normalizeTaxCode(r.taxCode)).filter(Boolean),
    );

    return groupCandidates(rows).filter((c) => !existingTax.has(c.taxCode));
  }

  /** Chạy đồng bộ: tạo đối tác cho từng MST còn thiếu, mã sinh theo loại (NCC-/KH-). */
  async run(): Promise<{ created: number; items: InvoicePartnerCandidate[] }> {
    const missing = await this.findMissingCandidates();
    const codesByType = new Map<string, string[]>();
    const created: InvoicePartnerCandidate[] = [];

    for (const candidate of missing) {
      // Kiểm lại ngay trước khi tạo để không tạo trùng khi có lần chạy khác
      const taken = await this.dataSource.query(
        `SELECT 1 FROM erp_business_partners
         WHERE is_deleted = false AND tax_code = $1 LIMIT 1`,
        [candidate.taxCode],
      );
      if (taken.length > 0) continue;

      if (!codesByType.has(candidate.partnerType)) {
        codesByType.set(
          candidate.partnerType,
          await this.query.findCodesForNextCode(candidate.partnerType),
        );
      }
      const codes = codesByType.get(candidate.partnerType) as string[];
      const code = nextPartnerCode(codes, candidate.partnerType);
      codes.push(code);

      const dto: CreateErpBusinessPartnerDto = {
        code,
        name: candidate.name,
        partnerType: candidate.partnerType,
        taxCode: candidate.taxCode,
        address: candidate.address ?? undefined,
        status: 'ACTIVE',
      };
      await this.command.create(dto);
      created.push(candidate);
    }

    return { created: created.length, items: created };
  }

  /**
   * Tìm hoặc tạo đối tác từ một người mua/bán trong hóa đơn (khóa: MST, không có MST thì tên).
   * Dùng khi gán Đối tượng cho sao kê; trả về id đối tác.
   */
  async ensureFromInvoiceKey(ref: {
    taxCode: string | null;
    name: string;
    partnerType: 'CUSTOMER' | 'VENDOR';
  }): Promise<string> {
    const taxCode = normalizeTaxCode(ref.taxCode);
    const name = ref.name.trim();
    const found: { id: string }[] = taxCode
      ? await this.dataSource.query(
          `SELECT id FROM erp_business_partners
           WHERE is_deleted = false AND tax_code = $1 LIMIT 1`,
          [taxCode],
        )
      : await this.dataSource.query(
          `SELECT id FROM erp_business_partners
           WHERE is_deleted = false AND tax_code IS NULL AND LOWER(name) = LOWER($1)
           LIMIT 1`,
          [name],
        );
    if (found.length > 0) return found[0].id;

    const codes = await this.query.findCodesForNextCode(ref.partnerType);
    const code = nextPartnerCode(codes, ref.partnerType);
    const created = await this.command.create({
      code,
      name,
      partnerType: ref.partnerType,
      taxCode: taxCode ?? undefined,
      status: 'ACTIVE',
    });
    return created.id;
  }
}

/** Gom dòng theo MST: loại theo chiều nhiều hóa đơn hơn, tên theo tên xuất hiện nhiều nhất. */
export const groupCandidates = (
  rows: CandidateRow[],
): InvoicePartnerCandidate[] => {
  type Acc = {
    outCount: number;
    inCount: number;
    names: Map<string, number>;
    address: string | null;
  };
  const byTax = new Map<string, Acc>();

  for (const row of rows) {
    const taxCode = normalizeTaxCode(row.taxCode);
    if (!taxCode) continue;
    const acc = byTax.get(taxCode) ?? {
      outCount: 0,
      inCount: 0,
      names: new Map<string, number>(),
      address: null,
    };
    if (row.direction === 'OUT') acc.outCount += row.invoiceCount;
    else acc.inCount += row.invoiceCount;
    acc.names.set(row.name, (acc.names.get(row.name) ?? 0) + row.invoiceCount);
    acc.address = acc.address ?? row.address ?? null;
    byTax.set(taxCode, acc);
  }

  return [...byTax.entries()].map(([taxCode, acc]) => ({
    taxCode,
    name: [...acc.names.entries()].sort((a, b) => b[1] - a[1])[0][0],
    address: acc.address,
    partnerType: acc.outCount >= acc.inCount ? 'CUSTOMER' : 'VENDOR',
  }));
};
