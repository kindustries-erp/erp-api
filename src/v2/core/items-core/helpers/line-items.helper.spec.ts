import { mergeCatalogItems, toLookupLines } from './line-items.helper';

describe('line-items.helper', () => {
  it('toLookupLines: bỏ dòng trống cả mã lẫn tên, giữ vị trí gốc', () => {
    const { lookup, indexes } = toLookupLines([
      { itemCode: 'a1', itemName: 'Pin' },
      { itemCode: '  ', itemName: '' },
      { itemName: 'Lọc dầu', unit: 'Cái' },
      { itemCode: 'b2' },
    ]);
    expect(indexes).toEqual([0, 2, 3]);
    expect(lookup.map((l) => l.itemName)).toEqual(['Pin', 'Lọc dầu', '']);
  });

  it('mergeCatalogItems: ghi mã chuẩn, chỉ điền tên/đơn vị khi dòng để trống', () => {
    const lines = [
      { itemCode: '90915', itemName: 'Tên tự gõ', unit: 'Bộ', qty: 1 },
      { itemName: 'Lọc dầu', unit: '', qty: 2 },
      { itemName: '', qty: 3 },
    ];
    const merged = mergeCatalogItems(
      lines,
      [0, 1],
      [
        { itemCode: 'PT-90915', itemName: 'Tên danh mục', unit: 'Cái' },
        { itemCode: 'PT-000001', itemName: 'Lọc dầu chuẩn', unit: 'Cái' },
      ],
    );
    expect(merged[0]).toEqual({
      itemCode: 'PT-90915',
      itemName: 'Tên tự gõ',
      unit: 'Bộ',
      qty: 1,
    });
    expect(merged[1]).toMatchObject({
      itemCode: 'PT-000001',
      itemName: 'Lọc dầu',
      unit: 'Cái',
      qty: 2,
    });
    expect(merged[2]).toBe(lines[2]);
    expect(lines[0].itemCode).toBe('90915');
  });

  it('mergeCatalogItems: không có mã khớp thì giữ nguyên dòng', () => {
    const lines = [{ itemName: 'Pin' }];
    expect(mergeCatalogItems(lines, [0], [undefined])[0]).toBe(lines[0]);
  });
});
