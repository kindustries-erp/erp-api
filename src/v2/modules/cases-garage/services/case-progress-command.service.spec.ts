import { BadRequestException } from '@nestjs/common';
import { CaseOrigin } from '../entities/case-garage.enums';
import { CaseProgressCommandService } from './case-progress-command.service';

const make = (
  current: Record<string, unknown>,
  employee: Record<string, unknown> | null = null,
) => {
  const manager = {
    update: jest.fn(),
    findOne: jest.fn().mockResolvedValue(employee),
  };
  const ds = { transaction: (cb: (m: unknown) => unknown) => cb(manager) };
  const cases = {
    findOwned: jest.fn().mockResolvedValue(current),
    reload: jest.fn().mockResolvedValue({ id: 'c1' }),
  };
  return {
    svc: new CaseProgressCommandService(ds as never, cases as never),
    manager,
  };
};

const E1 = '11111111-1111-4111-8111-111111111111';

describe('CaseProgressCommandService', () => {
  it('ghi KTV, công đoạn, % và dấu cập nhật; xe NATIVE không có overrides', async () => {
    const { svc, manager } = make(
      { id: 'c1', origin: CaseOrigin.NATIVE, branchId: 'b1' },
      { id: E1, branchId: 'b1' },
    );
    await svc.update(
      'B1',
      'c1',
      {
        assigneeId: E1,
        progressStage: 'PAINTING',
        progressPercent: 40,
      } as never,
      'u1',
    );
    const patch = manager.update.mock.calls[0][2] as Record<string, unknown>;
    expect(patch).toMatchObject({
      assigneeId: E1,
      progressStage: 'PAINTING',
      progressPercent: 40,
      progressUpdatedBy: 'u1',
    });
    expect(patch.progressUpdatedAt).toBeInstanceOf(Date);
    expect(patch).not.toHaveProperty('overrides');
  });

  it('xe sync: đổi ngày hẹn xong đánh dấu override, không ghi sang v1', async () => {
    const { svc, manager } = make({
      id: 'c1',
      origin: CaseOrigin.KGARA_SYNC,
      sourceSnapshot: {},
      overrides: {},
    });
    await svc.update(
      'B1',
      'c1',
      { expectedCompletionAt: '2026-12-01T00:00:00.000Z' } as never,
      'u1',
    );
    const patch = manager.update.mock.calls[0][2] as Record<string, unknown>;
    expect(patch.overrides).toEqual({ expectedCompletionAt: true });
    expect(patch.expectedCompletionAt).toEqual(
      new Date('2026-12-01T00:00:00.000Z'),
    );
  });

  it('KTV không tồn tại hoặc khác chi nhánh → 400, không ghi', async () => {
    const a = make(
      { id: 'c1', origin: CaseOrigin.NATIVE, branchId: 'b1' },
      null,
    );
    await expect(
      a.svc.update('B1', 'c1', { assigneeId: E1 } as never, 'u'),
    ).rejects.toBeInstanceOf(BadRequestException);
    const b = make(
      { id: 'c1', origin: CaseOrigin.NATIVE, branchId: 'b1' },
      { id: E1, branchId: 'b2' },
    );
    await expect(
      b.svc.update('B1', 'c1', { assigneeId: E1 } as never, 'u'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(a.manager.update).not.toHaveBeenCalled();
    expect(b.manager.update).not.toHaveBeenCalled();
  });

  it('gửi null xóa KTV, bỏ field thì giữ nguyên', async () => {
    const { svc, manager } = make({ id: 'c1', origin: CaseOrigin.NATIVE });
    await svc.update('B1', 'c1', { assigneeId: null } as never, 'u');
    const patch = manager.update.mock.calls[0][2] as Record<string, unknown>;
    expect(patch.assigneeId).toBeNull();
    expect(patch).not.toHaveProperty('progressStage');
  });
});
