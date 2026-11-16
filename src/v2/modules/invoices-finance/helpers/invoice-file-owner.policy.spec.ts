import { NotFoundException } from '@nestjs/common';
import { FileOwnerRegistry } from '@/v2/core/storage-core';
import { InvoiceFileOwnerPolicy } from './invoice-file-owner.policy';

describe('InvoiceFileOwnerPolicy', () => {
  const setup = (exists: boolean) => {
    const repo = { exists: jest.fn().mockResolvedValue(exists) };
    const registry = new FileOwnerRegistry();
    const policy = new InvoiceFileOwnerPolicy(repo as never, registry);
    return { policy, repo, registry };
  };

  it('tự đăng ký INVOICE vào registry khi khởi động', () => {
    const { policy, registry } = setup(true);
    policy.onModuleInit();
    expect(registry.get('INVOICE')).toBe(policy);
  });

  it('hóa đơn tồn tại và chưa xóa thì qua', async () => {
    const { policy, repo } = setup(true);
    await expect(policy.assertExists('i1')).resolves.toBeUndefined();
    expect(repo.exists).toHaveBeenCalledWith({
      where: { id: 'i1', isDeleted: false },
    });
  });

  it('hóa đơn không tồn tại hoặc đã xóa thì 404', async () => {
    await expect(setup(false).policy.assertExists('i1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('cho phép sửa file ở mọi trạng thái (khớp V1) và cho đủ nhóm tài liệu', async () => {
    const { policy } = setup(true);
    await expect(policy.assertCanModify()).resolves.toBeUndefined();
    expect(policy.allowedCategories()).toEqual([
      'HOA_DON',
      'BANG_KE',
      'HOP_DONG',
      'KHAC',
    ]);
  });
});
