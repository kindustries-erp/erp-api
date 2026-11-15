import { BadRequestException, ConflictException } from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';
import { EmployeeManagement } from '../entities/employee-management.entity';
import { EmployeeCommandService } from './employee-command.service';

type Existing = { id: string } | null;

function build(existing: Existing = null) {
  const qb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(existing),
  };
  const repo = {
    createQueryBuilder: jest.fn(() => qb),
    create: jest.fn((v: object) => ({ ...v })),
    save: jest.fn((v: EmployeeManagement) => Promise.resolve(v)),
  };
  const service = new EmployeeCommandService(
    repo as unknown as Repository<EmployeeManagement>,
  );
  return { service, repo, qb };
}

const dbError = (code: string) =>
  new QueryFailedError('INSERT', [], { code } as never);

const entity = (over: Partial<EmployeeManagement> = {}) =>
  ({
    id: 'e1',
    status: 'ACTIVE',
    extraData: { a: 1 },
    birthDate: null,
    startDate: null,
    leaveDate: null,
    isDeleted: false,
    ...over,
  }) as EmployeeManagement;

describe('EmployeeCommandService', () => {
  it('assertCodeAvailable trả 409 khi mã đã có (bỏ qua bản ghi xóa mềm)', async () => {
    const { service, qb } = build({ id: 'other' });
    await expect(service.assertCodeAvailable('NV-001')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(qb.andWhere).toHaveBeenCalledWith('e.isDeleted = :isDeleted', {
      isDeleted: false,
    });
  });

  it('assertCodeAvailable loại trừ chính bản ghi khi sửa', async () => {
    const { service, qb } = build();
    await service.assertCodeAvailable('NV-001', 'e1');
    expect(qb.andWhere).toHaveBeenCalledWith('e.id != :excludeId', {
      excludeId: 'e1',
    });
  });

  it('assertNationalIdAvailable trả 409 khi CCCD đã thuộc nhân viên khác', async () => {
    const { service } = build({ id: 'other' });
    await expect(
      service.assertNationalIdAvailable('001234567890'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('create đổi ISO thành Date, extraData mặc định {} và không ghi userId', async () => {
    const { service, repo } = build();
    await service.create({
      fullName: 'A',
      employeeCode: 'NV-001',
      birthDate: '1990-04-30T17:00:00.000Z',
      userId: 'hack',
    } as never);
    const created = repo.create.mock.calls[0][0] as Record<string, unknown>;
    expect(created.birthDate).toEqual(new Date('1990-04-30T17:00:00.000Z'));
    expect(created.extraData).toEqual({});
    expect(created.isDeleted).toBe(false);
    expect(created).not.toHaveProperty('userId');
  });

  it('create chặn ngày sinh ở tương lai (400)', async () => {
    const { service, repo } = build();
    await expect(
      service.create({
        fullName: 'A',
        employeeCode: 'NV-001',
        birthDate: '2999-01-01T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('update so ngày nghỉ với ngày vào làm đã có trong entity', async () => {
    const { service } = build();
    const current = entity({ startDate: new Date('2026-05-01T00:00:00.000Z') });
    await expect(
      service.update(current, { leaveDate: '2026-04-01T00:00:00.000Z' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('update merge extraData cấp 1 và bỏ branch đã nạp khi đổi branchId', async () => {
    const { service } = build();
    const current = entity({ branch: { id: 'old' } as never, branchId: 'old' });
    const saved = await service.update(current, {
      branchId: 'new',
      extraData: { b: 2 },
    });
    expect(saved.extraData).toEqual({ a: 1, b: 2 });
    expect(saved.branchId).toBe('new');
    expect(saved.branch).toBeUndefined();
  });

  it('setStatus INACTIVE đặt ngày nghỉ việc nếu chưa có, ACTIVE xóa ngày nghỉ', async () => {
    const { service } = build();
    const now = new Date('2026-11-15T00:00:00.000Z');
    const inactive = await service.setStatus(entity(), 'INACTIVE', now);
    expect(inactive.leaveDate).toEqual(now);
    const keep = await service.setStatus(
      entity({ leaveDate: new Date('2026-10-01T00:00:00.000Z') }),
      'INACTIVE',
      now,
    );
    expect(keep.leaveDate).toEqual(new Date('2026-10-01T00:00:00.000Z'));
    const active = await service.setStatus(
      entity({ status: 'INACTIVE', leaveDate: now }),
      'ACTIVE',
    );
    expect(active.leaveDate).toBeNull();
  });

  it('softDelete chỉ bật isDeleted', async () => {
    const { service } = build();
    expect((await service.softDelete(entity())).isDeleted).toBe(true);
  });

  it('vi phạm unique khi đua ghi trả 409, vi phạm FK trả 400, lỗi khác giữ nguyên', async () => {
    const { service, repo } = build();
    repo.save.mockRejectedValueOnce(dbError('23505'));
    await expect(service.softDelete(entity())).rejects.toBeInstanceOf(
      ConflictException,
    );
    repo.save.mockRejectedValueOnce(dbError('23503'));
    await expect(service.softDelete(entity())).rejects.toBeInstanceOf(
      BadRequestException,
    );
    const boom = new Error('boom');
    repo.save.mockRejectedValueOnce(boom);
    await expect(service.softDelete(entity())).rejects.toBe(boom);
  });

  it('update cho phép xóa ngày vào làm rồi đặt ngày nghỉ (so với giá trị sau khi áp dụng)', async () => {
    const { service } = build();
    const current = entity({ startDate: new Date('2026-05-01T00:00:00.000Z') });
    const saved = await service.update(current, {
      startDate: null,
      leaveDate: '2026-04-01T00:00:00.000Z',
    });
    expect(saved.startDate).toBeNull();
    expect(saved.leaveDate).toEqual(new Date('2026-04-01T00:00:00.000Z'));
  });
});
