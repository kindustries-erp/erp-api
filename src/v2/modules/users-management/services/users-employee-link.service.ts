import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { EntityManager, Repository } from 'typeorm';
import { EmployeeManagement } from '@/v2/modules/employees-management/entities/employee-management.entity';
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
  ): Promise<EmployeeManagement | null> {
    const repo = manager.getRepository(EmployeeManagement);

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
    if (!next || next.isDeleted) {
      throw new NotFoundException('Không tìm thấy nhân viên');
    }
    if (next.userId && next.userId !== user.id) {
      throw new ConflictException('Nhân viên này đã liên kết tài khoản khác');
    }
    // Liên kết mới chỉ với nhân viên đang làm việc; giữ nguyên liên kết sẵn có khi lưu lại
    if (next.userId !== user.id && next.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Nhân viên đã nghỉ việc, không thể liên kết tài khoản',
      );
    }
    next.userId = user.id;
    if (!next.email) next.email = user.email;
    await repo.save(next);
    user.employeeId = next.id;
    return next;
  }

  private lock(
    repo: Repository<EmployeeManagement>,
    id: string,
  ): Promise<EmployeeManagement | null> {
    return repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
  }
}
