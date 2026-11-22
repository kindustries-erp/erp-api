import { ConflictException, NotFoundException } from '@nestjs/common';
import { BanksManagementCommandService } from './banks-management-command.service';

describe('BanksManagementCommandService', () => {
  let service: BanksManagementCommandService;
  let repo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(() => {
    repo = {
      findOne: jest.fn(),
      create: jest.fn((dto) => ({ ...dto, id: 'new-id' })),
      save: jest.fn((entity) => Promise.resolve(entity)),
    };
    service = new BanksManagementCommandService(repo as never);
  });

  describe('create', () => {
    it('creates a new bank when code is not taken', async () => {
      repo.findOne.mockResolvedValue(null);
      const res = await service.create({
        code: 'vcb',
        shortName: 'Vietcombank',
        name: 'Ngoại thương',
        bin: '970436',
      });
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { code: 'VCB', isDeleted: false },
      });
      expect(res.code).toBe('VCB');
      expect(repo.save).toHaveBeenCalled();
    });

    it('throws ConflictException if code already exists', async () => {
      repo.findOne.mockResolvedValue({ id: 'existing-id', code: 'VCB' });
      await expect(
        service.create({
          code: 'VCB',
          shortName: 'Vietcombank',
          name: 'Ngoại thương',
          bin: '970436',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('update', () => {
    it('updates existing bank fields successfully', async () => {
      const existing = { id: 'b1', code: 'VCB', isDeleted: false };
      repo.findOne.mockResolvedValue(existing);

      const res = await service.update('b1', { shortName: 'VCB New' });
      expect(res.shortName).toBe('VCB New');
      expect(repo.save).toHaveBeenCalled();
    });

    it('throws NotFoundException when bank does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(
        service.update('non-existent', { shortName: 'Test' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('softDelete', () => {
    it('marks bank as isDeleted', async () => {
      const existing = { id: 'b1', isDeleted: false };
      repo.findOne.mockResolvedValue(existing);

      await service.softDelete('b1');
      expect(existing.isDeleted).toBe(true);
      expect(repo.save).toHaveBeenCalledWith(existing);
    });
  });
});
