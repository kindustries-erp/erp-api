import { BranchesManagementService } from './branches-management.service';

describe('BranchesManagementService', () => {
  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  const row = {
    id: 'id-1',
    extraData: {},
    code: 'HN',
    name: 'Ha Noi',
    address: null,
    isActive: false,
    createdAt,
    updatedAt: createdAt,
  };

  const query = { findAll: jest.fn() };
  const command = {
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
  let service: BranchesManagementService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BranchesManagementService(query as never, command as never);
  });

  it('maps list items without adding generated v2 summaries', async () => {
    const page = {
      items: [row],
      total: 41,
      page: 1,
      pageSize: 20,
      totalPages: 3,
    };
    query.findAll.mockResolvedValue(page);
    expect(await service.findAll({})).toEqual({
      items: page.items,
      pagination: {
        page: 1,
        pageSize: 20,
        total: 41,
        totalPages: 3,
        next: 2,
        previous: null,
      },
    });
  });

  it('keeps creation and update messages, including null on a missing row', async () => {
    const body = { code: 'HN', is_active: false, extra: 1 };
    command.create.mockResolvedValue({
      data: row,
      message: 'Branch created successfully',
    });
    command.update.mockResolvedValue({
      data: null,
      message: 'Branch updated successfully',
    });
    expect(await service.create(body)).toEqual({
      data: row,
      message: 'Branch created successfully',
    });
    expect(await service.update('missing', body)).toEqual({
      data: null,
      message: 'Branch updated successfully',
    });
    expect(command.create).toHaveBeenCalledWith(body);
    expect(command.update).toHaveBeenCalledWith('missing', body);
  });

  it('delegates soft delete without adding a data envelope', async () => {
    command.remove.mockResolvedValue({
      message: 'Branch deleted successfully',
    });
    expect(await service.remove('id-1')).toEqual({
      message: 'Branch deleted successfully',
    });
    expect(command.remove).toHaveBeenCalledWith('id-1');
  });
});
