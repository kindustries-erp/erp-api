import { TablePreferenceQueryService } from './table-preference-query.service';

describe('TablePreferenceQueryService', () => {
  let qb: any;
  let repo: any;
  let service: TablePreferenceQueryService;

  beforeEach(() => {
    qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    repo = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      findOne: jest.fn(),
    };
    service = new TablePreferenceQueryService(repo);
  });

  it('luôn lọc theo userId của token', async () => {
    await service.listForUser('u-1');

    expect(qb.where).toHaveBeenCalledWith('t.userId = :userId', {
      userId: 'u-1',
    });
    expect(qb.andWhere).not.toHaveBeenCalled();
  });

  it('lọc tiền tố bằng LIKE có escape ký tự đặc biệt', async () => {
    await service.listForUser('u-1', 'proc_%');

    expect(qb.andWhere).toHaveBeenCalledWith(
      "t.tableId LIKE :prefix ESCAPE '\\'",
      { prefix: 'proc\\_\\%%' },
    );
  });

  it('findOneForUser tìm theo cặp userId + tableId', async () => {
    await service.findOneForUser('u-1', 't-1');

    expect(repo.findOne).toHaveBeenCalledWith({
      where: { userId: 'u-1', tableId: 't-1' },
    });
  });
});
