import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { countVehiclesSql } from '@/common/utils/vehicle-count-sql';
import { CaseGarage } from '../../cases-garage/entities/case-garage.entity';
import {
  CASE_DASHBOARD_CLASSES,
  CASE_DASHBOARD_FUNNEL_STAGES,
  type CaseDashboardFunnelBucketRaw,
  type CaseDashboardFunnelDto,
  type CaseDashboardFunnelRaw,
} from '../dto/case-dashboard.types';
import { toFunnelDto } from '../helpers/case-dashboard.mapper';
import {
  BASE_FILTER,
  CLASS_SQL,
  PERIOD_DATE,
  STAGE_SQL,
  VEHICLE_KEY,
  applySelects,
  stageAlias,
  type SelectPart,
} from '../helpers/case-dashboard.sql';
import type { CaseDashboardDateRange } from './case-dashboard-kpi-query.service';

/** Nhóm theo tháng của ngày xếp kỳ (YYYY-MM). */
const MONTH_KEY: SelectPart = {
  alias: 'month',
  expr: `TO_CHAR(${PERIOD_DATE}, 'YYYY-MM')`,
};

/** Nhóm theo bốn phân loại ERP (khớp `classOfCase`). */
const CLASS_KEY: SelectPart = {
  alias: 'classificationKey',
  expr: `CASE WHEN ${CLASS_SQL.SUA_CHUA_CHUNG} THEN 'SUA_CHUA_CHUNG' WHEN ${CLASS_SQL.KY_GUI_NOI_BO} THEN 'KY_GUI_NOI_BO' WHEN ${CLASS_SQL.OJ_NGOAI} THEN 'OJ_NGOAI' ELSE 'KHAC' END`,
};

/** Các số liệu của một nhóm phễu: tổng xe/lệnh/tiền và xe/tiền theo từng giai đoạn. */
function bucketSelectParts(): SelectPart[] {
  const parts: SelectPart[] = [
    { alias: 'totalVehicles', expr: countVehiclesSql(VEHICLE_KEY) },
    { alias: 'totalCases', expr: 'COUNT(c.id)' },
    {
      alias: 'totalAmount',
      expr: 'SUM(COALESCE(c.total_amount_with_tax, 0))',
    },
  ];
  for (const stage of CASE_DASHBOARD_FUNNEL_STAGES) {
    const cond = STAGE_SQL[stage];
    parts.push(
      {
        alias: stageAlias(stage, 'vehicles'),
        expr: countVehiclesSql(VEHICLE_KEY, cond),
      },
      {
        alias: stageAlias(stage, 'amount'),
        expr: `SUM(CASE WHEN ${cond} THEN COALESCE(c.total_amount_with_tax, 0) ELSE 0 END)`,
      },
    );
  }
  return parts;
}

/** Đọc một dòng kết quả thành nhóm phễu thô (đầu vào của mapper). */
function toBucketRaw(
  row: Record<string, unknown> | undefined,
): CaseDashboardFunnelBucketRaw {
  const r = row ?? {};
  const stages: NonNullable<CaseDashboardFunnelBucketRaw['stages']> = {};
  for (const stage of CASE_DASHBOARD_FUNNEL_STAGES) {
    stages[stage] = {
      vehicles: r[stageAlias(stage, 'vehicles')],
      amount: r[stageAlias(stage, 'amount')],
    };
  }
  return {
    totalVehicles: r.totalVehicles,
    totalCases: r.totalCases,
    totalAmount: r.totalAmount,
    stages,
  };
}

/**
 * Phễu dashboard garage V2 (đọc `cases_garage`). Ba truy vấn độc lập:
 * toàn kỳ, theo tháng, theo phân loại. Tổng toàn kỳ là distinct trên cả kỳ,
 * không cộng dồn các tháng (một xe có lệnh ở nhiều tháng chỉ đếm một lần).
 */
@Injectable()
export class CaseDashboardFunnelQueryService {
  constructor(
    @InjectRepository(CaseGarage)
    private readonly cases: Repository<CaseGarage>,
  ) {}

  async getFunnel(
    range: CaseDashboardDateRange,
  ): Promise<CaseDashboardFunnelDto> {
    const overall = await this.bucketQuery(range, null).getRawOne();
    const monthRows = await this.bucketQuery(range, MONTH_KEY).getRawMany();
    const classRows = await this.bucketQuery(range, CLASS_KEY).getRawMany();

    const byMonth: CaseDashboardFunnelRaw['byMonth'] = {};
    for (const row of monthRows) {
      byMonth[String(row.month)] = toBucketRaw(row);
    }
    const byClassification: CaseDashboardFunnelRaw['byClassification'] = {};
    for (const row of classRows) {
      const key = String(row.classificationKey);
      if ((CASE_DASHBOARD_CLASSES as readonly string[]).includes(key)) {
        byClassification[key as (typeof CASE_DASHBOARD_CLASSES)[number]] =
          toBucketRaw(row);
      }
    }

    return toFunnelDto({
      overall: toBucketRaw(overall),
      byMonth,
      byClassification,
    });
  }

  /** `key` = null cho tổng toàn kỳ (một dòng, không GROUP BY). */
  private bucketQuery(
    range: CaseDashboardDateRange,
    key: SelectPart | null,
  ): SelectQueryBuilder<CaseGarage> {
    const parts = key ? [key, ...bucketSelectParts()] : bucketSelectParts();
    const qb = applySelects(this.cases.createQueryBuilder('c'), parts)
      .where(BASE_FILTER)
      .andWhere(`${PERIOD_DATE} >= :start AND ${PERIOD_DATE} <= :end`, {
        start: range.start,
        end: range.end,
      });
    if (key) qb.groupBy('1');
    return qb;
  }
}
