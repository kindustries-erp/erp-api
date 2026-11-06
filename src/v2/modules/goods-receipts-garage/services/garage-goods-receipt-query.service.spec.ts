import { Repository } from 'typeorm';
import { GarageGoodsReceipt } from '../entities/garage-goods-receipt.entity';
import { QueryGarageGoodsReceiptDto } from '../dto/query-garage-goods-receipt.dto';
import { GarageGoodsReceiptQueryService } from './garage-goods-receipt-query.service';

describe('GarageGoodsReceiptQueryService', () => {
  let qb: Record<string, jest.Mock>;
  let repo: { createQueryBuilder: jest.Mock; findOne: jest.Mock };
  let service: GarageGoodsReceiptQueryService;

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
    service = new GarageGoodsReceiptQueryService(
      repo as unknown as Repository<GarageGoodsReceipt>,
    );
  });

  it('excludes soft-deleted rows and paginates', async () => {
    const result = await service.findAll({
      page: 2,
      pageSize: 10,
    } as QueryGarageGoodsReceiptDto);

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
    await service.findAll({} as QueryGarageGoodsReceiptDto);

    expect(qb.orderBy).toHaveBeenCalledWith('e.createdAt', 'DESC');
  });

  it('applies the keyword to the searchable columns', async () => {
    await service.findAll({ search: '  abc ' } as QueryGarageGoodsReceiptDto);

    expect(qb.andWhere).toHaveBeenCalledTimes(1);
  });

  it('sums numeric columns over the filtered rows before paging', async () => {
    qb.getRawOne.mockResolvedValue({ totalAmount: 0 });

    const result = await service.findAll({
      page: 3,
      pageSize: 10,
    } as QueryGarageGoodsReceiptDto);

    expect(qb.select).toHaveBeenCalledWith(
      expect.stringContaining('COALESCE(SUM('),
      expect.any(String),
    );
    expect(result.summaries).toEqual({ totalAmount: 0 });
  });

  it('finds an active row by id', async () => {
    repo.findOne.mockResolvedValue({ id: 'id-1' });

    await expect(service.findById('id-1')).resolves.toEqual({ id: 'id-1' });
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { id: 'id-1', isDeleted: false },
      relations: ['lines'],
      order: { lines: { lineNo: 'ASC' } },
    });
  });
});
