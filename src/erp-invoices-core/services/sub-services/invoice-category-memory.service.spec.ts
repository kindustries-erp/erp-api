import { InvoiceCategoryMemoryService } from './invoice-category-memory.service';

describe('InvoiceCategoryMemoryService', () => {
  const makeService = (query: jest.Mock) =>
    new InvoiceCategoryMemoryService({ manager: { query } } as any);
  const OLD = process.env.INVOICE_CATEGORY_MEMORY;

  afterEach(() => {
    if (OLD === undefined) delete process.env.INVOICE_CATEGORY_MEMORY;
    else process.env.INVOICE_CATEGORY_MEMORY = OLD;
  });

  it('recalls the dominant category for a known seller', async () => {
    const query = jest
      .fn()
      .mockResolvedValue([{ category_code: 'OPEX_LOGISTICS', n: 12 }]);
    const r = await makeService(query).recall(' 0312 650437 ');
    expect(r).toMatchObject({
      categoryCode: 'OPEX_LOGISTICS',
      confidence: 0.95,
      fromMemory: true,
    });
    expect(query).toHaveBeenCalledWith(expect.any(String), ['0312650437']);
  });

  it('returns null for mixed sellers, no tax code, VinFast MST or when disabled', async () => {
    const mixed = jest.fn().mockResolvedValue([
      { category_code: 'A', n: 5 },
      { category_code: 'B', n: 5 },
    ]);
    expect(await makeService(mixed).recall('123')).toBeNull();

    const never = jest.fn();
    expect(await makeService(never).recall(undefined)).toBeNull();
    expect(await makeService(never).recall('0108926276')).toBeNull();
    process.env.INVOICE_CATEGORY_MEMORY = 'off';
    expect(await makeService(never).recall('123')).toBeNull();
    expect(never).not.toHaveBeenCalled();
  });

  it('falls back to null (AI path) when the query fails', async () => {
    const query = jest.fn().mockRejectedValue(new Error('db down'));
    expect(await makeService(query).recall('123')).toBeNull();
  });
});
