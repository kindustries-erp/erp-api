import { buildInvoiceFileName, uniqueName } from './invoice-file-name.util';

describe('buildInvoiceFileName', () => {
  const inv = {
    invoiceDate: '2025-03-15',
    serialNo: 'C25TAA',
    invoiceNo: '0001234',
    totalAmount: '12500000.00',
  };

  it('builds date_serial_no_amount.ext', () => {
    expect(buildInvoiceFileName(inv, 'pdf')).toBe(
      '20250315_C25TAA_0001234_12500000.pdf',
    );
  });

  it('adds index suffix and lowercases ext', () => {
    expect(buildInvoiceFileName(inv, 'XML', 2)).toBe(
      '20250315_C25TAA_0001234_12500000_2.xml',
    );
  });

  it('rounds amount to whole VND', () => {
    expect(buildInvoiceFileName({ ...inv, totalAmount: '99.50' }, 'pdf')).toBe(
      '20250315_C25TAA_0001234_100.pdf',
    );
  });

  it('falls back when data is missing', () => {
    expect(
      buildInvoiceFileName(
        { id: 'abc', invoiceNo: null, totalAmount: null },
        'pdf',
      ),
    ).toBe('KhongNgay_KhongKyHieu_abc_0.pdf');
  });

  it('sanitizes forbidden characters and path traversal', () => {
    const name = buildInvoiceFileName(
      { ...inv, serialNo: '../C25/TAA', invoiceNo: 'A:B "1"' },
      'pdf',
    );
    expect(name).not.toMatch(/[\\/:"*?<>|]/);
    expect(name).not.toContain('..');
    expect(name).toBe('20250315_C25_TAA_A_B_1_12500000.pdf');
  });

  it('accepts Date objects', () => {
    expect(
      buildInvoiceFileName(
        { ...inv, invoiceDate: new Date('2025-03-15') },
        'pdf',
      ),
    ).toMatch(/^20250315_/);
  });
});

describe('uniqueName', () => {
  it('appends _2, _3 for duplicates', () => {
    const used = new Set<string>();
    expect(uniqueName('f/a.pdf', used)).toBe('f/a.pdf');
    expect(uniqueName('f/a.pdf', used)).toBe('f/a_2.pdf');
    expect(uniqueName('f/a.pdf', used)).toBe('f/a_3.pdf');
  });
});
