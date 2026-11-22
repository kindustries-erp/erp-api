import { BranchExternalLinkService } from './branch-external-link.service';

describe('BranchExternalLinkService', () => {
  const repository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((d) => d),
    save: jest.fn((e) => Promise.resolve({ id: 'l1', ...e })),
  };
  let service: BranchExternalLinkService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BranchExternalLinkService(repository as never);
  });

  it('findByExternal không lọc account_key khi bỏ trống (GR và CN2 dùng chung external_id)', async () => {
    await service.findByExternal('KGARA', 'ext');
    expect(repository.find.mock.calls[0][0].where).toEqual({
      source: 'KGARA',
      externalId: 'ext',
      isDeleted: false,
    });
    await service.findByExternal('KGARA', 'ext', 'OJ');
    expect(repository.find.mock.calls[1][0].where.accountKey).toBe('OJ');
  });

  it('link tạo mới khi chưa có', async () => {
    repository.findOne.mockResolvedValue(null);
    const result = await service.link({
      branchId: 'b1',
      source: 'KGARA',
      externalId: 'ext',
      accountKey: 'MAIN',
    });
    expect(result.created).toBe(true);
    expect(repository.save).toHaveBeenCalledWith({
      branchId: 'b1',
      source: 'KGARA',
      externalId: 'ext',
      accountKey: 'MAIN',
    });
  });

  it('link idempotent: có sẵn thì không ghi', async () => {
    repository.findOne.mockResolvedValue({ id: 'l1' });
    const result = await service.link({
      branchId: 'b1',
      source: 'KGARA',
      externalId: 'ext',
    });
    expect(result).toEqual({ link: { id: 'l1' }, created: false });
    expect(repository.save).not.toHaveBeenCalled();
    expect(repository.findOne.mock.calls[0][0].where.accountKey).toBe('');
  });
});
