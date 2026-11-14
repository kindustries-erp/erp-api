import { Repository } from 'typeorm';
import { applyListSummaries } from '@/common/utils/table-query';
import { GarageItem } from '../entities/garage-item.entity';
import { QueryGarageItemDto } from '../dto/query-garage-item.dto';
import { GarageItemQueryService } from './garage-item-query.service';

jest.mock('@/common/utils/table-query', () => ({
  ...jest.requireActual('@/common/utils/table-query'),
  applyListSummaries: jest.fn(),
}));

describe('GarageItemQueryService', () => {
  let qb: Record<string, jest.Mock>;
  let repo: { createQueryBuilder: jest.Mock; findOne: jest.Mock };
  let service: GarageItemQueryService;

  beforeEach(() => {
    qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getRawOne: jest.fn().mockResolvedValue({}),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    qb.clone = jest.fn(() => qb);
    repo = { createQueryBuilder: jest.fn(() => qb), findOne: jest.fn() };
    (applyListSummaries as jest.Mock).mockResolvedValue({});
    service = new GarageItemQueryService(
      repo as unknown as Repository<GarageItem>,
    );
  });

  it('excludes soft-deleted rows and paginates', async () => {
    const result = await service.findAll({
      page: 2,
      pageSize: 10,
    } as QueryGarageItemDto);

    expect(qb.where).toHaveBeenCalledWith('e.isDeleted = :isDeleted', {
      isDeleted: false,
    });
    expect(qb.skip).toHaveBeenCalledWith(10);
    expect(qb.take).toHaveBeenCalledWith(10);
    expect(result).toMatchObject({
      items: [],
      total: 0,
      page: 2,
      pageSize: 10,
    });
  });

  it('orders by createdAt descending when no sort is given', async () => {
    await service.findAll({} as QueryGarageItemDto);

    expect(qb.orderBy).toHaveBeenCalledWith('e.createdAt', 'DESC');
  });

  it('applies the keyword to the searchable columns', async () => {
    await service.findAll({ search: '  abc ' } as QueryGarageItemDto);

    expect(qb.andWhere).toHaveBeenCalledTimes(1);
  });

  it('finds an active row by id', async () => {
    repo.findOne.mockResolvedValue({ id: 'id-1' });

    await expect(service.findById('id-1')).resolves.toEqual({ id: 'id-1' });
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { id: 'id-1', isDeleted: false },
    });
  });
});
