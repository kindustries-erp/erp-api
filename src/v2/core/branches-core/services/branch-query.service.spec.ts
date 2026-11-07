import { BranchQueryService } from './branch-query.service';

describe('BranchQueryService', () => {
  const repository = { findAndCount: jest.fn() };
  const service = new BranchQueryService(repository as never);

  beforeEach(() => {
    jest.clearAllMocks();
    repository.findAndCount.mockResolvedValue([[], 0]);
  });

  it('preserves default pagination and ordering', async () => {
    expect(await service.findAll({})).toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    });
    expect(repository.findAndCount).toHaveBeenCalledWith({
      where: undefined,
      skip: 0,
      take: 20,
      order: { createdAt: 'DESC' },
    });
  });

  it('preserves ILIKE search, sort aliases, and does not filter inactive rows', async () => {
    const item = { isActive: false };
    repository.findAndCount.mockResolvedValueOnce([[item], 21]);
    expect(
      await service.findAll({
        page: 2,
        pageSize: 10,
        search: 'HN',
        sort: '-created_at',
      }),
    ).toEqual({
      items: [item],
      total: 21,
      page: 2,
      pageSize: 10,
      totalPages: 3,
    });
    const options = repository.findAndCount.mock.calls[0][0];
    expect(options.where).toEqual([
      expect.objectContaining({ code: expect.anything() }),
      expect.objectContaining({ name: expect.anything() }),
    ]);
    expect(options).toEqual(
      expect.objectContaining({
        skip: 10,
        take: 10,
        order: { createdAt: 'DESC' },
      }),
    );
    expect(JSON.stringify(options.where)).toContain('%HN%');
  });

  it('ignores an unsupported sort field', async () => {
    await service.findAll({ sort: 'unknownField' });
    expect(repository.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        order: { createdAt: 'DESC' },
      }),
    );
  });
});
