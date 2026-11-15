import { AiJsonParseError } from '@/v2/core/ai-hub-core';
import {
  lineTypeOf,
  normalizeGarageInvoice,
  sumLineAmounts,
} from './garage-invoice-extraction.helper';

describe('garage-invoice-extraction.helper', () => {
  it('chuẩn hóa header và dòng hàng, loại dòng không hợp lệ', () => {
    const result = normalizeGarageInvoice({
      invoice: {
        sellerName: ' CÔNG TY  ABC ',
        invoiceNo: 1234,
        invoiceDate: '10/11/2026',
        total: '1.150.000',
      },
      lines: [
        {
          itemName: 'Lọc dầu',
          itemCode: ' 90915-yzzd2 ',
          unit: 'Cái',
          quantity: '2',
          unitPrice: '150.000',
          itemType: 'pt',
        },
        { itemName: 'Nhớt 5W30', quantity: 1.23456, itemType: 'XX' },
        { itemName: '', quantity: 1 },
        { itemName: 'Lỗi SL', quantity: 0 },
        'rác',
      ],
    });

    expect(result.invoice).toEqual({
      sellerName: 'CÔNG TY ABC',
      sellerTaxCode: null,
      invoiceNo: '1234',
      invoiceDate: null,
      total: 1150000,
    });
    expect(result.lines).toEqual([
      {
        itemName: 'Lọc dầu',
        itemCode: '90915-YZZD2',
        unit: 'Cái',
        quantity: 2,
        unitPrice: 150000,
        itemType: 'PT',
      },
      {
        itemName: 'Nhớt 5W30',
        itemCode: null,
        unit: null,
        quantity: 1.235,
        unitPrice: null,
        itemType: 'PT',
      },
    ]);
    expect(result.skippedLines).toBe(3);
  });

  it('giữ ngày đúng định dạng ISO', () => {
    const result = normalizeGarageInvoice({
      invoice: { invoiceDate: '2026-11-10' },
      lines: [{ itemName: 'A', quantity: 1 }],
    });
    expect(result.invoice.invoiceDate).toBe('2026-11-10');
  });

  it('ném lỗi khi không có dòng hàng hợp lệ', () => {
    expect(() => normalizeGarageInvoice({ lines: [] })).toThrow(
      AiJsonParseError,
    );
    expect(() => normalizeGarageInvoice({})).toThrow(AiJsonParseError);
  });

  it('lineTypeOf và sumLineAmounts', () => {
    expect(lineTypeOf('DV')).toBe('SERVICE');
    expect(lineTypeOf('PT')).toBe('GOODS');
    expect(
      sumLineAmounts([
        { quantity: 2, unitPrice: 150000 },
        { quantity: 1, unitPrice: null },
      ]),
    ).toBe(300000);
  });
});
