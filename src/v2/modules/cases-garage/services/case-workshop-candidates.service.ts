import { Injectable } from '@nestjs/common';
import { Brackets, DataSource } from 'typeorm';
import type {
  CaseWorkshopCandidate,
  QueryWorkshopCandidatesDto,
} from '../dto/case-workshop-track.dto';
import { CaseGarage } from '../entities/case-garage.entity';
import {
  escapeLike,
  normalizePlate,
  PLATE_SQL,
} from '../helpers/case-workshop-plate';

const DEFAULT_LIMIT = 20;

export function toWorkshopCandidate(c: CaseGarage): CaseWorkshopCandidate {
  const vehicle = [c.vehicleBrandName, c.vehicleModelName]
    .filter(Boolean)
    .join(' ');
  return {
    id: c.id,
    caseCode: c.caseCode,
    licensePlate: c.licensePlate ?? null,
    customerName: c.customerName ?? null,
    vehicleName: vehicle || null,
    origin: c.origin,
    status: c.status,
    receivedAt: c.receivedAt ? c.receivedAt.toISOString() : null,
    onBoard: c.workshopTrackedAt != null,
  };
}

/**
 * Tìm xe để đưa vào bảng tiến độ trong chi nhánh: biển số (so sau chuẩn hóa), mã vụ việc, tên khách.
 * Xe chưa xong lên trước, rồi theo ngày tiếp nhận mới nhất.
 */
@Injectable()
export class CaseWorkshopCandidatesService {
  constructor(private readonly dataSource: DataSource) {}

  async search(
    branch: string,
    q: QueryWorkshopCandidatesDto,
  ): Promise<CaseWorkshopCandidate[]> {
    const term = q.search.trim();
    const plate = normalizePlate(term);
    const rows = await this.dataSource
      .getRepository(CaseGarage)
      .createQueryBuilder('c')
      .addSelect(
        "CASE WHEN c.status IN ('COMPLETED', 'CANCELLED') THEN 1 ELSE 0 END",
        'finished_rank',
      )
      .where('c.is_deleted = false')
      .andWhere('c.external_deleted_at IS NULL')
      .andWhere('c.branch_external_id = :branch', { branch })
      .andWhere(
        new Brackets((w) => {
          w.where('c.case_code ILIKE :s', {
            s: `%${escapeLike(term)}%`,
          }).orWhere('c.customer_name ILIKE :s');
          if (plate) w.orWhere(`${PLATE_SQL} LIKE :p`, { p: `%${plate}%` });
        }),
      )
      .orderBy('finished_rank', 'ASC')
      .addOrderBy('c.received_at', 'DESC', 'NULLS LAST')
      .addOrderBy('c.created_at', 'DESC')
      .limit(q.limit ?? DEFAULT_LIMIT)
      .getMany();
    return rows.map(toWorkshopCandidate);
  }
}
