import { FileAttachmentSettingsService } from './file-attachment-settings.service';

function setup(existing: unknown) {
  const exec = jest.fn().mockResolvedValue(undefined);
  const insertQb = {
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    orIgnore: jest.fn().mockReturnThis(),
    execute: exec,
  };
  const repo = {
    findOne: jest.fn().mockResolvedValue(existing),
    findOneOrFail: jest.fn().mockResolvedValue({
      id: 1,
      autoPurgeEnabled: false,
      retentionDays: 30,
    }),
    createQueryBuilder: jest.fn().mockReturnValue(insertQb),
    save: jest.fn((v: unknown) => Promise.resolve(v)),
  };
  return {
    service: new FileAttachmentSettingsService(repo as never),
    repo,
    insertQb,
  };
}

describe('FileAttachmentSettingsService', () => {
  it('đã có dòng thì trả nguyên, không tạo mới', async () => {
    const row = { id: 1, autoPurgeEnabled: true, retentionDays: 7 };
    const { service, repo } = setup(row);
    await expect(service.get()).resolves.toBe(row);
    expect(repo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('chưa có dòng thì tạo mặc định: tắt, 30 ngày', async () => {
    const { service, insertQb } = setup(null);
    const out = await service.get();
    expect(insertQb.values).toHaveBeenCalledWith({
      id: 1,
      autoPurgeEnabled: false,
      retentionDays: 30,
    });
    expect(out).toMatchObject({ autoPurgeEnabled: false, retentionDays: 30 });
  });

  it('update chỉ đổi trường được gửi và ghi người sửa', async () => {
    const { service } = setup({
      id: 1,
      autoPurgeEnabled: false,
      retentionDays: 30,
    });
    const out = await service.update({ autoPurgeEnabled: true }, 'u1');
    expect(out).toMatchObject({
      autoPurgeEnabled: true,
      retentionDays: 30,
      updatedBy: 'u1',
    });
    const out2 = await service.update({ retentionDays: 90 }, 'u2');
    expect(out2.retentionDays).toBe(90);
  });
});
