import { NotificationsCoreService } from './notifications-core.service';

describe('NotificationsCoreService (producer API)', () => {
  it('createForUser chuyển tiếp sang command với một userId', async () => {
    const command = { createForUsers: jest.fn().mockResolvedValue(1) };
    const service = new NotificationsCoreService(command as any);

    await service.createForUser('u1', { title: 'T', message: 'M' });

    expect(command.createForUsers).toHaveBeenCalledWith(['u1'], {
      title: 'T',
      message: 'M',
    });
  });

  it('lỗi ghi thông báo bị nuốt, luồng gọi không bị ảnh hưởng', async () => {
    const command = {
      createForUsers: jest.fn().mockRejectedValue(new Error('db down')),
    };
    const service = new NotificationsCoreService(command as any);

    await expect(
      service.createForUsers(['u1', 'u2'], { title: 'T', message: 'M' }),
    ).resolves.toBeUndefined();
  });
});
