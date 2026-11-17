import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { GarageDebtsAnalyticsResponse } from '../dto/garage-debts-analytics.types';
import {
  agingSumColumns,
  dueWithinDaysColumn,
  GARAGE_DEBT_BASELINE_DATE,
  PAYABLE_EXPRS as P,
  PAYMENT_BY_CASE_JOIN,
  SUPPLIER_CASE_CONDITIONS,
} from '../helpers/garage-debt-sql.helper';
import { buildAnalyticsResponse } from '../helpers/garage-debts-analytics.mapper';
import { parseDebtDate } from '../helpers/garage-debt-date.helper';

export interface DebtsAnalyticsFilter {
  branchId: string;
  dateFrom?: string;
  dateTo?: string;
}

type Row = Record<string, unknown>;
const RECEIVABLE_BAL = 'c.tien_con_phai_thanh_toan';
const RECEIVABLE_DATE = 'c.ngay_hoan_thanh_cong_viec';
/** Một dòng lãi gộp cho mỗi vụ việc (LATERAL): mã không duy nhất thì không nhân dòng. */
const CASE_FROM_GP = `FROM kgara_cases c
  LEFT JOIN LATERAL (
    SELECT g.* FROM kgara_gross_profit g
    WHERE g.vu_viec_code = c.so_chung_tu
    ORDER BY g.updated_at DESC, g.id ASC
    LIMIT 1
  ) gp ON true
  ${PAYMENT_BY_CASE_JOIN}`;

/** Điều kiện + tham số `$n` cho một biểu thức ngày; mốc theo dõi, chi nhánh, đến ngày. */
function scope(f: DebtsAnalyticsFilter, dateSql: string, branchSql: string) {
  const from =
    f.dateFrom && f.dateFrom > GARAGE_DEBT_BASELINE_DATE
      ? f.dateFrom
      : GARAGE_DEBT_BASELINE_DATE;
  const params: unknown[] = [from, f.branchId];
  let where = `${dateSql} >= $1 AND ${branchSql} = $2`;
  if (f.dateTo) {
    params.push(f.dateTo.length === 10 ? `${f.dateTo} 23:59:59.999` : f.dateTo);
    where += ` AND ${dateSql} <= $3`;
  }
  return { where, params };
}

/** Analytics công nợ garage v2: 5 truy vấn độc lập chạy song song (V1 chạy tuần tự). */
@Injectable()
export class DebtsAnalyticsService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async getAnalytics(
    input: DebtsAnalyticsFilter,
  ): Promise<GarageDebtsAnalyticsResponse> {
    const f: DebtsAnalyticsFilter = {
      ...input,
      dateFrom: parseDebtDate(input.dateFrom, 'date_from'),
      dateTo: parseDebtDate(input.dateTo, 'date_to'),
    };
    const rec = scope(f, RECEIVABLE_DATE, 'c.branch_external_id');
    const pay = scope(
      f,
      P.date,
      'COALESCE(c.branch_external_id, gp.branch_external_id)',
    );
    const recWhere = `${SUPPLIER_CASE_CONDITIONS.join(' AND ')} AND ${RECEIVABLE_DATE} IS NOT NULL AND ${rec.where}`;
    const payWhere = `${SUPPLIER_CASE_CONDITIONS.join(' AND ')} AND ${P.hasPayable} AND ${pay.where}`;
    const age = `(CURRENT_DATE - DATE(${P.date}))`;

    const [recAgg, payAgg, trend, topCust, topSupp] = await Promise.all([
      this.ds.query<Row[]>(
        `SELECT COALESCE(SUM(c.tien_co_thue),0)::numeric AS total, COALESCE(SUM(c.tien_da_thanh_toan),0)::numeric AS paid,
          COALESCE(SUM(${RECEIVABLE_BAL}),0)::numeric AS remaining,
          ${agingSumColumns(RECEIVABLE_BAL, RECEIVABLE_DATE)},
          ${dueWithinDaysColumn(RECEIVABLE_BAL, RECEIVABLE_DATE, 7, 'due_week')}
         FROM kgara_cases c WHERE ${recWhere}`,
        rec.params,
      ),
      this.ds.query<Row[]>(
        `SELECT COALESCE(SUM(${P.cost}),0)::numeric AS total, COALESCE(SUM(${P.paid}),0)::numeric AS paid,
          COALESCE(SUM(${P.balance}),0)::numeric AS remaining,
          ${agingSumColumns(P.balance, P.date)},
          ${dueWithinDaysColumn(P.balance, P.date, 7, 'due_week')}
         ${CASE_FROM_GP} WHERE ${payWhere}`,
        pay.params,
      ),
      this.ds.query<Row[]>(
        `SELECT TO_CHAR(${RECEIVABLE_DATE}, 'YYYY-MM') AS month,
          COALESCE(SUM(c.tien_da_thanh_toan),0)::numeric AS cash_in, COALESCE(SUM(${P.paid}),0)::numeric AS cash_out
         FROM kgara_cases c ${PAYMENT_BY_CASE_JOIN} WHERE ${recWhere}
         GROUP BY 1 ORDER BY 1 ASC`,
        rec.params,
      ),
      this.ds.query<Row[]>(
        `SELECT COALESCE(c.khach_hang_code,'UNKNOWN') AS partner_code,
          MAX(COALESCE(c.khach_hang_name,'Chưa xác định')) AS partner_name,
          COALESCE(SUM(c.tien_co_thue),0)::numeric AS total_amount, COALESCE(SUM(${RECEIVABLE_BAL}),0)::numeric AS balance_amount,
          COALESCE(SUM(CASE WHEN (CURRENT_DATE - DATE(${RECEIVABLE_DATE})) > 30 THEN ${RECEIVABLE_BAL} ELSE 0 END),0)::numeric AS overdue_amount,
          COALESCE(MAX(CURRENT_DATE - DATE(${RECEIVABLE_DATE})),0)::int AS max_aging_days, COUNT(c.id)::int AS case_count
         FROM kgara_cases c WHERE ${recWhere} AND ${RECEIVABLE_BAL} > 0
         GROUP BY 1 ORDER BY balance_amount DESC LIMIT 5`,
        rec.params,
      ),
      this.ds.query<Row[]>(
        `SELECT COALESCE(c.khach_hang_code, gp.raw_data->>'MaKhachHang', gp.ten_khach_hang, 'UNKNOWN') AS partner_code,
          COALESCE(c.khach_hang_name, gp.ten_khach_hang, 'Chưa xác định') AS partner_name,
          COALESCE(SUM(${P.cost}),0)::numeric AS total_amount, COALESCE(SUM(${P.balance}),0)::numeric AS balance_amount,
          COALESCE(SUM(CASE WHEN ${age} > 30 THEN ${P.balance} ELSE 0 END),0)::numeric AS overdue_amount,
          COALESCE(MAX(${age}),0)::int AS max_aging_days, COUNT(DISTINCT ${P.caseCode})::int AS case_count
         ${CASE_FROM_GP} WHERE ${payWhere}
         GROUP BY 1, 2 ORDER BY balance_amount DESC LIMIT 5`,
        pay.params,
      ),
    ]);

    return buildAnalyticsResponse(
      recAgg[0] ?? {},
      payAgg[0] ?? {},
      trend,
      topCust,
      topSupp,
    );
  }
}
