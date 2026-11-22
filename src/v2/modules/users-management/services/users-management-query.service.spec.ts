import { BadRequestException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { EmployeeManagement } from '@/v2/modules/employees-management/entities/employee-management.entity';
import type { UsersManagement } from '../entities/users-management.entity';
import { UsersManagementQueryService } from './users-management-query.service';

describe('UsersManagementQueryService', () => {
  let employees: { find: jest.Mock };
  let repo: { createQueryBuilder: jest.Mock; findOne: jest.Mock };
  let qb: Record<string, jest.Mock>;
  let service: UsersManagementQueryService;

  beforeEach(() => {
    qb = {};
    for (const name of ['leftJoin', 'where', 'andWhere']) {
      qb[name] = jest.fn(() => qb);
    }
    employees = { find: jest.fn().mockResolvedValue([]) };
    repo = {
      createQueryBuilder: jest.fn(() => qb),
      findOne: jest.fn(),
    };
    service = new UsersManagementQueryService(
      repo as unknown as Repository<UsersManagement>,
      employees as unknown as Repository<EmployeeManagement>,
    );
  });

  it('column_filters sai JSON trả 400, không bỏ qua im lặng', async () => {
    await expect(
      service.findAll({ column_filters: '{bad' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.findAll({ column_filters: '{bad' })).rejects.toThrow(
      /column_filters/,
    );
  });

  it('column_search, column_operators, date_ranges sai JSON cũng trả 400', async () => {
    for (const key of [
      'column_search',
      'column_operators',
      'date_ranges',
    ] as const) {
      await expect(service.findAll({ [key]: '[1]' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    }
  });

  it('column-options với filters sai JSON trả 400', async () => {
    await expect(
      service.findColumnOptions({ column: 'email', filters: '{bad' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('column-options với cột không nằm trong whitelist trả trang rỗng', async () => {
    const res = await service.findColumnOptions({
      column: 'passwordHash',
      page: 1,
      pageSize: 20,
    });
    expect(res.items).toEqual([]);
    expect(repo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('JSON sai trả 400 trước khi chạm DB', async () => {
    await expect(service.findAll({ column_filters: '{bad' })).rejects.toThrow();
    expect(qb.andWhere).not.toHaveBeenCalled();
  });

  it('người không phải admin@liouni.com: query loại 2 tài khoản test', async () => {
    qb.getOne = jest.fn().mockResolvedValue(null);
    await service.findVisibleById('u1', 'nhanvien@example.com');
    expect(qb.andWhere).toHaveBeenCalledWith(
      'LOWER(e.email) NOT IN (:...hiddenEmails)',
      {
        hiddenEmails: ['ai-test-tao@example.com', 'ai-test-admin@example.com'],
      },
    );
  });

  it('admin@liouni.com: không thêm điều kiện ẩn tài khoản test', async () => {
    qb.getOne = jest.fn().mockResolvedValue(null);
    await service.findVisibleById('u1', 'admin@liouni.com');
    const hidden = qb.andWhere.mock.calls.some(
      ([sql]) =>
        typeof sql === 'string' && sql.includes('NOT IN (:...hiddenEmails)'),
    );
    expect(hidden).toBe(false);
  });

  it('findVisibleById: tài khoản test trả null với người không có quyền', async () => {
    qb.getOne = jest.fn().mockResolvedValue(null);
    await expect(
      service.findVisibleById('u1', 'nhanvien@example.com'),
    ).resolves.toBeNull();
    expect(qb.andWhere).toHaveBeenCalledWith('e.id = :id', { id: 'u1' });
    expect(qb.andWhere).toHaveBeenCalledWith(
      'LOWER(e.email) NOT IN (:...hiddenEmails)',
      expect.anything(),
    );
  });

  it('findById chỉ đọc dòng chưa xóa mềm', async () => {
    await service.findById('u1');
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { id: 'u1', isDeleted: false },
    });
  });

  it('findEmployeeMap bỏ id rỗng, không gọi DB khi không có id', async () => {
    expect((await service.findEmployeeMap([null, null])).size).toBe(0);
    expect(employees.find).not.toHaveBeenCalled();
  });

  it('findEmployeeMap gom id trùng và trả Map theo id', async () => {
    employees.find.mockResolvedValue([{ id: 'e1' }]);
    const map = await service.findEmployeeMap(['e1', 'e1', null]);
    expect(map.get('e1')).toEqual({ id: 'e1' });
    expect(employees.find).toHaveBeenCalledTimes(1);
  });
});
