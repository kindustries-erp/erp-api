import {
  calculateRunningStockTransactions,
  resolveDocumentNumbers,
  RawStockTransactionRow,
} from './stock-ledger-transaction-calc.helper';

describe('stock-ledger-transaction-calc.helper', () => {
  const sampleRows: RawStockTransactionRow[] = [
    {
      id: 'tx1',
      transactionDate: new Date('2026-01-01'),
      transactionType: 'RECEIPT',
      documentType: 'PURCHASE_RECEIPT',
      documentId: 'doc1',
      qtyIn: '10',
      qtyOut: '0',
      unitCost: '100',
      createdAt: new Date('2026-01-01T08:00:00Z'),
    },
    {
      id: 'tx2',
      transactionDate: new Date('2026-01-05'),
      transactionType: 'RECEIPT',
      documentType: 'PURCHASE_RECEIPT',
      documentId: 'doc2',
      qtyIn: '10',
      qtyOut: '0',
      unitCost: '200',
    },
    {
      id: 'tx3',
      transactionDate: new Date('2026-01-10'),
      transactionType: 'ISSUE',
      documentType: 'ISSUE',
      documentId: 'doc3',
      qtyIn: '0',
      qtyOut: '15',
      unitCost: '150', // Giá bình quân ghi nhận lúc xuất
    },
  ];

  it('calculates running balance with WEIGHTED_AVG correctly', () => {
    const res = calculateRunningStockTransactions(sampleRows, 'WEIGHTED_AVG');

    expect(res).toHaveLength(3);
    // Row 1: Nhập 10 @ 100 -> Tồn 10, Tiền tồn 1000
    expect(res[0].balanceQty).toBe(10);
    expect(res[0].balanceValue).toBe(1000);
    expect(res[0].totalAmount).toBe(1000);
    expect(res[0].createdAt).toEqual(new Date('2026-01-01T08:00:00Z'));

    // Row 2: Nhập 10 @ 200 -> Tồn 20, Tiền tồn 3000
    expect(res[1].balanceQty).toBe(20);
    expect(res[1].balanceValue).toBe(3000);
    expect(res[1].totalAmount).toBe(2000);

    // Row 3: Xuất 15 @ 150 -> Tồn 5, Tiền tồn 750
    expect(res[2].balanceQty).toBe(5);
    expect(res[2].unitCost).toBe(150);
    expect(res[2].totalAmount).toBe(2250);
    expect(res[2].balanceValue).toBe(750);
  });

  it('calculates running balance with FIFO correctly', () => {
    const res = calculateRunningStockTransactions(sampleRows, 'FIFO');

    expect(res).toHaveLength(3);
    // Row 1: Nhập 10 @ 100
    expect(res[0].balanceQty).toBe(10);
    expect(res[0].balanceValue).toBe(1000);

    // Row 2: Nhập 10 @ 200
    expect(res[1].balanceQty).toBe(20);
    expect(res[1].balanceValue).toBe(3000);

    // Row 3: Xuất 15:
    // 10 cái lấy từ lô 1 @ 100 = 1000
    // 5 cái lấy từ lô 2 @ 200 = 1000
    // Tổng giá vốn FIFO = 2000. Đơn giá vốn FIFO = 2000 / 15 = 133.33
    // Tồn còn lại 5 cái của lô 2 @ 200 = 1000
    expect(res[2].balanceQty).toBe(5);
    expect(res[2].totalAmount).toBe(2000);
    expect(res[2].unitCost).toBe(133.33);
    expect(res[2].balanceValue).toBe(1000);
  });

  it('resolves document numbers from dataSource safely', async () => {
    const mockQuery = jest.fn().mockImplementation(async (sql: string) => {
      if (sql.includes('goods_receipts_garage')) {
        return [{ id: 'doc1', no: 'PN-001' }];
      }
      return [];
    });

    const mockDataSource = { query: mockQuery } as any;
    const docMap = await resolveDocumentNumbers(mockDataSource, [
      { documentType: 'PURCHASE_RECEIPT', documentId: 'doc1' },
      { documentType: 'OTHER_RECEIPT', documentId: 'doc2' },
    ]);

    expect(docMap.get('PURCHASE_RECEIPT:doc1')).toBe('PN-001');
    expect(docMap.get('OTHER_RECEIPT:doc2')).toBeUndefined();
  });
});
