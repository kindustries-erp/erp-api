import { BranchesCoreService } from './branches-core.service';

describe('BranchesCoreService', () => {
  const query = { findAll: jest.fn() };
  const command = { create: jest.fn(), update: jest.fn(), remove: jest.fn() };
  const service = new BranchesCoreService(query as never, command as never);

  beforeEach(() => jest.clearAllMocks());

  it('delegates every public legacy method unchanged', async () => {
    const options = { search: 'HN' };
    const body = { code: 'HN', is_active: false };
    const page = { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
    query.findAll.mockResolvedValue(page);
    command.create.mockResolvedValue({
      message: 'Branch created successfully',
    });
    command.update.mockResolvedValue({
      data: null,
      message: 'Branch updated successfully',
    });
    command.remove.mockResolvedValue({
      message: 'Branch deleted successfully',
    });
    expect(await service.findAll(options)).toEqual(page);
    expect(await service.create(body)).toEqual({
      message: 'Branch created successfully',
    });
    expect(await service.update('id', body)).toEqual({
      data: null,
      message: 'Branch updated successfully',
    });
    expect(await service.remove('id')).toEqual({
      message: 'Branch deleted successfully',
    });
    expect(query.findAll).toHaveBeenCalledWith(options);
    expect(command.create).toHaveBeenCalledWith(body);
    expect(command.update).toHaveBeenCalledWith('id', body);
    expect(command.remove).toHaveBeenCalledWith('id');
  });
});
