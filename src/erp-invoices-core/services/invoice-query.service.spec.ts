import { InvoiceQueryService } from './invoice-query.service';
import * as queryBuilderUtil from '../../common/utils/query-builder.util';

describe('InvoiceQueryService', () => {
  const createQbMock = () => {
    const qb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    return qb;
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('exportExcel uses applyMultiKeywordFilter for invoiceNo column search', async () => {
    const qb = createQbMock();
    const repository = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      manager: { query: jest.fn().mockResolvedValue([]) },
    } as any;

    const service = new InvoiceQueryService(repository);
    const multiKeywordSpy = jest.spyOn(
      queryBuilderUtil,
      'applyMultiKeywordFilter',
    );

    await service.exportExcel({
      direction: 'IN',
      column_search: JSON.stringify({ invoiceNo: 'SO-123; SO-456' }),
    });

    expect(multiKeywordSpy).toHaveBeenCalledWith(
      qb,
      'inv.invoice_no',
      'SO-123; SO-456',
      'invoiceNoSearch',
    );

    const usedRawSimplePattern = qb.andWhere.mock.calls.some(
      (call: any[]) => call[0] === 'inv.invoice_no ILIKE :invoiceNoSearch',
    );
    expect(usedRawSimplePattern).toBe(false);
  });

  it('exportExcel uses multi-field helper for partner search when direction is omitted', async () => {
    const qb = createQbMock();
    const repository = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      manager: { query: jest.fn().mockResolvedValue([]) },
    } as any;

    const service = new InvoiceQueryService(repository);
    const multiFieldSpy = jest.spyOn(
      queryBuilderUtil,
      'applyMultiKeywordMultiFieldFilter',
    );

    await service.exportExcel({
      column_search: JSON.stringify({ partner: 'A; B' }),
    });

    expect(multiFieldSpy).toHaveBeenCalledWith(
      qb,
      ['inv.seller_name', 'inv.buyer_name'],
      'A; B',
      'partnerSearch',
    );
  });
});
