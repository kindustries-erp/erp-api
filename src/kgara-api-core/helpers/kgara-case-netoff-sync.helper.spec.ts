import {
  syncInvoiceNetOffToCaseSettlements,
  syncSingleCaseSettlementsFromInvoiceNetOffs,
} from './kgara-case-netoff-sync.helper';

describe('KgaraCaseNetoffSyncHelper (Pattern C Engine)', () => {
  let mockManager: any;

  beforeEach(() => {
    mockManager = {
      query: jest.fn(),
    };
  });

  it('syncInvoiceNetOffToCaseSettlements > skips when invoiceId is empty', async () => {
    await syncInvoiceNetOffToCaseSettlements(mockManager, '');
    expect(mockManager.query).not.toHaveBeenCalled();
  });

  it('syncInvoiceNetOffToCaseSettlements > skips when no linked cases exist', async () => {
    mockManager.query.mockResolvedValueOnce([]); // No linked cases
    await syncInvoiceNetOffToCaseSettlements(mockManager, 'inv-1');
    expect(mockManager.query).toHaveBeenCalledTimes(1);
  });

  it('syncInvoiceNetOffToCaseSettlements > syncs settlements and recalculates case balances', async () => {
    // 1. Linked cases query
    mockManager.query.mockResolvedValueOnce([
      { id: 'case-1', so_chung_tu: 'GR-PDV2608-0044' },
    ]);

    // 2. Case info query
    mockManager.query.mockResolvedValueOnce([
      {
        id: 'case-1',
        so_chung_tu: 'GR-PDV2608-0044',
        tien_co_thue: '6210000',
        doanh_thu: '6210000',
        raw_data: null,
      },
    ]);

    // 3. Net-offs query
    mockManager.query.mockResolvedValueOnce([
      {
        bank_transaction_id: 'txn-bidv-1',
        total_net_off: '4589000',
        trans_date: '2026-09-22',
        partner_name: 'BAO LONG',
        description: 'Chuyen tien sua xe',
        direction: 'OUT',
      },
    ]);

    // 4. Existing settlement check (none)
    mockManager.query.mockResolvedValueOnce([]);

    // 5. Insert settlement
    mockManager.query.mockResolvedValueOnce([]);

    // 6. Sum receipts
    mockManager.query.mockResolvedValueOnce([{ total_receipts: '6210000' }]);

    // 7. Update case
    mockManager.query.mockResolvedValueOnce([]);

    await syncInvoiceNetOffToCaseSettlements(mockManager, 'inv-1489');

    // Verify delete is never called on settlements
    expect(mockManager.query).not.toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM kgara_case_settlements'),
      expect.anything(),
    );

    // Verify insert settlement called with target values
    expect(mockManager.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO kgara_case_settlements'),
      expect.arrayContaining([
        'case-1',
        'txn-bidv-1',
        'RECEIPT',
        4589000,
        '2026-09-22',
        'BAO LONG',
      ]),
    );

    // Verify case updated with zero remaining balance
    expect(mockManager.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE kgara_cases'),
      [6210000, 6210000, 0, 'case-1'],
    );
  });

  it('syncSingleCaseSettlementsFromInvoiceNetOffs > updates existing settlement amount if present', async () => {
    // 1. Case info query
    mockManager.query.mockResolvedValueOnce([
      {
        id: 'case-1',
        so_chung_tu: 'GR-PDV2608-0044',
        tien_co_thue: '5000000',
        raw_data: null,
      },
    ]);

    // 2. Net-offs query
    mockManager.query.mockResolvedValueOnce([
      {
        bank_transaction_id: 'txn-1',
        total_net_off: '3000000',
        trans_date: '2026-09-22',
        partner_name: 'KH A',
        direction: 'OUT',
      },
    ]);

    // 3. Existing settlement check -> found id 'set-1'
    mockManager.query.mockResolvedValueOnce([{ id: 'set-1' }]);

    // 4. Update settlement
    mockManager.query.mockResolvedValueOnce([]);

    // 5. Sum receipts
    mockManager.query.mockResolvedValueOnce([{ total_receipts: '3000000' }]);

    // 6. Update case
    mockManager.query.mockResolvedValueOnce([]);

    await syncSingleCaseSettlementsFromInvoiceNetOffs(
      mockManager,
      'case-1',
      'GR-PDV2608-0044',
    );

    expect(mockManager.query).not.toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM kgara_case_settlements'),
      expect.anything(),
    );

    expect(mockManager.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE kgara_case_settlements'),
      [3000000, 'RECEIPT', '2026-09-22', 'KH A', 'set-1'],
    );

    expect(mockManager.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE kgara_cases'),
      [5000000, 3000000, 2000000, 'case-1'],
    );
  });
});
