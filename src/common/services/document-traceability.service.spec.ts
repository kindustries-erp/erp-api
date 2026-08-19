import { DocumentTraceabilityService } from './document-traceability.service';

describe('DocumentTraceabilityService', () => {
  let service: DocumentTraceabilityService;
  let mockDataSource: any;
  let mockRbacService: any;

  beforeEach(() => {
    mockDataSource = {
      query: jest.fn(),
    };
    mockRbacService = {
      hasPermission: jest.fn().mockResolvedValue(true),
    };
    service = new DocumentTraceabilityService(mockDataSource, mockRbacService);
  });

  it('should build invoice traceability graph with direct and transitive links', async () => {
    const invoiceId = 'inv-uuid-1';
    const poId = 'po-uuid-1';
    const txnId = 'txn-uuid-1';
    const glId = 'gl-uuid-1';

    // Mock invoice query
    mockDataSource.query.mockImplementation((sql: string, params: any[]) => {
      if (sql.includes('FROM erp_invoices WHERE id = $1')) {
        return Promise.resolve([
          {
            id: invoiceId,
            invoice_no: '0001234',
            serial_no: '1C26TGA',
            direction: 'IN',
            invoice_date: '2026-08-15',
            total_amount: '10000000',
            status: 'CONFIRMED',
            seller_name: 'Công ty Cơ khí ABC',
            purchase_order_id: poId,
            journal_entry_id: glId,
          },
        ]);
      }
      if (sql.includes('FROM erp_purchase_orders po')) {
        return Promise.resolve([
          {
            id: poId,
            po_no: 'PO-202608-001',
            order_date: '2026-08-10',
            total_amount: '10000000',
            status: 'COMPLETED',
            supplier_name: 'Công ty Cơ khí ABC',
          },
        ]);
      }
      if (sql.includes('FROM erp_invoice_voucher_netoff n')) {
        return Promise.resolve([
          {
            netoff_id: 'net-1',
            net_off_amount: '6000000',
            txn_id: txnId,
            invoice_id: invoiceId,
            source_type: 'BANK',
            trans_date: new Date('2026-08-16T10:00:00Z'),
            debit_amount: '6000000',
            credit_amount: '0',
            reference_number: 'BIDV-FT123',
            correspondent_name: 'Công ty Cơ khí ABC',
            bank_name: 'BIDV',
            account_number: '123456789',
          },
        ]);
      }

      if (sql.includes('FROM erp_journal_entries WHERE id = $1')) {
        return Promise.resolve([
          {
            id: glId,
            entry_no: 'HDM-202608-001',
            date: new Date('2026-08-15'),
            status: 'POSTED',
          },
        ]);
      }
      if (sql.includes('FROM erp_goods_receipts')) {
        return Promise.resolve([
          {
            id: 'gr-1',
            receipt_no: 'PNK-202608-001',
            receipt_date: '2026-08-12',
            status: 'COMPLETED',
            total_amount: '10000000',
          },
        ]);
      }
      if (sql.includes('FROM erp_journal_entries WHERE source_id = $1')) {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    const result = await service.getInvoiceTraceabilityGraph(invoiceId, {
      sub: 'user-1',
    });

    expect(result).toBeDefined();
    expect(result.rootId).toBe(invoiceId);
    expect(result.rootType).toBe('INVOICE');

    // Find Root Node
    const rootNode = result.nodes.find((n) => n.id === invoiceId);
    expect(rootNode).toBeDefined();
    expect(rootNode?.isCurrent).toBe(true);
    expect(rootNode?.docNo).toBe('0001234');
    expect(rootNode?.amount).toBe(10000000);

    // Verify PO Node and Transitive GR Node
    const poNode = result.nodes.find((n) => n.id === poId);
    expect(poNode).toBeDefined();
    expect(poNode?.docType).toBe('PURCHASE_ORDER');

    const grNode = result.nodes.find((n) => n.id === 'gr-1');
    expect(grNode).toBeDefined();
    expect(grNode?.docType).toBe('GOODS_RECEIPT');

    // Verify Bank Txn Node
    const bankNode = result.nodes.find((n) => n.id === txnId);
    expect(bankNode).toBeDefined();
    expect(bankNode?.docType).toBe('BANK_TXN');
    expect(bankNode?.netOffAmount).toBe(6000000);

    // Verify Summary
    expect(result.summary.totalAmount).toBe(10000000);
    expect(result.summary.totalNetOffAmount).toBe(6000000);
    expect(result.summary.matchRatio).toBe(60);
  });

  it('should mask restricted nodes when user lacks RBAC permission', async () => {
    const invoiceId = 'inv-uuid-1';
    const poId = 'po-uuid-1';

    mockDataSource.query.mockImplementation((sql: string) => {
      if (sql.includes('FROM erp_invoices WHERE id = $1')) {
        return Promise.resolve([
          {
            id: invoiceId,
            invoice_no: '0001234',
            serial_no: '1C26TGA',
            direction: 'IN',
            invoice_date: '2026-08-15',
            total_amount: '10000000',
            status: 'CONFIRMED',
            purchase_order_id: poId,
          },
        ]);
      }
      if (sql.includes('FROM erp_purchase_orders po')) {
        return Promise.resolve([
          {
            id: poId,
            po_no: 'PO-202608-001',
            order_date: '2026-08-10',
            total_amount: '10000000',
            status: 'COMPLETED',
          },
        ]);
      }
      return Promise.resolve([]);
    });

    // Mock RBAC: User has permission for invoices, but NOT for purchase_orders
    mockRbacService.hasPermission.mockImplementation(
      (userId: string, resource: string) => {
        if (resource === 'purchase_orders') return Promise.resolve(false);
        return Promise.resolve(true);
      },
    );

    const result = await service.getInvoiceTraceabilityGraph(invoiceId, {
      sub: 'warehouse-clerk',
    });

    const poNode = result.nodes.find((n) => n.id === poId);
    expect(poNode).toBeDefined();
    expect(poNode?.hasPermission).toBe(false);
    expect(poNode?.restricted).toBe(true);
    expect(poNode?.docNo).toBe('***');
    expect(poNode?.title).toBe('Chứng từ bảo mật');
    expect(poNode?.amount).toBeNull();
  });
});
