import { PaginationDto } from '@/common/dto/pagination.dto';
import { BaseBranchEntity } from '../entities/base-branch.entity';
import { AbstractBranchQueryService } from './abstract-branch-query.service';

class TestBranch extends BaseBranchEntity {}

class TestQueryService extends AbstractBranchQueryService<TestBranch> {
  constructor(protected readonly repository: never) {
    super();
  }
}

describe('AbstractBranchQueryService', () => {
  const findAndCount = jest.fn();
  let service: TestQueryService;

  beforeEach(() => {
    jest.clearAllMocks();
    findAndCount.mockResolvedValue([[{ id: 'b1' }], 41]);
    service = new TestQueryService({ findAndCount } as never);
  });

  it('chỉ lấy bản ghi chưa xóa mềm và phân trang mặc định', async () => {
    const result = await service.findAll({} as PaginationDto);
    expect(findAndCount).toHaveBeenCalledWith({
      where: [{ isDeleted: false }],
      skip: 0,
      take: 20,
      order: { createdAt: 'DESC' },
    });
    expect(result).toMatchObject({
      total: 41,
      page: 1,
      pageSize: 20,
      totalPages: 3,
    });
  });

  it('search lọc theo code hoặc name và vẫn giữ is_deleted = false ở cả hai nhánh', async () => {
    await service.findAll({ search: 'GR', page: 2, pageSize: 5 } as never);
    const arg = findAndCount.mock.calls[0][0];
    expect(arg.skip).toBe(5);
    expect(arg.take).toBe(5);
    expect(arg.where).toHaveLength(2);
    for (const clause of arg.where) expect(clause.isDeleted).toBe(false);
    expect(arg.where[0].code).toBeDefined();
    expect(arg.where[1].name).toBeDefined();
  });

  it('sort theo code', async () => {
    await service.findAll({ sort: 'code' } as never);
    expect(findAndCount.mock.calls[0][0].order).toEqual({ code: 'ASC' });
  });
});
