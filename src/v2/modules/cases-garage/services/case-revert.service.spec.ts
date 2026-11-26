import { BadRequestException } from '@nestjs/common';
import { CaseProgressLogGarage } from '../entities/case-progress-log-garage.entity';
import { CaseRevertService } from './case-revert.service';

const make = (
  header: Record<string, unknown>,
  line?: Record<string, unknown>,
  openStage?: Record<string, unknown>,
) => {
  const manager = {
    update: jest.fn(),
    findOne: jest.fn(async (entity: unknown) =>
      entity === CaseProgressLogGarage ? (openStage ?? null) : (line ?? null),
    ),
  };
  const ds = { transaction: (cb: (m: unknown) => unknown) => cb(manager) };
  const cases = {
    findOwned: jest.fn().mockResolvedValue(header),
    reload: jest.fn().mockResolvedValue({ id: 'c1' }),
  };
  return {
    svc: new CaseRevertService(ds as never, cases as never, {} as never),
    manager,
  };
};

describe('CaseRevertService', () => {
  const header = {
    id: 'c1',
    sourceSnapshot: {
      licensePlate: '30A-1',
      receivedAt: '2026-01-01T00:00:00.000Z',
    },
    overrides: { licensePlate: true, receivedAt: true },
  };

  it('về hết field đang override: chép snapshot, đổi ISO về Date, bỏ khóa', async () => {
    const { svc, manager } = make(header);
    await svc.revertCase('B1', 'c1');
    expect(manager.update).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'c1' },
      {
        licensePlate: '30A-1',
        receivedAt: new Date('2026-01-01T00:00:00.000Z'),
        overrides: {},
      },
    );
  });

  it('về một field: các override khác giữ nguyên', async () => {
    const { svc, manager } = make(header);
    await svc.revertCase('B1', 'c1', ['licensePlate']);
    expect(manager.update).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'c1' },
      { licensePlate: '30A-1', overrides: { receivedAt: true } },
    );
  });

  it('về trạng thái KGara: chép status từ snapshot, bỏ dấu override', async () => {
    const { svc, manager } = make({
      id: 'c1',
      status: 'INTAKE',
      sourceSnapshot: { status: 'QUOTED' },
      overrides: { status: true },
    });
    await svc.revertCase('B1', 'c1', ['status']);
    expect(manager.update).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'c1' },
      { status: 'QUOTED', overrides: {} },
    );
  });

  it('field chưa bị override → 400, không ghi', async () => {
    const { svc, manager } = make(header);
    await expect(
      svc.revertCase('B1', 'c1', ['customerName']),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('dòng: về _deleted khôi phục dòng đã xóa ở v2', async () => {
    const { svc, manager } = make(header, {
      id: 'l1',
      sourceSnapshot: {},
      overrides: { _deleted: true },
    });
    await svc.revertLine('B1', 'c1', 'l1', ['_deleted']);
    expect(manager.update).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'l1' },
      { overrides: {} },
    );
  });

  it('về status KGara khác status hiện tại: đóng công đoạn mở, bỏ công đoạn không còn thuộc status', async () => {
    const { svc, manager } = make(
      {
        id: 'c1',
        status: 'IN_PROGRESS',
        progressStage: 'PAINTING',
        sourceSnapshot: { status: 'QUOTED' },
        overrides: { status: true },
      },
      undefined,
      { id: 'l1', startedAt: new Date('2026-11-24T07:00:00.000Z') },
    );
    await svc.revertCase('B1', 'c1', ['status'], 'u1');
    expect(manager.update).toHaveBeenCalledWith(
      CaseProgressLogGarage,
      { id: 'l1' },
      expect.objectContaining({ updatedBy: 'u1' }),
    );
    expect(manager.update).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'c1' },
      { progressStage: null },
    );
  });
});
