import { classifyCashflowByRule } from './cashflow-rule-classifier';

describe('classifyCashflowByRule', () => {
  it('classifies loan parties in both directions before other rules', () => {
    expect(
      classifyCashflowByRule({
        isIn: true,
        correspondentName: 'NGUYEN NGOC HUY',
        description: 'chuyen tien',
      }),
    ).toEqual(
      expect.objectContaining({ classification: 'FINANCING', purpose: 'LOAN' }),
    );
    expect(
      classifyCashflowByRule({
        isIn: false,
        correspondentName: null,
        description: 'Mi Dề chuyển khoản',
      }),
    ).toEqual(expect.objectContaining({ purpose: 'LOAN' }));
  });

  it('classifies insurance claims only for inflows', () => {
    expect(
      classifyCashflowByRule({
        isIn: true,
        correspondentName: 'TONG CONG TY CP BAO MINHCONG TY BAO88 LANG HA',
        description: 'BT Xe',
      })?.purpose,
    ).toBe('INSURANCE_CLAIM');
    expect(
      classifyCashflowByRule({
        isIn: false,
        correspondentName: 'CT BAO HIEM PJICO',
        description: 'hoan phi',
      })?.purpose,
    ).not.toBe('INSURANCE_CLAIM');
  });

  it('treats company-name customer receipts as customer payments, not internal transfers', () => {
    expect(
      classifyCashflowByRule({
        isIn: true,
        correspondentName:
          'CONG TY CO PHAN GREENWAY AUTOMOTIVES-CHI NHANH NAM SAI GON',
        description: 'MS01T15456542678087,QR - PHAN CAO CUONG',
      }),
    ).toEqual(expect.objectContaining({ purpose: 'CUSTOMER_PAYMENT' }));
  });

  it('classifies EMB batch transfers (plate-number lines) as customer payments', () => {
    expect(
      classifyCashflowByRule({
        isIn: true,
        correspondentName: '(B/O TK TG CHUYEN TIEN THEO LO EMB KHDN) 50E11377',
        description: null,
      }),
    ).toEqual(
      expect.objectContaining({
        classification: 'OPERATING',
        purpose: 'CUSTOMER_PAYMENT',
      }),
    );
  });

  it('classifies internal transfers between company accounts', () => {
    expect(
      classifyCashflowByRule({
        isIn: false,
        correspondentName: 'CTCP GREENWAY AUTOMOTIVES-CN NAM SG',
        description: 'BDR-TKThe :111886 tai Techcombank. ND chuyen von noi bo',
      }),
    ).toEqual(
      expect.objectContaining({
        classification: 'OTHER',
        purpose: 'INTERNAL_TRANSFER',
      }),
    );
  });

  it('classifies outflow categories', () => {
    const purposeOf = (description: string, isIn = false) =>
      classifyCashflowByRule({ isIn, correspondentName: null, description })
        ?.purpose;
    expect(purposeOf('GREENWAY NSG THANH TOAN LUONG T2.2026')).toBe('SALARY');
    expect(purposeOf('CHUYEN KHOAN BHXH DONG THANG')).toBe('SOCIAL_INSURANCE');
    expect(purposeOf('PHI QUAN LY TAI KHOAN 868xxx168 T01 2026')).toBe(
      'BANK_FEE',
    );
    expect(purposeOf('Chuyen khoan tien thue kho thang 1.2026')).toBe('RENT');
    expect(purposeOf('Chuyen khoan tam ung chi phi van hanh')).toBe('ADVANCE');
    expect(purposeOf('Thanh toan phi ve sinh thang 12')).toBe('OPEX');
    expect(purposeOf('Thanh toan HD 489 vat tu son')).toBe('SUPPLIER_PAYMENT');
    expect(purposeOf('Chuyen khoan tien thi cong PCCC')).toBe('ASSET_PURCHASE');
    expect(purposeOf('Thu phi Homebanking thang 4/2026 cua thue bao')).toBe(
      'BANK_FEE',
    );
    expect(purposeOf('THU PHI QLTK T06/2026 TK 8680073168')).toBe('BANK_FEE');
    expect(purposeOf('Cty Greenway NSG tt tien dien nuoc t4')).toBe('OPEX');
  });

  it('flags POS settlements for a check in both directions', () => {
    expect(
      classifyCashflowByRule({
        isIn: true,
        correspondentName: null,
        description: 'TT POS 01677113 5 7352 540471 VCV',
        amount: 5000000,
      }),
    ).toEqual({
      classification: 'OPERATING',
      purpose: 'CUSTOMER_PAYMENT',
      reason: 'thu thẻ POS',
      flagForCheck: true,
    });
    expect(
      classifyCashflowByRule({
        isIn: false,
        correspondentName: null,
        description: 'TT POS 01677113 5 7352 540471 VCV',
        amount: 66220,
      }),
    ).toEqual(
      expect.objectContaining({ purpose: 'BANK_FEE', flagForCheck: true }),
    );
  });

  it('classifies internal BHXH transfers as internal even when they mention BHXH', () => {
    expect(
      classifyCashflowByRule({
        isIn: true,
        correspondentName: null,
        description:
          'Chuyen tien noi bo - BHXH10300TZ545 dong BHXH T07.2026 LVL PQ',
        amount: 22157860,
      }),
    ).toEqual(expect.objectContaining({ purpose: 'INTERNAL_TRANSFER' }));
  });

  it('classifies union fees only for outflows', () => {
    expect(
      classifyCashflowByRule({
        isIn: false,
        correspondentName: 'LIEN DOAN LAO DONG TP HO CHI MINH',
        description: 'Greenway nsg nop KPCD t72026',
        amount: 2217800,
      }),
    ).toEqual(expect.objectContaining({ purpose: 'SOCIAL_INSURANCE' }));
    expect(
      classifyCashflowByRule({
        isIn: false,
        correspondentName: 'LIEN DOAN LAO DONG TP HO CHI MINH',
        description: 'Greenway nsg nop tien cong doan t62026',
        amount: 2646000,
      }),
    ).toEqual(expect.objectContaining({ purpose: 'SOCIAL_INSURANCE' }));
  });

  it('classifies a 110.000 account-number-only outflow as bank fee, but not other amounts', () => {
    expect(
      classifyCashflowByRule({
        isIn: false,
        correspondentName: null,
        description: '886111',
        amount: 110000,
      }),
    ).toEqual(expect.objectContaining({ purpose: 'BANK_FEE' }));
    expect(
      classifyCashflowByRule({
        isIn: false,
        correspondentName: null,
        description: '886111',
        amount: 220000,
      }),
    ).toBeNull();
  });

  it('returns null when no rule matches so the row stays for manual review', () => {
    expect(
      classifyCashflowByRule({
        isIn: false,
        correspondentName: null,
        description: 'abc xyz',
      }),
    ).toBeNull();
  });
});
