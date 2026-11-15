import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { EntityManager, Repository } from 'typeorm';
import { ErpEmployee } from '@/employees-core/entities/erp_employee.entity';
import { UsersManagement } from '../entities/users-management.entity';

/**
 * Liên kết 1-1 tài khoản với nhân viên. Phải gọi trong transaction của caller:
 * hàng nhân viên được khóa `pessimistic_write` nên hai request đồng thời không thể
 * cùng liên kết một nhân viên cho hai tài khoản.
 */
@Injectable()
export class UsersEmployeeLinkService {
  /** Trả nhân viên sau khi áp dụng (null nếu gỡ liên kết). Sửa `user.employeeId` tại chỗ, caller tự lưu `user`. */
  async apply(
    manager: EntityManager,
    user: UsersManagement,
    nextEmployeeId: string | null,
  ): Promise<ErpEmployee | null> {
    const repo = manager.getRepository(ErpEmployee);

    if (user.employeeId && user.employeeId !== nextEmployeeId) {
      const previous = await this.lock(repo, user.employeeId);
      if (previous && previous.userId === user.id) {
        previous.userId = null;
        await repo.save(previous);
      }
    }

    if (!nextEmployeeId) {
      user.employeeId = null;
      return null;
    }

    const next = await this.lock(repo, nextEmployeeId);
    if (!next) throw new NotFoundException('Không tìm thấy nhân viên');
    if (next.userId && next.userId !== user.id) {
      throw new ConflictException('Nhân viên này đã liên kết tài khoản khác');
    }
    next.userId = user.id;
    if (!next.email) next.email = user.email;
    await repo.save(next);
    user.employeeId = next.id;
    return next;
  }

  private lock(
    repo: Repository<ErpEmployee>,
    id: string,
  ): Promise<ErpEmployee | null> {
    return repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
  }
}
