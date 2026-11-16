import { ConflictException } from '@nestjs/common';
import {
  FileOwnerRegistry,
  type FileOwnerPolicyPort,
} from '@/v2/core/storage-core';
import { FileAttachmentsService } from './file-attachments.service';

const row = {
  id: 'a1',
  ownerType: 'INVOICE',
  ownerId: 'inv-1',
  category: 'HOA_DON',
  isOriginal: false,
  fileName: 'a.pdf',
  fileKey: 'files/invoice/k',
  fileSize: '10',
  mimeType: 'application/pdf',
  origin: 'V2',
  createdBy: 'u1',
  createdAt: new Date('2026-11-16T00:00:00Z'),
  isDeleted: false,
  deletedAt: null,
  deletedBy: null,
};

function setup() {
  const owner: FileOwnerPolicyPort = {
    ownerType: 'INVOICE',
    allowedCategories: () => ['HOA_DON', 'KHAC'],
    assertExists: jest.fn().mockResolvedValue(undefined),
    assertCanModify: jest.fn(),
  };
  const registry = new FileOwnerRegistry();
  registry.register(owner);
  const command = {
    upload: jest.fn(),
    softDeleteForOwner: jest.fn(),
    softDeleteById: jest.fn(),
  };
  const query = {
    listByOwner: jest.fn().mockResolvedValue([row]),
    getForOwner: jest.fn().mockResolvedValue(row),
    getById: jest.fn().mockResolvedValue(row),
  };
  const purge = { purge: jest.fn() };
  const settings = { get: jest.fn(), update: jest.fn(), toResponse: jest.fn() };
  const gateway = {
    presignDownload: jest
      .fn()
      .mockResolvedValue({ url: 'https://s', expiresIn: 300 }),
  };
  const policies = {
    resolve: jest.fn().mockResolvedValue({ maxFileBytes: 1 }),
  };
  const service = new FileAttachmentsService(
    command as never,
    query as never,
    purge as never,
    settings as never,
    gateway as never,
    registry,
    policies as never,
  );
  return { service, owner, command, query, purge, gateway, policies };
}

describe('FileAttachmentsService (facade)', () => {
  it('listForOwner kiểm owner, trả items không lộ fileKey kèm policy và nhóm cho phép', async () => {
    const { service, owner, policies } = setup();
    const out = await service.listForOwner('INVOICE', 'inv-1');
    expect(owner.assertExists).toHaveBeenCalledWith('inv-1');
    expect(policies.resolve).toHaveBeenCalledWith('INVOICE', 'HOA_DON');
    expect(out.items).toHaveLength(1);
    expect(JSON.stringify(out)).not.toContain('files/invoice/k');
    expect(out.extraData.categories).toEqual(['HOA_DON', 'KHAC']);
    expect(out.extraData.policy).toEqual({ maxFileBytes: 1 });
  });

  it('downloadUrlForOwner khóa theo owner trước khi ký URL', async () => {
    const { service, query, gateway } = setup();
    const out = await service.downloadUrlForOwner(
      'INVOICE',
      'inv-1',
      'a1',
      true,
    );
    expect(query.getForOwner).toHaveBeenCalledWith('INVOICE', 'inv-1', 'a1');
    expect(gateway.presignDownload).toHaveBeenCalledWith(
      'files/invoice/k',
      'a.pdf',
      true,
    );
    expect(out.data.url).toBe('https://s');
  });

  it('purgeOne thành công trả kết quả của file', async () => {
    const { service, purge } = setup();
    purge.purge.mockResolvedValue({
      purged: [
        {
          id: 'a1',
          objectDeleted: true,
          objectKept: false,
          remainingReferences: 0,
        },
      ],
      skipped: [],
    });
    const out = await service.purgeOne('a1', 'u1');
    expect(purge.purge).toHaveBeenCalledWith(['a1'], {
      userId: 'u1',
      source: 'MANUAL',
    });
    expect(out.data).toMatchObject({ id: 'a1', objectDeleted: true });
  });

  it('purgeOne bị bỏ qua thì 409 kèm lý do', async () => {
    const { service, purge } = setup();
    purge.purge.mockResolvedValue({
      purged: [],
      skipped: [{ id: 'a1', reason: 'NOT_SOFT_DELETED' }],
    });
    await expect(service.purgeOne('a1', 'u1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
