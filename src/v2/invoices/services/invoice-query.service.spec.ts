import { Repository } from 'typeorm';
import { Invoice } from '../entities/invoice.entity';
import { InvoiceItem } from '../entities/invoice-item.entity';
import { QueryInvoiceDto } from '../dto/query-invoice.dto';
import { InvoiceQueryService } from './invoice-query.service';

describe('InvoiceQueryService', () => {
  let qb: Record<string, jest.Mock>;
  let repo: {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
    query: jest.Mock;
  };
  let service: InvoiceQueryService;

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
    repo = {
      createQueryBuilder: jest.fn(() => qb),
      findOne: jest.fn(),
      query: jest.fn(),
    };
    service = new InvoiceQueryService(
      repo as unknown as Repository<Invoice>,
      { find: jest.fn() } as unknown as Repository<InvoiceItem>,
    );
  });

  it('excludes soft-deleted rows and paginates', async () => {
    const result = await service.findAll({
      page: 2,
      pageSize: 10,
    } as QueryInvoiceDto);

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
    await service.findAll({} as QueryInvoiceDto);

    expect(qb.orderBy).toHaveBeenCalledWith('e.createdAt', 'DESC');
  });

  it('applies the keyword to the searchable columns', async () => {
    await service.findAll({ search: '  abc ' } as QueryInvoiceDto);

    expect(qb.andWhere).toHaveBeenCalledTimes(1);
  });

  it('sums numeric columns over the filtered rows before paging', async () => {
    qb.getRawOne.mockResolvedValue({
      preVatAmount: 0,
      vatRate: 0,
      vatAmount: 0,
      discountAmount: 0,
      totalAmount: 0,
    });

    const result = await service.findAll({
      page: 3,
      pageSize: 10,
    } as QueryInvoiceDto);

    expect(qb.select).toHaveBeenCalledWith(
      expect.stringContaining('COALESCE(SUM('),
      expect.any(String),
    );
    expect(result.summaries).toEqual({
      preVatAmount: 0,
      vatRate: 0,
      vatAmount: 0,
      discountAmount: 0,
      totalAmount: 0,
    });
  });

  it('finds an active row by id', async () => {
    repo.findOne.mockResolvedValue({ id: 'id-1' });

    await expect(service.findById('id-1')).resolves.toEqual({ id: 'id-1' });
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { id: 'id-1', isDeleted: false },
    });
  });
  it('finds only active branches by id', async () => {
    repo.query = jest.fn().mockResolvedValue([{ id: 'b1' }]);

    const found = await service.findExistingBranchIds(['b1', 'b2']);

    expect(found).toEqual(['b1']);
    expect(repo.query).toHaveBeenCalledWith(
      expect.stringContaining('is_active = true'),
      [['b1', 'b2']],
    );
  });

  it('returns no branches for an empty list without querying', async () => {
    repo.query = jest.fn();

    expect(await service.findExistingBranchIds([])).toEqual([]);
    expect(repo.query).not.toHaveBeenCalled();
  });
});
