import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErpEmployee } from '../../../employees-core/entities/erp_employee.entity';
import { CoreUser } from '../../../users/entities/core-user.entity';

export interface ApprovalActorInfo {
  /** Họ tên nhân viên liên kết; null nếu user chưa gắn hồ sơ nhân viên. */
  name: string | null;
  email: string | null;
}

/**
 * Tra tên và email của người thực hiện bước duyệt từ actorId (UUID).
 * Một truy vấn cho cả danh sách; không bao giờ trả về id nội bộ của nhật ký.
 */
@Injectable()
export class ApprovalActorService {
  constructor(
    @InjectRepository(CoreUser)
    private readonly users: Repository<CoreUser>,
  ) {}

  async resolve(
    actorIds: ReadonlyArray<string | null | undefined>,
  ): Promise<Map<string, ApprovalActorInfo>> {
    const ids = [...new Set(actorIds.filter((id): id is string => !!id))];
    const result = new Map<string, ApprovalActorInfo>();
    if (ids.length === 0) return result;

    const rows: Array<{
      id: string;
      email: string | null;
      fullName: string | null;
    }> = await this.users
      .createQueryBuilder('u')
      .leftJoin(ErpEmployee, 'e', 'e.id = u.employee_id')
      .select(['u.id AS id', 'u.email AS email', 'e.full_name AS "fullName"'])
      .where('u.id IN (:...ids)', { ids })
      .getRawMany();

    for (const row of rows) {
      result.set(row.id, { name: row.fullName, email: row.email });
    }
    return result;
  }
}
