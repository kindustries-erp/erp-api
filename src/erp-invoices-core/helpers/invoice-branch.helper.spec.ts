import {
  isDaoTriOutInvoiceTaxCode,
  normalizeOutInvoiceLineDisplay,
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

  it('makes amount negative only when discount keyword exists and line count > 1', () => {
    const discountLine = normalizeOutInvoiceLineDisplay(
      {
        description: 'Chiết khấu cuối kỳ',
        unit: 'Cái',
        quantity: 2,
        unitPrice: 100000,
        preVatAmount: 200000,
        vatAmount: 0,
        totalAmount: 200000,
        discountAmount: 200000,
      },
      '0110269067',
      'OUT',
      2,
    );

    expect(discountLine.unit).toBe('Chiết khấu');
    expect(discountLine.preVatAmount).toBeLessThan(0);
    expect(discountLine.totalAmount).toBeLessThan(0);
    expect(discountLine.discountAmount).toBeLessThan(0);
  });

  it('does not make amount negative when keyword exists but only one line', () => {
    const singleLineDiscount = normalizeOutInvoiceLineDisplay(
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
      '0110269067',
      'OUT',
      1,
    );

    expect(singleLineDiscount.preVatAmount).toBe(120000);
    expect(singleLineDiscount.totalAmount).toBe(132000);
    expect(singleLineDiscount.discountAmount).toBe(120000);
  });

  it('does not make amount negative when line count > 1 but no discount keyword', () => {
    const nonKeyword = normalizeOutInvoiceLineDisplay(
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
      '0110269067',
      'OUT',
      3,
    );

    expect(nonKeyword.preVatAmount).toBe(120000);
    expect(nonKeyword.totalAmount).toBe(132000);
  });

  it('rescue keyword only changes unit, does not force negative without discount condition', () => {
    const rescueLine = normalizeOutInvoiceLineDisplay(
      {
        description: 'Dịch vụ Cứu hộ ban đêm',
        unit: 'Lần',
        quantity: 1,
        unitPrice: 500000,
        preVatAmount: 500000,
        vatAmount: 50000,
        totalAmount: 550000,
      },
      '0110269067',
      'OUT',
      2,
    );

    expect(rescueLine.unit).toBe('Cứu hộ');
    expect(rescueLine.totalAmount).toBe(550000);
  });

  it('supports khấu trừ keyword as discount trigger when line count > 1', () => {
    const withheldLine = normalizeOutInvoiceLineDisplay(
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
      '0110269067',
      'OUT',
      4,
    );

    expect(withheldLine.preVatAmount).toBe(-300000);
    expect(withheldLine.totalAmount).toBe(-330000);
    expect(withheldLine.unit).toBe('Chiết khấu');
  });

  it('keeps IN invoices unchanged even with discount keywords', () => {
    const inInvoiceLine = normalizeOutInvoiceLineDisplay(
      {
        description: 'Chiết khấu theo chính sách',
        unit: 'Lần',
        quantity: 1,
        unitPrice: 100000,
        preVatAmount: 100000,
        vatAmount: 10000,
        totalAmount: 110000,
        discountAmount: 100000,
      },
      '0110269067',
      'IN',
      3,
    );

    expect(inInvoiceLine.preVatAmount).toBe(100000);
    expect(inInvoiceLine.totalAmount).toBe(110000);
  });

  it('does not apply negative rule for non-Đào Trí tax code', () => {
    const otherBranchLine = normalizeOutInvoiceLineDisplay(
      {
        description: 'Chiết khấu theo hợp đồng',
        unit: 'Lần',
        quantity: 1,
        unitPrice: 90000,
        preVatAmount: 90000,
        vatAmount: 9000,
        totalAmount: 99000,
        discountAmount: 90000,
      },
      '9999999999',
      'OUT',
      2,
    );

    expect(otherBranchLine.preVatAmount).toBe(90000);
    expect(otherBranchLine.totalAmount).toBe(99000);
  });
});
