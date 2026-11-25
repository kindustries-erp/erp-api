import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EmployeeManagement } from '@/v2/modules/employees-management/entities/employee-management.entity';

const LIMIT = 30;

export interface WorkshopWorkerOption {
  id: string;
  code: string;
  fullName: string;
  jobTitle: string | null;
}

/**
 * Nhân viên để chọn "người làm" trên trang tiến độ xưởng (quyền `garage_workshop:read`, không cần
 * `employees:read`). Chỉ nhân viên chưa xóa, đang làm; có chọn chi nhánh ERP thì chỉ nhân viên của chi
 * nhánh đó hoặc chưa gán chi nhánh, không chọn thì mọi nhân viên đang làm (khớp kiểm tra chi nhánh khi
 * ghi ở `CaseProgressLogCommandService`).
 */
@Injectable()
export class CaseWorkshopWorkersService {
  constructor(private readonly dataSource: DataSource) {}

  async list(
    branchId: string | undefined,
    search?: string,
  ): Promise<{ items: WorkshopWorkerOption[] }> {
    const qb = this.dataSource
      .getRepository(EmployeeManagement)
      .createQueryBuilder('e')
      .where('e.is_deleted = false')
      .andWhere(`e.status = 'ACTIVE'`);
    if (branchId) {
      qb.andWhere('(e.branch_id = :branchId OR e.branch_id IS NULL)', {
        branchId: branchId,
      });
    }
    const q = search?.trim();
    if (q) {
      qb.andWhere('(e.full_name ILIKE :q OR e.employee_code ILIKE :q)', {
        q: `%${q}%`,
      });
    }
    const rows = await qb.orderBy('e.full_name', 'ASC').take(LIMIT).getMany();
    return {
      items: rows.map((e) => ({
        id: e.id,
        code: e.employeeCode,
        fullName: e.fullName,
        jobTitle: e.jobTitle ?? null,
      })),
    };
  }
}
