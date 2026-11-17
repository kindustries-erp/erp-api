import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { buildPagination } from '@/common/utils/paginated-result';
import { toMoney } from '@/v2/core/debts-core';
import type {
  TimeHorizonCaseItem,
  TimeHorizonCasesResponse,
} from '../dto/time-horizon-cases.types';
import {
  GARAGE_DEBT_BASELINE_DATE,
  SUPPLIER_CASE_CONDITIONS,
} from '../helpers/garage-debt-sql.helper';
import {
  getHorizonCaseSqlCondition,
  getHorizonTitle,
} from '../helpers/garage-debts-horizon.helper';
import { parseDebtDate } from '../helpers/garage-debt-date.helper';

export interface TimeHorizonCasesFilter {
  horizon: string;
  branchId: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: string;
}

/** Cột sắp xếp cho phép (alias SQL). Giá trị lạ dùng `agingDays`. */
const SORT_COLUMNS: Record<string, string> = {
  agingDays: '"agingDays"',
  totalAmount: '"totalAmount"',
  balanceAmount: '"balanceAmount"',
  completionDate: '"completionDate"',
  soChungTu: '"soChungTu"',
  customerName: '"customerName"',
};

type Row = Record<string, unknown>;
const num = (v: unknown) => toMoney(v as string | number | null);
const str = (v: unknown) => (typeof v === 'string' ? v : null);

/** Danh sách vụ việc còn nợ theo mốc thời gian (drawer analytics). Chỉ phải thu, như V1. */
@Injectable()
export class TimeHorizonCasesService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async findCases(
    input: TimeHorizonCasesFilter,
  ): Promise<TimeHorizonCasesResponse> {
    const f: TimeHorizonCasesFilter = {
      ...input,
      dateFrom: parseDebtDate(input.dateFrom, 'date_from'),
      dateTo: parseDebtDate(input.dateTo, 'date_to'),
    };
    const page = Math.max(1, Math.floor(f.page ?? 1) || 1);
    const pageSize = Math.min(
      200,
      Math.max(1, Math.floor(f.pageSize ?? 20) || 20),
    );
    const from =
      f.dateFrom && f.dateFrom > GARAGE_DEBT_BASELINE_DATE
        ? f.dateFrom
        : GARAGE_DEBT_BASELINE_DATE;

    const params: unknown[] = [from, f.branchId];
    const conds = [
      ...SUPPLIER_CASE_CONDITIONS,
      'c.ngay_hoan_thanh_cong_viec IS NOT NULL',
      'c.ngay_hoan_thanh_cong_viec >= $1',
      'c.branch_external_id = $2',
      getHorizonCaseSqlCondition(f.horizon, 'c'),
    ];
    if (f.dateTo) {
      params.push(
        f.dateTo.length === 10 ? `${f.dateTo} 23:59:59.999` : f.dateTo,
      );
      conds.push(`c.ngay_hoan_thanh_cong_viec <= $${params.length}`);
    }
    if (f.search) {
      params.push(`%${f.search}%`);
      const n = params.length;
      conds.push(
        `(c.so_chung_tu ILIKE $${n} OR c.khach_hang_name ILIKE $${n} OR c.bien_so_xe ILIKE $${n})`,
      );
    }
    const where = conds.join(' AND ');
    const sort = SORT_COLUMNS[f.sortBy ?? ''] ?? SORT_COLUMNS.agingDays;
    const dir = (f.sortOrder ?? '').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const [sumRows, items, top] = await Promise.all([
      this.ds.query<Row[]>(
        `SELECT COALESCE(SUM(c.tien_co_thue),0)::numeric AS total, COALESCE(SUM(c.tien_da_thanh_toan),0)::numeric AS paid,
          COALESCE(SUM(c.tien_con_phai_thanh_toan),0)::numeric AS balance, COUNT(c.id)::int AS cnt
         FROM kgara_cases c WHERE ${where}`,
        params,
      ),
      this.ds.query<Row[]>(
        `SELECT c.id, c.hd_phieu_dich_vu_id AS "caseId", c.so_chung_tu AS "soChungTu", c.bien_so_xe AS "bienSoXe",
          c.khach_hang_code AS "customerCode", c.khach_hang_name AS "customerName",
          COALESCE(c.tien_co_thue,0)::numeric AS "totalAmount", COALESCE(c.tien_da_thanh_toan,0)::numeric AS "paidAmount",
          COALESCE(c.tien_con_phai_thanh_toan,0)::numeric AS "balanceAmount",
          TO_CHAR(c.ngay_hoan_thanh_cong_viec, 'YYYY-MM-DD"T"HH24:MI:SS') AS "completionDate",
          COALESCE(CURRENT_DATE - DATE(c.ngay_hoan_thanh_cong_viec),0)::int AS "agingDays",
          c.branch_external_id AS "branchExternalId", COALESCE(c.ten_tinh_trang_dich_vu,'Hoàn tất') AS status,
          COALESCE(c.erp_notes,'') AS description
         FROM kgara_cases c WHERE ${where} ORDER BY ${sort} ${dir}, c.id ASC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
        params,
      ),
      this.ds.query<Row[]>(
        `SELECT COALESCE(c.khach_hang_code,'UNKNOWN') AS code, MAX(COALESCE(c.khach_hang_name,'Khách hàng')) AS name,
          COALESCE(SUM(c.tien_con_phai_thanh_toan),0)::numeric AS balance, COUNT(c.id)::int AS cnt
         FROM kgara_cases c WHERE ${where} AND c.tien_con_phai_thanh_toan > 0
         GROUP BY 1 ORDER BY balance DESC LIMIT 5`,
        params,
      ),
    ]);

    const s = sumRows[0] ?? {};
    const balance = num(s.balance);
    const total = Number(s.cnt) || 0;
    return {
      items: items.map(toItem),
      pagination: buildPagination(page, pageSize, total),
      extraData: {
        summary: {
          horizon: f.horizon,
          horizonLabel: getHorizonTitle(f.horizon),
          receivableAmount: balance,
          receivableTotalAmount: num(s.total),
          receivedAmount: num(s.paid),
          receivableCount: total,
          topPartners: top.map((r) => ({
            partnerCode: String(r.code),
            partnerName: String(r.name),
            partnerType: 'CUSTOMER' as const,
            balanceAmount: num(r.balance),
            caseCount: Number(r.cnt) || 0,
            sharePercentage:
              balance > 0
                ? Math.round((num(r.balance) / balance) * 1000) / 10
                : 0,
          })),
        },
      },
    };
  }
}

function toItem(r: Row): TimeHorizonCaseItem {
  return {
    id: String(r.id),
    caseId: str(r.caseId),
    soChungTu: str(r.soChungTu),
    bienSoXe: str(r.bienSoXe),
    customerCode: str(r.customerCode),
    customerName: str(r.customerName),
    direction: 'OUT',
    totalAmount: num(r.totalAmount),
    paidAmount: num(r.paidAmount),
    balanceAmount: num(r.balanceAmount),
    completionDate: str(r.completionDate),
    agingDays: Number(r.agingDays) || 0,
    branchExternalId: str(r.branchExternalId),
    status: String(r.status),
    description: String(r.description),
  };
}
