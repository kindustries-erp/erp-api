import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeManagement } from '@/v2/modules/employees-management/entities/employee-management.entity';
import { UsersManagement } from '@/v2/modules/users-management/entities/users-management.entity';
import type {
  ApprovalActorInfo,
  ApprovalActorResolver,
} from '@/v2/core/approval-core/contracts/approval.contract';

/**
 * Tra tên và email của người thực hiện bước duyệt từ actorId (UUID).
 * Một truy vấn cho cả danh sách; không bao giờ trả về id nội bộ của nhật ký.
 */
@Injectable()
export class ApprovalActorService implements ApprovalActorResolver {
  constructor(
    @InjectRepository(UsersManagement)
    private readonly users: Repository<UsersManagement>,
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
      .leftJoin(EmployeeManagement, 'e', 'e.id = u.employee_id')
      .select(['u.id AS id', 'u.email AS email', 'e.full_name AS "fullName"'])
      .where('u.id IN (:...ids)', { ids })
      .getRawMany();

    for (const row of rows) {
      result.set(row.id, { name: row.fullName, email: row.email });
    }
    return result;
  }
}
