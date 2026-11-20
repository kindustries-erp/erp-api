import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { toPagedList } from '@/common/utils/paginated-result';
import { CaseGarage } from '../../cases-garage/entities/case-garage.entity';
import type { CaseDashboardVehicleItemDto } from '../dto/case-dashboard.types';
import {
  toCaseDashboardItemDto,
  toNumber,
} from '../helpers/case-dashboard.mapper';
import {
  groupCasesByVehicle,
  toVehicleItemDto,
} from '../helpers/case-dashboard-vehicle.mapper';
import {
  PERIOD_DATE,
  VEHICLE_KEY,
  applyCaseFilters,
} from '../helpers/case-dashboard.sql';
import {
  normalizePaging,
  type CaseDashboardCasesParams,
} from './case-dashboard-cases-query.service';

/**
 * Drill-down theo XE của dashboard garage V2 (đọc `cases_garage`).
 * Mỗi dòng là một xe (khóa biển số chuẩn hóa) kèm các lệnh của xe; phân trang và `total` tính theo xe.
 * Cùng bộ lọc với `listCases`, nên số xe khớp thẻ KPI/giai đoạn. Chỉ đọc, không ghi.
 */
@Injectable()
export class CaseDashboardVehiclesQueryService {
  constructor(
    @InjectRepository(CaseGarage)
    private readonly cases: Repository<CaseGarage>,
  ) {}

  async listVehicles(
    params: CaseDashboardCasesParams,
  ): Promise<ReturnType<typeof toPagedList<CaseDashboardVehicleItemDto>>> {
    const { page, pageSize } = normalizePaging(params.page, params.pageSize);
    const filtered = () =>
      applyCaseFilters(this.cases.createQueryBuilder('c'), params);

    const totalRow = await filtered()
      .select(`COUNT(DISTINCT ${VEHICLE_KEY})`, 'total')
      .getRawOne<{ total?: unknown }>();
    const total = toNumber(totalRow?.total);

    // Trang theo xe: sắp theo mốc kỳ mới nhất của xe, rồi theo khóa xe để ổn định.
    const keyRows = await filtered()
      .select(VEHICLE_KEY, 'vehicle_key')
      .addSelect(`MAX(${PERIOD_DATE})`, 'latest_period')
      .groupBy(VEHICLE_KEY)
      .orderBy('latest_period', 'DESC')
      .addOrderBy('vehicle_key', 'ASC')
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .getRawMany<{ vehicle_key: string }>();
    const keys = keyRows.map((row) => row.vehicle_key);
    if (!keys.length) return toPagedList([], page, pageSize, total);

    const rows = await filtered()
      .andWhere(`${VEHICLE_KEY} IN (:...keys)`, { keys })
      .orderBy(PERIOD_DATE, 'DESC')
      .addOrderBy('c.id', 'DESC')
      .getMany();
    const grouped = groupCasesByVehicle(rows.map(toCaseDashboardItemDto));
    const items = keys.map((key) =>
      toVehicleItemDto(key, grouped.get(key) ?? []),
    );
    return toPagedList(items, page, pageSize, total);
  }
}
