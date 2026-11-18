import { BadRequestException } from '@nestjs/common';
import { FileAttachmentPurgeService } from './file-attachment-purge.service';

type Row = { id: string; fileKey: string; isDeleted: boolean } | null;

function setup(row: Row, refTotal: number, gatewayFails = false) {
  const manager = {
    findOne: jest.fn().mockResolvedValue(row),
    query: jest.fn().mockResolvedValue([]),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const repo = {
    manager: {
      transaction: jest.fn((cb: (m: unknown) => unknown) => cb(manager)),
    },
  };
  const gateway = {
    delete: gatewayFails
      ? jest.fn().mockRejectedValue(new Error('r2'))
      : jest.fn().mockResolvedValue(undefined),
  };
  const references = {
    count: jest.fn().mockResolvedValue({ total: refTotal, bySource: {} }),
  };
  const audit = { recordAction: jest.fn().mockResolvedValue(undefined) };
  const service = new FileAttachmentPurgeService(
    repo as never,
    gateway as never,
    references as never,
    audit as never,
  );
  return { service, manager, gateway, references, audit };
}

const actor = { userId: 'u1', source: 'MANUAL' as const };
const row = { id: 'a1', fileKey: 'k1', isDeleted: true };

describe('FileAttachmentPurgeService', () => {
  it('không còn tham chiếu: xóa object rồi xóa dòng, ghi audit', async () => {
    const { service, manager, gateway, audit, references } = setup(row, 0);
    const out = await service.purge(['a1'], actor);
    expect(out.purged).toEqual([
      {
        id: 'a1',
        objectDeleted: true,
        objectKept: false,
        remainingReferences: 0,
      },
    ]);
    expect(references.count).toHaveBeenCalledWith('k1', 'a1');
    expect(gateway.delete).toHaveBeenCalledWith('k1');
    expect(manager.delete).toHaveBeenCalledWith(expect.anything(), {
      id: 'a1',
    });
    expect(manager.query.mock.calls[0][0]).toContain('pg_advisory_xact_lock');
    expect(audit.recordAction).toHaveBeenCalledTimes(1);
  });

  it('còn tham chiếu khác: chỉ xóa dòng, giữ object', async () => {
    const { service, manager, gateway } = setup(row, 2);
    const out = await service.purge(['a1'], actor);
    expect(out.purged[0]).toMatchObject({
      objectDeleted: false,
      objectKept: true,
      remainingReferences: 2,
    });
    expect(gateway.delete).not.toHaveBeenCalled();
    expect(manager.delete).toHaveBeenCalled();
  });

  it('file chưa xóa mềm bị bỏ qua, không đụng gì', async () => {
    const { service, manager, gateway } = setup(
      { ...row, isDeleted: false },
      0,
    );
    const out = await service.purge(['a1'], actor);
    expect(out.skipped).toEqual([{ id: 'a1', reason: 'NOT_SOFT_DELETED' }]);
    expect(manager.delete).not.toHaveBeenCalled();
    expect(gateway.delete).not.toHaveBeenCalled();
  });

  it('không tìm thấy thì bỏ qua NOT_FOUND', async () => {
    const { service } = setup(null, 0);
    const out = await service.purge(['zz'], actor);
    expect(out.skipped).toEqual([{ id: 'zz', reason: 'NOT_FOUND' }]);
  });

  it('lỗi R2 thì giữ dòng, báo STORAGE_ERROR, không audit', async () => {
    const { service, manager, audit } = setup(row, 0, true);
    const out = await service.purge(['a1'], actor);
    expect(out.skipped).toEqual([{ id: 'a1', reason: 'STORAGE_ERROR' }]);
    expect(manager.delete).not.toHaveBeenCalled();
    expect(audit.recordAction).not.toHaveBeenCalled();
  });

  it('khử trùng id và chặn quá 100 file', async () => {
    const { service, manager } = setup(row, 0);
    await service.purge(['a1', 'a1'], actor);
    expect(manager.findOne).toHaveBeenCalledTimes(1);
    const many = Array.from({ length: 101 }, (_, i) => `id-${i}`);
    await expect(service.purge(many, actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
