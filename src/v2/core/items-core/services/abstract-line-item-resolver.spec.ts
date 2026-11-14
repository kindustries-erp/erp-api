import type { EntityManager } from 'typeorm';
import type { ItemCatalogPort } from '../contracts/item-catalog.contract';
import {
  AbstractLineItemResolver,
  MANUAL_LINE_RESOLVE_OPTIONS,
} from './abstract-line-item-resolver';

type Ref = { itemCode: string; itemName: string; unit?: string };

class TestResolver extends AbstractLineItemResolver<Ref, 'AA'> {
  constructor(catalog: ItemCatalogPort<Ref, 'AA'>) {
    super(catalog);
  }
}

describe('AbstractLineItemResolver', () => {
  const manager = {} as EntityManager;
  const hit: Ref = { itemCode: 'AA-000001', itemName: 'Lọc dầu', unit: 'Cái' };
  let catalog: { match: jest.Mock; ensureItems: jest.Mock };
  let resolver: TestResolver;

  beforeEach(() => {
    catalog = {
      match: jest.fn().mockResolvedValue([{ status: 'MATCHED', item: hit }]),
      ensureItems: jest.fn().mockResolvedValue({ items: [hit], created: [] }),
    };
    resolver = new TestResolver(
      catalog as unknown as ItemCatalogPort<Ref, 'AA'>,
    );
  });

  it('mặc định tạo mã thiếu bằng cách chứng từ nhập tay, ghi mã chuẩn vào dòng', async () => {
    const result = await resolver.resolveLines(manager, [
      { itemName: 'Lọc dầu', qty: 2 },
    ]);
    expect(catalog.ensureItems).toHaveBeenCalledWith(
      [expect.objectContaining({ itemName: 'Lọc dầu' })],
      manager,
      MANUAL_LINE_RESOLVE_OPTIONS,
    );
    expect(result[0]).toMatchObject({
      itemCode: 'AA-000001',
      unit: 'Cái',
      qty: 2,
    });
  });

  it('create=false chỉ tra, không tạo', async () => {
    await resolver.resolveLines(manager, [{ itemCode: 'x', itemName: 'Y' }], {
      create: false,
    });
    expect(catalog.match).toHaveBeenCalledTimes(1);
    expect(catalog.ensureItems).not.toHaveBeenCalled();
  });

  it('create=false: mã không có trong danh mục thì giữ nguyên dòng', async () => {
    catalog.match.mockResolvedValue([{ status: 'NEW' }]);
    const lines = [{ itemCode: 'zz', itemName: 'Lạ' }];
    const result = await resolver.resolveLines(manager, lines, {
      create: false,
    });
    expect(result[0]).toBe(lines[0]);
  });

  it('không gọi danh mục khi mọi dòng trống mã và tên', async () => {
    const lines = [{ itemName: '', itemCode: '' }];
    expect(await resolver.resolveLines(manager, lines)).toBe(lines);
    expect(catalog.ensureItems).not.toHaveBeenCalled();
  });

  it('resolveLinesBy: tách theo cờ tạo mã và giữ thứ tự dòng', async () => {
    const result = await resolver.resolveLinesBy(
      manager,
      [
        { itemName: 'Lọc dầu', tag: 'in' },
        { itemName: 'Lọc dầu', tag: 'out' },
      ],
      (line) => line.tag === 'in',
    );
    expect(catalog.ensureItems).toHaveBeenCalledTimes(1);
    expect(catalog.match).toHaveBeenCalledTimes(1);
    expect(result.map((l) => l.tag)).toEqual(['in', 'out']);
    expect(
      result.every(
        (l) => (l as { itemCode?: string }).itemCode === 'AA-000001',
      ),
    ).toBe(true);
  });
});
