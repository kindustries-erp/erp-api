import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  FileOwnerRegistry,
  FileOwnerType,
  type FileOwnerPolicyPort,
} from '@/v2/core/storage-core';
import { CodeStoragePolicyProvider } from './code-storage-policy.provider';
import { FileAttachmentCommandService } from './file-attachment-command.service';

const pdf = (name = 'a.pdf', size = 10) => ({
  originalname: name,
  mimetype: 'application/pdf',
  size,
  buffer: Buffer.alloc(size, 1),
});

function setup(opts: { saveFails?: boolean } = {}) {
  const owner: FileOwnerPolicyPort = {
    ownerType: FileOwnerType.INVOICE,
    allowedCategories: () => ['HOA_DON', 'KHAC'],
    assertExists: jest.fn().mockResolvedValue(undefined),
    assertCanModify: jest.fn().mockResolvedValue(undefined),
  };
  const registry = new FileOwnerRegistry();
  registry.register(owner);
  const gateway = {
    upload: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const manager = {
    transaction: jest.fn((cb: (m: unknown) => unknown) =>
      cb({
        save: opts.saveFails
          ? jest.fn().mockRejectedValue(new Error('db'))
          : jest.fn((rows: unknown) => Promise.resolve(rows)),
      }),
    ),
  };
  const repo = {
    create: jest.fn((v: unknown) => v),
    findOne: jest.fn(),
    save: jest.fn((v: unknown) => Promise.resolve(v)),
    manager,
  };
  const service = new FileAttachmentCommandService(
    repo as never,
    gateway as never,
    registry,
    new CodeStoragePolicyProvider(),
  );
  return { service, owner, gateway, repo };
}

const base = {
  ownerType: FileOwnerType.INVOICE,
  ownerId: 'inv-1',
  category: 'HOA_DON' as const,
  userId: 'u1',
};

describe('FileAttachmentCommandService', () => {
  it('upload thành công: sanitize tên, key do server sinh, lưu checksum', async () => {
    const { service, gateway } = setup();
    const [row] = await service.upload({ ...base, files: [pdf('../x y.PDF')] });
    expect(row.fileName).toBe('x_y.pdf');
    expect(row.fileKey).toMatch(/^files\/invoice\/\d{4}\/\d{2}\/.+_x_y\.pdf$/);
    expect(row.checksumSha256).toHaveLength(64);
    expect(row.origin).toBe('V2');
    expect(gateway.upload).toHaveBeenCalledTimes(1);
  });

  it('từ chối đuôi không cho phép, không gọi R2', async () => {
    const { service, gateway } = setup();
    await expect(
      service.upload({ ...base, files: [{ ...pdf('a.exe') }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(gateway.upload).not.toHaveBeenCalled();
  });

  it('từ chối file quá dung lượng và MIME lạ', async () => {
    const { service } = setup();
    await expect(
      service.upload({ ...base, files: [pdf('a.pdf', 21 * 1024 * 1024)] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.upload({
        ...base,
        files: [{ ...pdf(), mimetype: 'text/html' }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('từ chối quá số file và nhóm không hợp lệ', async () => {
    const { service } = setup();
    await expect(
      service.upload({
        ...base,
        files: Array.from({ length: 11 }, () => pdf()),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.upload({ ...base, category: 'HOP_DONG', files: [pdf()] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('kiểm tra owner tồn tại và được phép sửa', async () => {
    const { service, owner } = setup();
    (owner.assertCanModify as jest.Mock).mockRejectedValue(new Error('khóa'));
    await expect(service.upload({ ...base, files: [pdf()] })).rejects.toThrow(
      'khóa',
    );
  });

  it('lỗi DB thì xóa object vừa upload', async () => {
    const { service, gateway } = setup({ saveFails: true });
    await expect(
      service.upload({ ...base, files: [pdf('a.pdf'), pdf('b.pdf')] }),
    ).rejects.toThrow('db');
    expect(gateway.delete).toHaveBeenCalledTimes(2);
  });

  it('xóa mềm: set cờ, không xóa object R2', async () => {
    const { service, repo, gateway } = setup();
    const row = { id: 'a1', isDeleted: false };
    repo.findOne.mockResolvedValue(row);
    const out = await service.softDeleteForOwner(
      FileOwnerType.INVOICE,
      'inv-1',
      'a1',
      'u1',
    );
    expect(out.isDeleted).toBe(true);
    expect(out.deletedBy).toBe('u1');
    expect(gateway.delete).not.toHaveBeenCalled();
  });

  it('xóa mềm attachment của owner khác thì 404 (IDOR)', async () => {
    const { service, repo } = setup();
    repo.findOne.mockResolvedValue(null);
    await expect(
      service.softDeleteForOwner(FileOwnerType.INVOICE, 'inv-1', 'x', 'u1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.findOne).toHaveBeenCalledWith({
      where: {
        id: 'x',
        ownerType: 'INVOICE',
        ownerId: 'inv-1',
        isDeleted: false,
      },
    });
  });
});
