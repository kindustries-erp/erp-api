import { ConflictException } from '@nestjs/common';
import { BranchManagementCommandService } from './branch-management-command.service';

describe('BranchManagementCommandService', () => {
  it('xóa mềm qua repository, chặn khi cổng tham chiếu báo còn dùng', async () => {
    const repository = {
      findOne: jest.fn().mockResolvedValue({ id: 'b1' }),
      update: jest.fn(),
    };
    const references = { findReferences: jest.fn().mockResolvedValue([]) };
    const service = new BranchManagementCommandService(
      repository as never,
      references as never,
    );
    await service.remove('b1');
    expect(repository.update).toHaveBeenCalledWith('b1', {
      isDeleted: true,
      isActive: false,
    });

    references.findReferences.mockResolvedValue([
      { table: 'erp_cash_books', count: 1 },
    ]);
    await expect(service.remove('b1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
