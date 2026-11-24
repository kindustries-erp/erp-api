import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BranchManagementExternalLink } from '@/v2/modules/branches-management/entities/branch-management-external-link.entity';
import { EmployeeManagement } from '@/v2/modules/employees-management/entities/employee-management.entity';

const KGARA_SOURCE = 'KGARA';
const LIMIT = 30;

export interface WorkshopWorkerOption {
  id: string;
  code: string;
  fullName: string;
  jobTitle: string | null;
}

/**
 * Nhân viên để chọn "người làm" trên trang tiến độ xưởng (quyền `garage_workshop:read`, không cần
 * `employees:read`). Chỉ nhân viên chưa xóa, đang làm, thuộc chi nhánh ERP liên kết với chi nhánh KGara
 * của header hoặc chưa gán chi nhánh; chưa có liên kết thì trả mọi nhân viên đang làm (khớp kiểm tra
 * chi nhánh khi ghi ở `CaseProgressLogCommandService`).
 */
@Injectable()
export class CaseWorkshopWorkersService {
  constructor(private readonly dataSource: DataSource) {}

  async list(
    branch: string,
    search?: string,
  ): Promise<{ items: WorkshopWorkerOption[] }> {
    const links = await this.dataSource
      .getRepository(BranchManagementExternalLink)
      .find({
        where: { source: KGARA_SOURCE, externalId: branch, isDeleted: false },
      });
    const branchIds = [...new Set(links.map((l) => l.branchId))];
    const qb = this.dataSource
      .getRepository(EmployeeManagement)
      .createQueryBuilder('e')
      .where('e.is_deleted = false')
      .andWhere(`e.status = 'ACTIVE'`);
    if (branchIds.length) {
      qb.andWhere('(e.branch_id IN (:...branchIds) OR e.branch_id IS NULL)', {
        branchIds,
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
