import { ConflictException, NotFoundException } from '@nestjs/common';
import { EmployeeManagement } from './entities/employee-management.entity';
import { EmployeeCommandService } from './services/employee-command.service';
import { EmployeeQueryService } from './services/employee-query.service';
import { EmployeesManagementService } from './employees-management.service';

const row = (over: Partial<EmployeeManagement> = {}): EmployeeManagement =>
  ({
    id: 'e1',
    extraData: {},
    employeeCode: 'NV-001',
    fullName: 'A',
    status: 'ACTIVE',
    userId: null,
    nationalId: '001234567890',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...over,
  }) as EmployeeManagement;

function build() {
  const query = {
    findAll: jest.fn(),
    findAllCodes: jest.fn().mockResolvedValue([]),
    findById: jest.fn(),
    findNationalId: jest.fn(),
    findLinkedUsers: jest.fn().mockResolvedValue(new Map()),
    findColumnOptions: jest.fn(),
  };
  const command = {
    assertCodeAvailable: jest.fn().mockResolvedValue(undefined),
    assertNationalIdAvailable: jest.fn().mockResolvedValue(undefined),
    create: jest.fn(),
    update: jest.fn(),
    setStatus: jest.fn(),
    softDelete: jest.fn(),
  };
  const service = new EmployeesManagementService(
    query as unknown as EmployeeQueryService,
    command as unknown as EmployeeCommandService,
  );
  return { service, query, command };
}

describe('EmployeesManagementService', () => {
  it('findAll trả {items, pagination, summaries}, che CCCD và ghép tài khoản liên kết', async () => {
    const { service, query } = build();
    query.findAll.mockResolvedValue({
      items: [row({ userId: 'u1' })],
      total: 1,
      page: 1,
      pageSize: 20,
      summaries: {},
    });
    query.findLinkedUsers.mockResolvedValue(
      new Map([['u1', { id: 'u1', email: 'a@x.vn' }]]),
    );
    const res = await service.findAll({} as never);
    expect(res.pagination.total).toBe(1);
    expect(res.items[0].nationalIdMasked).toBe('********7890');
    expect(res.items[0].linkedUser).toEqual({ id: 'u1', email: 'a@x.vn' });
    expect(res.items[0]).not.toHaveProperty('nationalId');
  });

  it('create không nhập mã thì tự sinh NV-001 và kiểm tra trùng', async () => {
    const { service, query, command } = build();
    command.create.mockResolvedValue(row());
    query.findById.mockResolvedValue(row());
    await service.create({ fullName: 'A' });
    expect(command.assertCodeAvailable).toHaveBeenCalledWith('NV-001');
    expect(command.create).toHaveBeenCalledWith(
      expect.objectContaining({ employeeCode: 'NV-001' }),
    );
  });

  it('create chuẩn hóa mã nhập, kiểm tra trùng CCCD và truyền lỗi 409 lên', async () => {
    const { service, command } = build();
    command.assertNationalIdAvailable.mockRejectedValue(
      new ConflictException('CCCD'),
    );
    await expect(
      service.create({
        fullName: 'A',
        employeeCode: ' nv-9 ',
        nationalId: '001234567890',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(command.assertCodeAvailable).toHaveBeenCalledWith('NV-9');
    expect(command.create).not.toHaveBeenCalled();
  });

  it('getNextCode lấy số lớn nhất kể cả mã đã xóa mềm', async () => {
    const { service, query } = build();
    query.findAllCodes.mockResolvedValue(['NV-001', 'NV-004']);
    await expect(service.getNextCode()).resolves.toEqual({
      nextCode: 'NV-005',
    });
  });

  it('findOne/update/updateStatus/remove không thấy thì trả 404', async () => {
    const { service, query } = build();
    query.findById.mockResolvedValue(null);
    await expect(service.findOne('x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.update('x', {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.updateStatus('x', { status: 'INACTIVE' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove('x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('update loại trừ chính bản ghi khi kiểm tra trùng mã và CCCD', async () => {
    const { service, query, command } = build();
    query.findById.mockResolvedValue(row());
    command.update.mockResolvedValue(row());
    await service.update('e1', {
      employeeCode: 'nv-2',
      nationalId: '123456789',
    });
    expect(command.assertCodeAvailable).toHaveBeenCalledWith('NV-2', 'e1');
    expect(command.assertNationalIdAvailable).toHaveBeenCalledWith(
      '123456789',
      'e1',
    );
  });

  it('remove bị chặn (409) khi nhân viên còn liên kết tài khoản', async () => {
    const { service, query, command } = build();
    query.findById.mockResolvedValue(row({ userId: 'u1' }));
    await expect(service.remove('e1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(command.softDelete).not.toHaveBeenCalled();
  });

  it('remove xóa mềm khi không còn liên kết', async () => {
    const { service, query, command } = build();
    query.findById.mockResolvedValue(row());
    command.softDelete.mockResolvedValue(row({ isDeleted: true }));
    await expect(service.remove('e1')).resolves.toMatchObject({
      message: 'Xóa thành công',
    });
  });

  it('getNationalId trả CCCD đầy đủ, 404 khi không có nhân viên', async () => {
    const { service, query } = build();
    query.findNationalId.mockResolvedValueOnce('001234567890');
    await expect(service.getNationalId('e1')).resolves.toMatchObject({
      data: { nationalId: '001234567890' },
    });
    query.findNationalId.mockResolvedValueOnce(undefined);
    await expect(service.getNationalId('x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
