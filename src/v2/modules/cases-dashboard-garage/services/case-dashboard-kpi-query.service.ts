import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import {
  countVehiclesSql,
  vehicleKeySql,
} from '@/common/utils/vehicle-count-sql';
import { CaseGarage } from '../../cases-garage/entities/case-garage.entity';
import { CaseStatus } from '../../cases-garage/entities/case-garage.enums';
import {
  CASE_DASHBOARD_CLASSES,
  CASE_DASHBOARD_STAGES,
  CASE_DASHBOARD_STAGE_STATUS,
  type CaseDashboardClass,
  type CaseDashboardPeriodKpiDto,
  type CaseDashboardPeriodKpis,
  type CaseDashboardPeriodRaw,
  type CaseDashboardProjectedDto,
  type CaseDashboardProjectedRaw,
  type CaseDashboardStage,
} from '../dto/case-dashboard.types';
import {
  toPeriodKpiDto,
  toProjectedDto,
} from '../helpers/case-dashboard.mapper';
import {
  BASE_FILTER,
  CLASS_SQL,
  PERIOD_DATE,
  STAGE_SQL,
  VEHICLE_KEY,
  applySelects,
  classAlias,
  stageAlias,
  type SelectPart,
} from '../helpers/case-dashboard.sql';

/** Khoảng thời gian `[start, end]` (đã quy về múi giờ máy chủ bởi facade). */
export interface CaseDashboardDateRange {
  start: Date;
  end: Date;
}

export interface CaseDashboardPeriodRanges {
  month: CaseDashboardDateRange;
  week: CaseDashboardDateRange;
  day: CaseDashboardDateRange;
}

/** Lệnh đang làm (dự thu): chưa hoàn thành và chưa hủy. */
const OPEN_STATUSES: CaseStatus[] = [
  CaseStatus.INTAKE,
  CaseStatus.QUOTED,
  CaseStatus.IN_PROGRESS,
];

/**
 * Lệnh được tính vào TỔNG kỳ, đúng quy tắc V1 (dashboard checkpoint): hoàn thành trong khoảng ngày
 * (theo ngày hoàn thành, không theo ngày phát hành) và không hủy. Dùng chung tham số `:start`/`:end`.
 */
const TOTAL_IN_PERIOD = `c.completed_at >= :start AND c.completed_at <= :end AND c.status <> '${CaseStatus.CANCELLED}'`;

/** Các biểu thức SELECT của một kỳ: tổng (theo ngày hoàn thành), tiền, và theo giai đoạn/phân loại. */
function periodSelectParts(): SelectPart[] {
  const parts: SelectPart[] = [
    // Số XE khớp màn hình V1 (`stages.totalIntake`): xe trong cửa sổ ngày (mốc như giai đoạn), bỏ lệnh hủy.
    {
      alias: 'totalVehicles',
      expr: countVehiclesSql(
        VEHICLE_KEY,
        `c.status <> '${CaseStatus.CANCELLED}'`,
      ),
    },
    {
      alias: 'totalCases',
      expr: `COUNT(CASE WHEN ${TOTAL_IN_PERIOD} THEN c.id END)`,
    },
    {
      alias: 'revenue',
      expr: `SUM(CASE WHEN ${TOTAL_IN_PERIOD} THEN COALESCE(c.revenue, 0) ELSE 0 END)`,
    },
    {
      alias: 'cost',
      expr: `SUM(CASE WHEN ${TOTAL_IN_PERIOD} THEN COALESCE(c.cost, 0) ELSE 0 END)`,
    },
    {
      alias: 'profit',
      expr: `SUM(CASE WHEN ${TOTAL_IN_PERIOD} THEN COALESCE(c.profit, 0) ELSE 0 END)`,
    },
    {
      alias: 'totalAmountWithTax',
      expr: `SUM(CASE WHEN ${TOTAL_IN_PERIOD} THEN COALESCE(c.total_amount_with_tax, 0) ELSE 0 END)`,
    },
    {
      alias: 'paidAmount',
      expr: `SUM(CASE WHEN ${TOTAL_IN_PERIOD} THEN COALESCE(c.paid_amount, 0) ELSE 0 END)`,
    },
    {
      alias: 'outstandingAmount',
      expr: `SUM(CASE WHEN ${TOTAL_IN_PERIOD} THEN COALESCE(c.outstanding_amount, 0) ELSE 0 END)`,
    },
  ];
  for (const stage of CASE_DASHBOARD_STAGES) {
    const cond = STAGE_SQL[stage];
    parts.push(
      {
        alias: stageAlias(stage, 'vehicles'),
        expr: countVehiclesSql(VEHICLE_KEY, cond),
      },
      {
        alias: stageAlias(stage, 'cases'),
        expr: `COUNT(CASE WHEN ${cond} THEN c.id END)`,
      },
      {
        alias: stageAlias(stage, 'amount'),
        expr: `SUM(CASE WHEN ${cond} THEN COALESCE(c.total_amount_with_tax, 0) ELSE 0 END)`,
      },
    );
  }
  for (const cls of CASE_DASHBOARD_CLASSES) {
    const cond = CLASS_SQL[cls];
    parts.push(
      {
        alias: classAlias(cls, 'vehicles'),
        expr: countVehiclesSql(VEHICLE_KEY, cond),
      },
      {
        alias: classAlias(cls, 'cases'),
        expr: `COUNT(CASE WHEN ${cond} THEN c.id END)`,
      },
      {
        alias: classAlias(cls, 'amount'),
        expr: `SUM(CASE WHEN ${cond} THEN COALESCE(c.total_amount_with_tax, 0) ELSE 0 END)`,
      },
    );
  }
  return parts;
}

/** Đọc một dòng kết quả kỳ thành raw (đầu vào của mapper). */
function toPeriodRaw(
  row: Record<string, unknown> | undefined,
): CaseDashboardPeriodRaw {
  const r = row ?? {};
  const stages = {} as NonNullable<CaseDashboardPeriodRaw['stages']>;
  for (const stage of CASE_DASHBOARD_STAGES) {
    stages[stage] = {
      vehicles: r[stageAlias(stage, 'vehicles')],
      cases: r[stageAlias(stage, 'cases')],
      amount: r[stageAlias(stage, 'amount')],
    };
  }
  const classifications = {} as NonNullable<
    CaseDashboardPeriodRaw['classifications']
  >;
  for (const cls of CASE_DASHBOARD_CLASSES) {
    classifications[cls] = {
      vehicles: r[classAlias(cls, 'vehicles')],
      cases: r[classAlias(cls, 'cases')],
      amount: r[classAlias(cls, 'amount')],
    };
  }
  return {
    totalVehicles: r.totalVehicles,
    totalCases: r.totalCases,
    revenue: r.revenue,
    cost: r.cost,
    profit: r.profit,
    totalAmountWithTax: r.totalAmountWithTax,
    paidAmount: r.paidAmount,
    outstandingAmount: r.outstandingAmount,
    stages,
    classifications,
  };
}

/**
 * KPI dashboard garage V2 (đọc `cases_garage`). Số XE là số biển khác nhau (distinct khóa xe),
 * số lệnh và tiền cộng theo lệnh. Chỉ đọc, không ghi.
 */
@Injectable()
export class CaseDashboardKpiQueryService {
  constructor(
    @InjectRepository(CaseGarage)
    private readonly cases: Repository<CaseGarage>,
  ) {}

  /** KPI tháng/tuần/ngày và dự thu (hôm nay, cả tháng). */
  async getPeriodKpis(
    ranges: CaseDashboardPeriodRanges,
  ): Promise<CaseDashboardPeriodKpis> {
    const month = await this.periodKpi(ranges.month);
    const week = await this.periodKpi(ranges.week);
    const day = await this.periodKpi(ranges.day);
    const projectedToday = await this.projected(ranges.day);
    const projectedMonth = await this.projected(null);
    return { month, week, day, projectedToday, projectedMonth };
  }

  private async periodKpi(
    range: CaseDashboardDateRange,
  ): Promise<CaseDashboardPeriodKpiDto> {
    const qb = applySelects(
      this.cases.createQueryBuilder('c'),
      periodSelectParts(),
    )
      .where(BASE_FILTER)
      .andWhere(`${PERIOD_DATE} >= :start AND ${PERIOD_DATE} <= :end`, {
        start: range.start,
        end: range.end,
      });
    const row = await qb.getRawOne();
    return toPeriodKpiDto(toPeriodRaw(row));
  }

  /** Dự thu: `range` = null nghĩa là cả lệnh đang làm (không lọc ngày). */
  private async projected(
    range: CaseDashboardDateRange | null,
  ): Promise<CaseDashboardProjectedDto> {
    const parts: SelectPart[] = [
      { alias: 'totalVehicles', expr: countVehiclesSql(VEHICLE_KEY) },
      {
        alias: 'totalAmount',
        expr: 'SUM(COALESCE(c.total_amount_with_tax, 0))',
      },
    ];
    for (const cls of CASE_DASHBOARD_CLASSES) {
      parts.push(
        {
          alias: classAlias(cls, 'vehicles'),
          expr: countVehiclesSql(VEHICLE_KEY, CLASS_SQL[cls]),
        },
        {
          alias: classAlias(cls, 'amount'),
          expr: `SUM(CASE WHEN ${CLASS_SQL[cls]} THEN COALESCE(c.total_amount_with_tax, 0) ELSE 0 END)`,
        },
      );
    }
    const qb = applySelects(this.cases.createQueryBuilder('c'), parts)
      .where(BASE_FILTER)
      .andWhere('c.status IN (:...open)', { open: OPEN_STATUSES });
    if (range) {
      qb.andWhere(
        'COALESCE(c.issued_at, c.created_at) >= :start AND COALESCE(c.issued_at, c.created_at) <= :end',
        { start: range.start, end: range.end },
      );
    }
    const row = (await qb.getRawOne()) ?? {};
    const raw: CaseDashboardProjectedRaw = {
      totalVehicles: row.totalVehicles,
      totalAmount: row.totalAmount,
      classifications: Object.fromEntries(
        CASE_DASHBOARD_CLASSES.map((cls) => [
          cls,
          {
            vehicles: row[classAlias(cls, 'vehicles')],
            amount: row[classAlias(cls, 'amount')],
          },
        ]),
      ),
    };
    return toProjectedDto(raw);
  }
}
