import { ErpBusinessPartnerOptionsService } from './erp-business-partner-options.service';

describe('ErpBusinessPartnerOptionsService', () => {
  const build = (rows: unknown[]) => {
    const dataSource = { query: jest.fn().mockResolvedValue(rows) };
    const service = new ErpBusinessPartnerOptionsService(dataSource as never);
    return { service, dataSource };
  };

  it('maps rows, reads total from the window count and computes pages', async () => {
    const { service } = build([
      {
        partnerId: 'p1',
        code: 'KH-001',
        name: 'ABC',
        taxCode: '0100',
        partnerType: 'CUSTOMER',
        source: 'MASTER',
        total: '45',
      },
      {
        partnerId: null,
        code: null,
        name: 'XYZ',
        taxCode: '0200',
        partnerType: null,
        source: 'INVOICE',
        total: '45',
      },
    ]);

    const result = await service.listOptions({
      direction: 'OUT',
      page: 2,
      pageSize: 20,
    });

    expect(result.total).toBe(45);
    expect(result.totalPages).toBe(3);
    expect(result.page).toBe(2);
    expect(result.items[0]).toEqual({
      partnerId: 'p1',
      code: 'KH-001',
      name: 'ABC',
      taxCode: '0100',
      partnerType: 'CUSTOMER',
      source: 'MASTER',
    });
    expect(result.items[1].source).toBe('INVOICE');
    expect(result.items[1]).not.toHaveProperty('total');
  });

  it('passes direction, search pattern and offset as parameters, never inline', async () => {
    const { service, dataSource } = build([]);

    await service.listOptions({
      direction: 'IN',
      search: ' Phúc ',
      page: 3,
      pageSize: 10,
    });

    const [sql, params] = dataSource.query.mock.calls[0];
    expect(params).toEqual(['IN', '%Phúc%', 10, 20]);
    expect(sql).not.toContain('Phúc');
  });

  it('returns zero total when nothing matches', async () => {
    const { service } = build([]);
    await expect(
      service.listOptions({ direction: 'OUT', page: 1, pageSize: 20 }),
    ).resolves.toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    });
  });
});
