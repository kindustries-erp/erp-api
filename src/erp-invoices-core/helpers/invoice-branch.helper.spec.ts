import {
  isDaoTriOutInvoiceTaxCode,
  classifyInvoiceLine,
  resolveOutInvoiceBranchCode,
} from './out-invoice-display.helper';

describe('out-invoice-display.helper', () => {
  it('classifies Đào Trí OUT invoices by customer tax code first', () => {
    expect(
      resolveOutInvoiceBranchCode('UNKNOWN-WO-26-01-01-001', '0110269067'),
    ).toBe('ĐT');
    expect(
      resolveOutInvoiceBranchCode('S99999-WO-26-01-01-001', '0202357718'),
    ).toBe('ĐT');
    expect(isDaoTriOutInvoiceTaxCode('0108926276')).toBe(true);
  });

  it('falls back to settlement order prefixes when tax code does not match', () => {
    expect(
      resolveOutInvoiceBranchCode('S52801-WO-26-01-01-001', '0000000000'),
    ).toBe('ĐT');
    expect(
      resolveOutInvoiceBranchCode('S12345-WO-26-01-01-001', '0000000000'),
    ).toBe('PQ');
  });

  it('makes amount negative only when discount keyword exists, line count > 1, and taxInvoiceStatus = 1', () => {
    const discountLine = classifyInvoiceLine(
      {
        description: 'Chiết khấu cuối kỳ',
        unit: 'Cái',
        quantity: 2,
        unitPrice: 200000,
        preVatAmount: 200000,
        vatAmount: 0,
        totalAmount: 200000,
        discountAmount: 200000,
      },
      {
        buyerTaxCode: '0110269067',
        direction: 'OUT',
        invoiceLineCount: 2,
        taxInvoiceStatus: 1,
        headerDiscountAmount: 200000,
        forReportExport: true,
      },
    );

    expect(discountLine.invoiceSubcategory).toBe('DISCOUNT');
    expect(discountLine.preVatAmount).toBeLessThan(0);
    expect(discountLine.totalAmount).toBeLessThan(0);
    expect(discountLine.discountAmount).toBeLessThan(0);
  });

  it('makes amount negative even when taxInvoiceStatus is null (removed strict rule)', () => {
    const discountLine = classifyInvoiceLine(
      {
        description: 'Chiết khấu cuối kỳ',
        unit: 'Cái',
        quantity: 2,
        unitPrice: 200000,
        preVatAmount: 200000,
        vatAmount: 0,
        totalAmount: 200000,
        discountAmount: 200000,
      },
      {
        buyerTaxCode: '0110269067',
        direction: 'OUT',
        invoiceLineCount: 2,
        taxInvoiceStatus: null,
        headerDiscountAmount: 200000,
        forReportExport: true,
      },
    );

    expect(discountLine.invoiceSubcategory).toBe('DISCOUNT');
    expect(discountLine.preVatAmount).toBeLessThan(0);
    expect(discountLine.totalAmount).toBeLessThan(0);
  });

  it('does not make amount negative when keyword exists but only one line', () => {
    const singleLineDiscount = classifyInvoiceLine(
      {
        description: 'Giảm trừ hợp đồng',
        unit: 'Lần',
        quantity: 1,
        unitPrice: 120000,
        preVatAmount: 120000,
        vatAmount: 12000,
        totalAmount: 132000,
        discountAmount: 120000,
      },
      {
        buyerTaxCode: '0110269067',
        direction: 'OUT',
        invoiceLineCount: 1,
        taxInvoiceStatus: 1,
        headerDiscountAmount: 120000,
      },
    );

    expect(singleLineDiscount.invoiceSubcategory).toBe('NORMAL');
    expect(singleLineDiscount.preVatAmount).toBe(120000);
    expect(singleLineDiscount.totalAmount).toBe(132000);
    expect(singleLineDiscount.discountAmount).toBe(120000);
  });

  it('does not make amount negative when line count > 1 but no discount keyword', () => {
    const nonKeyword = classifyInvoiceLine(
      {
        description: 'Phí dịch vụ định kỳ',
        unit: 'Lần',
        quantity: 1,
        unitPrice: 120000,
        preVatAmount: 120000,
        vatAmount: 12000,
        totalAmount: 132000,
        discountAmount: 120000,
      },
      {
        buyerTaxCode: '0110269067',
        direction: 'OUT',
        invoiceLineCount: 3,
        taxInvoiceStatus: 1,
      },
    );

    expect(nonKeyword.invoiceSubcategory).toBe('NORMAL');
    expect(nonKeyword.preVatAmount).toBe(120000);
    expect(nonKeyword.totalAmount).toBe(132000);
  });

  it('rescue keyword sets invoiceSubcategory to RESCUE, unit is kept original, amounts not forced negative', () => {
    const rescueLine = classifyInvoiceLine(
      {
        description: 'Dịch vụ Cứu hộ ban đêm',
        unit: 'Lần',
        quantity: 1,
        unitPrice: 500000,
        preVatAmount: 500000,
        vatAmount: 50000,
        totalAmount: 550000,
      },
      {
        buyerTaxCode: '0110269067',
        direction: 'OUT',
        invoiceLineCount: 2,
        taxInvoiceStatus: 1,
      },
    );

    expect(rescueLine.invoiceSubcategory).toBe('RESCUE');
    // We don't return unit in InvoiceLineClassification anymore
    expect((rescueLine as any).unit).toBeUndefined();
    expect(rescueLine.totalAmount).toBe(550000);
  });

  it('supports khấu trừ keyword as discount trigger when line count > 1 and taxInvoiceStatus = 1', () => {
    const withheldLine = classifyInvoiceLine(
      {
        description: 'Khoản khấu trừ theo phụ lục',
        unit: 'Lần',
        quantity: 1,
        unitPrice: 300000,
        preVatAmount: 300000,
        vatAmount: 30000,
        totalAmount: 330000,
        discountAmount: 300000,
      },
      {
        buyerTaxCode: '0110269067',
        direction: 'OUT',
        invoiceLineCount: 4,
        taxInvoiceStatus: 1,
        headerDiscountAmount: 300000,
        forReportExport: true,
      },
    );

    expect(withheldLine.preVatAmount).toBe(-300000);
    expect(withheldLine.totalAmount).toBe(-330000);
    expect(withheldLine.invoiceSubcategory).toBe('DISCOUNT');
  });

  it('keeps IN invoices unchanged even with discount keywords', () => {
    const inInvoiceLine = classifyInvoiceLine(
      {
        description: 'Chiết khấu theo chính sách',
        unit: 'Lần',
        quantity: 1,
        unitPrice: 100000,
        preVatAmount: 100000,
        vatAmount: 10000,
        totalAmount: 110000,
      },
      {
        buyerTaxCode: '0110269067',
        direction: 'IN',
        invoiceLineCount: 2,
        taxInvoiceStatus: 1,
      },
    );

    expect(inInvoiceLine.preVatAmount).toBe(100000);
    expect(inInvoiceLine.invoiceSubcategory).toBe('NORMAL');
  });

  it('does not apply negative rule for non-Đào Trí tax code', () => {
    const nonDaoTriLine = classifyInvoiceLine(
      {
        description: 'Chiết khấu đầu năm',
        unit: 'Cái',
        quantity: 1,
        unitPrice: 50000,
        preVatAmount: 50000,
        vatAmount: 5000,
        totalAmount: 55000,
      },
      {
        buyerTaxCode: '0000000000',
        direction: 'OUT',
        invoiceLineCount: 3,
        taxInvoiceStatus: 1,
      },
    );

    expect(nonDaoTriLine.preVatAmount).toBe(50000);
    expect(nonDaoTriLine.invoiceSubcategory).toBe('NORMAL');
  });

  it('classifies discount rows for report export even when buyer tax code is not Đào Trí', () => {
    const nonDaoTriReportLine = classifyInvoiceLine(
      {
        description: 'Chiết khấu cuối kỳ',
        unit: 'Cái',
        quantity: 1,
        unitPrice: 50000,
        preVatAmount: 50000,
        vatAmount: 5000,
        totalAmount: 55000,
        discountAmount: 50000,
      },
      {
        buyerTaxCode: '0000000000',
        direction: 'OUT',
        invoiceLineCount: 3,
        headerDiscountAmount: 50000,
        forReportExport: true,
      },
    );

    expect(nonDaoTriReportLine.invoiceSubcategory).toBe('DISCOUNT');
    expect(nonDaoTriReportLine.preVatAmount).toBe(-50000);
  });
});
