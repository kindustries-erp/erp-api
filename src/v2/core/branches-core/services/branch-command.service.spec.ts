import { BranchCommandService } from './branch-command.service';

describe('BranchCommandService', () => {
  const row = { id: 'branch-id', code: 'HN', name: 'Ha Noi', isActive: false };
  const repository = {
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
  };
  const service = new BranchCommandService(repository as never);

  beforeEach(() => {
    jest.clearAllMocks();
    repository.create.mockReturnValue(row);
    repository.save.mockResolvedValue(row);
    repository.findOne.mockResolvedValue(row);
    repository.update.mockResolvedValue({ affected: 1 });
    repository.delete.mockResolvedValue({ affected: 1 });
  });

  it('creates only code, name and is_active and retains the message', async () => {
    expect(
      await service.create({
        code: 'HN',
        name: 'Ha Noi',
        is_active: false,
        address: 'ignored',
        extra: 1,
      }),
    ).toEqual({ data: row, message: 'Branch created successfully' });
    expect(repository.create).toHaveBeenCalledWith({
      code: 'HN',
      name: 'Ha Noi',
      isActive: false,
    });
  });

  it('updates with unchanged undefined fields and returns null for a missing id', async () => {
    repository.findOne.mockResolvedValueOnce(null);
    expect(
      await service.update('missing', { name: 'Renamed', extra: 1 }),
    ).toEqual({
      data: null,
      message: 'Branch updated successfully',
    });
    expect(repository.update).toHaveBeenCalledWith('missing', {
      code: undefined,
      name: 'Renamed',
      isActive: undefined,
    });
    expect(repository.findOne).toHaveBeenCalledWith({
      where: { id: 'missing' },
    });
  });

  it('hard-deletes without a lookup, including a missing id', async () => {
    expect(await service.remove('missing')).toEqual({
      message: 'Branch deleted successfully',
    });
    expect(repository.delete).toHaveBeenCalledWith('missing');
  });

  it('propagates foreign-key errors without reporting success', async () => {
    const error = new Error('foreign key violation');
    repository.delete.mockRejectedValueOnce(error);
    await expect(service.remove('referenced')).rejects.toBe(error);
  });
});
