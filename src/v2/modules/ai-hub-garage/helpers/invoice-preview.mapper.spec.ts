import { GarageItem } from '@/v2/modules/items-garage/entities/garage-item.entity';
import { toInvoicePreview } from './invoice-preview.mapper';

describe('toInvoicePreview', () => {
  const invoice = {
    sellerName: 'ABC',
    sellerTaxCode: null,
    invoiceNo: 'A1',
    invoiceDate: '2026-11-10',
    total: 1265000,
  };
  const extraction = (overrides = {}) => ({
    data: {
      invoice,
      lines: [
        {
          itemName: 'Lọc dầu',
          itemCode: '90915',
          unit: null,
          quantity: 2,
          unitPrice: 150000,
          itemType: 'PT' as const,
        },
        {
          itemName: 'Công thay',
          itemCode: null,
          unit: 'Lần',
          quantity: 1,
          unitPrice: 850000,
          itemType: 'DV' as const,
        },
      ],
      skippedLines: 0,
      ...overrides,
    },
    tier: 'low' as const,
    model: 'm-low',
    latencyMs: 9,
  });
  const matches = [
    {
      status: 'MATCHED' as const,
      matchedBy: 'CODE' as const,
      itemType: 'PT' as const,
      item: {
        id: 'i1',
        itemCode: 'PT-90915',
        itemName: 'Lọc dầu Toyota',
        unit: 'Cái',
      } as GarageItem,
    },
    { status: 'NEW' as const, itemType: 'DV' as const },
  ];

  it('ghép dòng với kết quả đối chiếu, không cảnh báo khi tổng lệch trong mức thuế', () => {
    const preview = toInvoicePreview(extraction(), matches);

    expect(preview.warnings).toEqual([]);
    expect(preview.ai).toEqual({ tier: 'low', model: 'm-low', latencyMs: 9 });
    expect(preview.lines[0]).toEqual({
      itemName: 'Lọc dầu',
      itemCode: 'PT-90915',
      unit: 'Cái',
      qtyRequested: 2,
      estUnitPrice: 150000,
      itemType: 'PT',
      lineType: 'GOODS',
      match: {
        status: 'MATCHED',
        matchedBy: 'CODE',
        itemId: 'i1',
        catalogItemName: 'Lọc dầu Toyota',
      },
    });
    expect(preview.lines[1]).toMatchObject({
      itemCode: null,
      unit: 'Lần',
      lineType: 'SERVICE',
      match: { status: 'NEW' },
    });
  });

  it('cảnh báo dòng bị bỏ, thiếu đơn giá và lệch tổng', () => {
    const data = extraction({
      skippedLines: 1,
      invoice: { ...invoice, total: 5000000 },
    });
    data.data.lines[1].unitPrice = null as unknown as number;

    expect(toInvoicePreview(data, matches).warnings).toEqual([
      'SKIPPED_LINES',
      'MISSING_UNIT_PRICE',
      'TOTAL_MISMATCH',
    ]);
  });
});
