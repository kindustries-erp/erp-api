import { NotFoundException } from '@nestjs/common';
import { NotificationInboxCommandService } from './notification-inbox-command.service';

function makeRepo(affected = 1) {
  return {
    create: jest.fn((x: unknown) => x),
    save: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue({ affected }),
  };
}

describe('NotificationInboxCommandService', () => {
  describe('createForUsers', () => {
    it('ghi một dòng cho mỗi user và bỏ trùng', async () => {
      const repo = makeRepo();
      const service = new NotificationInboxCommandService(repo as any);

      const count = await service.createForUsers(['a', 'b', 'a'], {
        title: 'T',
        message: 'M',
      });

      expect(count).toBe(2);
      const rows = repo.save.mock.calls[0][0];
      expect(rows.map((r: any) => r.userId)).toEqual(['a', 'b']);
      expect(rows[0]).toMatchObject({
        type: 'INFO',
        isRead: false,
        extraData: {},
      });
    });

    it('danh sách rỗng không ghi gì', async () => {
      const repo = makeRepo();
      const service = new NotificationInboxCommandService(repo as any);

      await expect(
        service.createForUsers([], { title: 'T', message: 'M' }),
      ).resolves.toBe(0);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('markRead / softDelete (sở hữu theo user)', () => {
    it('markRead lọc theo id + userId + isDeleted', async () => {
      const repo = makeRepo(1);
      const service = new NotificationInboxCommandService(repo as any);

      await service.markRead('n1', 'user-a');

      expect(repo.update).toHaveBeenCalledWith(
        { id: 'n1', userId: 'user-a', isDeleted: false },
        expect.objectContaining({ isRead: true }),
      );
    });

    it('id của user khác (affected = 0) ⇒ NotFound, không lộ sự tồn tại', async () => {
      const repo = makeRepo(0);
      const service = new NotificationInboxCommandService(repo as any);

      await expect(service.markRead('n1', 'user-b')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.softDelete('n1', 'user-b')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('softDelete đặt isDeleted = true, không xóa cứng', async () => {
      const repo = makeRepo(1);
      const service = new NotificationInboxCommandService(repo as any);

      await service.softDelete('n1', 'user-a');

      expect(repo.update).toHaveBeenCalledWith(
        { id: 'n1', userId: 'user-a', isDeleted: false },
        { isDeleted: true },
      );
    });
  });

  describe('bulk', () => {
    it('markAllRead chỉ đụng dòng chưa đọc của user', async () => {
      const repo = makeRepo(4);
      const service = new NotificationInboxCommandService(repo as any);

      await expect(service.markAllRead('user-a')).resolves.toBe(4);
      expect(repo.update).toHaveBeenCalledWith(
        { userId: 'user-a', isDeleted: false, isRead: false },
        expect.objectContaining({ isRead: true }),
      );
    });

    it('softDeleteAll chỉ đụng dòng của user', async () => {
      const repo = makeRepo(7);
      const service = new NotificationInboxCommandService(repo as any);

      await expect(service.softDeleteAll('user-a')).resolves.toBe(7);
      expect(repo.update).toHaveBeenCalledWith(
        { userId: 'user-a', isDeleted: false },
        { isDeleted: true },
      );
    });
  });
});
