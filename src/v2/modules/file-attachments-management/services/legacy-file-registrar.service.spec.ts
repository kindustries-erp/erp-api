import { FileOwnerType } from '@/v2/core/file-attachments-core';
import {
  LEGACY_REGISTRAR_ENV,
  LegacyFileRegistrarService,
} from './legacy-file-registrar.service';

const makeRepo = (executeResult: unknown = { identifiers: [{ id: 'x' }] }) => {
  const execute = jest.fn().mockResolvedValue(executeResult);
  const values = jest.fn().mockReturnThis();
  const qb = {
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values,
    orIgnore: jest.fn().mockReturnThis(),
    execute,
  };
  return {
    qb,
    values,
    execute,
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: jest.fn().mockReturnValue(qb),
  };
};

const base = {
  ownerType: FileOwnerType.INVOICE,
  ownerId: 'inv-1',
  fileKey: 'invoices/pdf/a.pdf',
  legacySource: 'erp_attachments:1',
};

describe('LegacyFileRegistrarService', () => {
  afterEach(() => delete process.env[LEGACY_REGISTRAR_ENV]);

  it('đăng ký dòng LEGACY, category lạ về KHAC, userId sai về null', async () => {
    const repo = makeRepo();
    const svc = new LegacyFileRegistrarService(repo as never);
    const created = await svc.register({
      ...base,
      category: 'LOAI_LA',
      userId: '',
      fileSize: 12.7,
    });
    expect(created).toBe(true);
    const row = repo.values.mock.calls[0][0];
    expect(row).toMatchObject({
      origin: 'LEGACY',
      category: 'KHAC',
      createdBy: null,
      fileSize: '12',
      fileName: 'a.pdf',
    });
    expect(repo.qb.orIgnore).toHaveBeenCalled();
  });

  it('giữ category hợp lệ và userId là uuid', async () => {
    const repo = makeRepo();
    const uid = '16210253-87f1-4a55-b9fd-88c1a8c29d2e';
    await new LegacyFileRegistrarService(repo as never).register({
      ...base,
      category: 'HOP_DONG',
      userId: uid,
    });
    expect(repo.values.mock.calls[0][0]).toMatchObject({
      category: 'HOP_DONG',
      createdBy: uid,
    });
  });

  it('đã có sẵn (không có identifiers) thì trả false', async () => {
    const repo = makeRepo({ identifiers: [] });
    expect(
      await new LegacyFileRegistrarService(repo as never).register(base),
    ).toBe(false);
  });

  it('bị tắt bằng cờ env thì không đụng DB', async () => {
    process.env[LEGACY_REGISTRAR_ENV] = 'false';
    const repo = makeRepo();
    const svc = new LegacyFileRegistrarService(repo as never);
    expect(await svc.register(base)).toBe(false);
    expect(await svc.unregister(base.ownerType, 'inv-1', 'k')).toBe(0);
    expect(repo.createQueryBuilder).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('lỗi DB chỉ log, không ném', async () => {
    const repo = makeRepo();
    repo.execute.mockRejectedValue(new Error('boom'));
    const svc = new LegacyFileRegistrarService(repo as never);
    await expect(svc.register(base)).resolves.toBe(false);
    repo.update.mockRejectedValue(new Error('boom'));
    await expect(svc.unregister(base.ownerType, 'inv-1', 'k')).resolves.toBe(0);
  });

  it('unregister xóa mềm theo (owner, key) chỉ dòng chưa xóa', async () => {
    const repo = makeRepo();
    const n = await new LegacyFileRegistrarService(repo as never).unregister(
      base.ownerType,
      'inv-1',
      'invoices/pdf/a.pdf',
      '16210253-87f1-4a55-b9fd-88c1a8c29d2e',
    );
    expect(n).toBe(1);
    expect(repo.update.mock.calls[0][0]).toEqual({
      ownerType: 'INVOICE',
      ownerId: 'inv-1',
      fileKey: 'invoices/pdf/a.pdf',
      isDeleted: false,
    });
    expect(repo.update.mock.calls[0][1]).toMatchObject({ isDeleted: true });
  });

  it('unregisterByKey xóa mềm mọi dòng hoạt động theo khóa', async () => {
    const repo = makeRepo();
    const n = await new LegacyFileRegistrarService(
      repo as never,
    ).unregisterByKey('k1');
    expect(n).toBe(1);
    expect(repo.update.mock.calls[0][0]).toEqual({
      fileKey: 'k1',
      isDeleted: false,
    });
  });
});
