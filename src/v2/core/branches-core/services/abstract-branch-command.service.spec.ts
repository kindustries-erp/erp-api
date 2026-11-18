import { ConflictException, NotFoundException } from '@nestjs/common';
import { BranchReferencePort } from '../contracts/branch.contract';
import { BaseBranchEntity } from '../entities/base-branch.entity';
import { AbstractBranchCommandService } from './abstract-branch-command.service';

class TestBranch extends BaseBranchEntity {}

class TestCommandService extends AbstractBranchCommandService<TestBranch> {
  constructor(
    protected readonly repository: never,
    protected readonly references: BranchReferencePort,
  ) {
    super();
  }
}

describe('AbstractBranchCommandService', () => {
  const repository = {
    create: jest.fn((d) => ({ id: 'new', ...d })),
    save: jest.fn((e) => Promise.resolve(e)),
    update: jest.fn(),
    findOne: jest.fn(),
  };
  const references = { findReferences: jest.fn() };
  let service: TestCommandService;

  beforeEach(() => {
    jest.clearAllMocks();
    references.findReferences.mockResolvedValue([]);
    service = new TestCommandService(repository as never, references);
  });

  it('create chỉ gửi extraData khi client có gửi', async () => {
    await service.create({ code: 'GR', name: 'Greenway', is_active: true });
    expect(repository.create).toHaveBeenCalledWith({
      code: 'GR',
      name: 'Greenway',
      isActive: true,
    });
    await service.create({ code: 'GN', name: 'CN2', extraData: { a: 1 } });
    expect(repository.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ extraData: { a: 1 } }),
    );
  });

  it('update trả data null khi không có bản ghi sống, không ghi DB', async () => {
    repository.findOne.mockResolvedValueOnce(null);
    expect(await service.update('x', { name: 'N' })).toEqual({
      data: null,
      message: 'Branch updated successfully',
    });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('update merge extraData cấp 1 với dữ liệu đang lưu', async () => {
    repository.findOne
      .mockResolvedValueOnce({ id: 'b', extraData: { keep: 1, over: 1 } })
      .mockResolvedValueOnce({ id: 'b' });
    await service.update('b', { name: 'N', extraData: { over: 2 } });
    expect(repository.update).toHaveBeenCalledWith(
      'b',
      expect.objectContaining({ extraData: { keep: 1, over: 2 } }),
    );
  });

  it('remove xóa mềm khi không còn tham chiếu', async () => {
    repository.findOne.mockResolvedValue({ id: 'b' });
    expect(await service.remove('b')).toEqual({
      message: 'Branch deleted successfully',
    });
    expect(repository.update).toHaveBeenCalledWith('b', {
      isDeleted: true,
      isActive: false,
    });
  });

  it('remove trả 409 kèm danh sách bảng khi còn tham chiếu, không ghi DB', async () => {
    repository.findOne.mockResolvedValue({ id: 'b' });
    references.findReferences.mockResolvedValue([
      { table: 'erp_bank_accounts', count: 3 },
    ]);
    await expect(service.remove('b')).rejects.toBeInstanceOf(ConflictException);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('remove trả 404 khi chi nhánh không tồn tại hoặc đã xóa mềm', async () => {
    repository.findOne.mockResolvedValue(null);
    await expect(service.remove('b')).rejects.toBeInstanceOf(NotFoundException);
    expect(references.findReferences).not.toHaveBeenCalled();
  });
});
