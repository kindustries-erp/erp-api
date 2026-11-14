import { Repository } from 'typeorm';
import { Invoice } from '../entities/invoice.entity';
import { InvoiceItem } from '../entities/invoice-item.entity';
import { QueryInvoiceDto } from '../dto/query-invoice.dto';
import { applyListSummaries } from '@/common/utils/table-query';
import { InvoiceQueryService } from './finance-invoice-query.service';

jest.mock('@/common/utils/table-query', () => {
  const actual = jest.requireActual('@/common/utils/table-query');
  return { ...actual, applyListSummaries: jest.fn() };
});

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
      leftJoin: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
      getRawAndEntities: jest.fn().mockResolvedValue({ entities: [], raw: [] }),
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

  it('excludes soft-deleted rows and joins the netoff aggregate', async () => {
    await service.findAll({ page: 2, pageSize: 10 } as QueryInvoiceDto);

    expect(qb.where).toHaveBeenCalledWith('e.isDeleted = :isDeleted', {
      isDeleted: false,
    });
    expect(qb.leftJoin).toHaveBeenCalledWith(
      expect.stringContaining('erp_invoice_voucher_netoff'),
      'netoff_agg',
      'netoff_agg.invoice_id = e.id',
    );
  });

  it('pages with offset and limit and returns the page metadata', async () => {
    const result = await service.findAll({
      page: 2,
      pageSize: 10,
    } as QueryInvoiceDto);

    expect(qb.offset).toHaveBeenCalledWith(10);
    expect(qb.limit).toHaveBeenCalledWith(10);
    expect(result).toMatchObject({
      items: [],
      total: 0,
      page: 2,
      pageSize: 10,
    });
  });

  it('attaches netOffAmount and remainingAmount from the raw row', async () => {
    const entity = { id: 'inv-1' } as Invoice;
    qb.getRawAndEntities.mockResolvedValue({
      entities: [entity],
      raw: [{ e_id: 'inv-1', netOffAmount: '150', remainingAmount: '50' }],
    });

    const result = await service.findAll({} as QueryInvoiceDto);

    expect(result.items[0]).toMatchObject({
      id: 'inv-1',
      netOffAmount: 150,
      remainingAmount: 50,
    });
  });

  it('defaults to invoice date descending when no sort is given', async () => {
    await service.findAll({} as QueryInvoiceDto);

    expect(qb.orderBy).toHaveBeenCalledWith('e.invoiceDate', 'DESC');
  });

  it('filters by direction, partner tax code and tag', async () => {
    await service.findAll({
      direction: 'OUT',
      partner_tax_code: '0101',
      tag_id: 'tag-1',
    } as QueryInvoiceDto);

    expect(qb.andWhere).toHaveBeenCalledWith('e.direction = :direction', {
      direction: 'OUT',
    });
    expect(qb.andWhere).toHaveBeenCalledWith(
      '(e.sellerTaxCode = :ptc OR e.buyerTaxCode = :ptc)',
      { ptc: '0101' },
    );
    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('sys_entity_tags'),
      { tagId: 'tag-1' },
    );
  });

  it('filters by branch overlap and by blank branch', async () => {
    const branch = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

    await service.findAll({
      column_filters: JSON.stringify({ branchId: [branch, '__BLANK__'] }),
    } as QueryInvoiceDto);

    expect(qb.andWhere).toHaveBeenCalledWith(
      '(e.branchIds && CAST(:branchIds AS uuid[]) OR cardinality(e.branchIds) = 0)',
      { branchIds: [branch] },
    );
  });

  it('ignores branch values that are not uuids instead of casting them', async () => {
    await service.findAll({
      column_filters: JSON.stringify({ branchId: ['hn'] }),
    } as QueryInvoiceDto);

    expect(qb.andWhere).not.toHaveBeenCalledWith(
      expect.stringContaining('uuid[]'),
      expect.anything(),
    );
  });

  it('applies the keyword to the searchable columns', async () => {
    await service.findAll({ search: '  abc ' } as QueryInvoiceDto);

    expect(qb.andWhere).toHaveBeenCalledTimes(1);
  });

  it('computes summaries for the requested keys through applyListSummaries, before paging', async () => {
    const metric = { total: 900, pageSubtotal: 300, cumulative: 600 };
    (applyListSummaries as jest.Mock).mockResolvedValueOnce({
      totalAmount: metric,
      unknownKey: null,
    });

    const result = await service.findAll({
      page: 3,
      pageSize: 10,
      summary_keys: 'totalAmount,unknownKey',
    } as QueryInvoiceDto);

    expect(result.summaries).toEqual({ totalAmount: metric, unknownKey: null });
    expect(applyListSummaries).toHaveBeenCalledWith(
      qb,
      expect.objectContaining({
        keys: ['totalAmount', 'unknownKey'],
        page: 3,
        pageSize: 10,
        tieBreaker: 'e.id',
      }),
    );
    const summaryOrder = (applyListSummaries as jest.Mock).mock
      .invocationCallOrder[0];
    const offsetOrder = qb.offset.mock.invocationCallOrder[0];
    expect(summaryOrder).toBeLessThan(offsetOrder);
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
