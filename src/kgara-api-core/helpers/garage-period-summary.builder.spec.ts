import type { GarageDebtExportRow } from './garage-debts-export.helper';
import type { GaragePeriodReportData } from './garage-period-report.types';
import { summarizePeriod } from './garage-period-summary.builder';
import {
  buildCashflowKpis,
  buildDebtCards,
  buildPeriodDebtKpis,
} from './garage-period-summary-cards.helper';

const debtRow = (patch: Partial<GarageDebtExportRow>): GarageDebtExportRow => ({
  licensePlate: '30A-111.11',
  partnerCode: 'KH01',
  partnerName: 'Công ty A',
  caseCount: 1,
  totalAmount: 0,
  paidAmount: 0,
  balanceAmount: 0,
  aging0_30: 0,
  aging31_60: 0,
  aging61_90: 0,
  agingOver90: 0,
  maxAgingDays: 0,
  ...patch,
});

const data = (
  patch: Partial<GaragePeriodReportData> = {},
): GaragePeriodReportData => ({
  from: '2026-10-01',
  to: '2026-10-31',
  asOfDate: new Date(2026, 9, 16),
  pnlMonths: [],
  vouchers: [
    { type: 'RECEIPT', amount: 700 },
    { type: 'RECEIPT', amount: 300 },
    { type: 'PAYMENT', amount: 400 },
  ] as GaragePeriodReportData['vouchers'],
  customerRows: [
    debtRow({ totalAmount: 1000, paidAmount: 400, balanceAmount: 600 }),
    debtRow({ totalAmount: 500, paidAmount: 500, balanceAmount: 0 }),
  ],
  supplierRows: [
    debtRow({ totalAmount: 800, paidAmount: 300, balanceAmount: 500 }),
  ],
  openCustomerRows: [
    debtRow({ aging0_30: 100, aging31_60: 200 }),
    debtRow({ aging61_90: 300, agingOver90: 400 }),
  ],
  openSupplierRows: [debtRow({ aging0_30: 50, agingOver90: 150 })],
  ...patch,
});

describe('summarizePeriod', () => {
  it('thu, chi và dòng tiền ròng trong kỳ', () => {
    expect(summarizePeriod(data()).cashflow).toEqual({
      received: 1000,
      paid: 400,
      net: 600,
    });
  });

  it('công nợ phát sinh trong kỳ: cộng phát sinh, đã thu/trả, còn lại của từng phía', () => {
    const s = summarizePeriod(data());
    expect(s.periodReceivable).toEqual({
      total: 1500,
      paid: 900,
      balance: 600,
    });
    expect(s.periodPayable).toEqual({ total: 800, paid: 300, balance: 500 });
  });

  it('công nợ lũy kế: tuổi nợ 4 bậc, quá hạn và tỷ lệ cho từng phía', () => {
    const s = summarizePeriod(data());
    expect(s.receivable).toMatchObject({
      totalBalance: 1000,
      b31_60: 200,
      b61_90: 300,
      over90: 400,
      overdueAmount: 900,
      overdueRate: 0.9,
      level: 'HIGH',
    });
    expect(s.payable).toMatchObject({
      totalBalance: 200,
      overdueAmount: 150,
      overdueRate: 0.75,
    });
  });

  it('không có dữ liệu thì mọi số bằng 0', () => {
    const s = summarizePeriod(
      data({
        vouchers: [],
        customerRows: [],
        supplierRows: [],
        openCustomerRows: [],
        openSupplierRows: [],
      }),
    );
    expect(s.cashflow).toEqual({ received: 0, paid: 0, net: 0 });
    expect(s.periodReceivable).toEqual({ total: 0, paid: 0, balance: 0 });
    expect(s.receivable.level).toBe('OK');
  });
});

describe('card Dashboard', () => {
  const summary = summarizePeriod(data());

  it('thu chi trong kỳ: đúng 3 thẻ', () => {
    expect(buildCashflowKpis(summary)).toEqual([
      { label: 'ĐÃ THU TRONG KỲ', value: 1000 },
      { label: 'ĐÃ CHI TRONG KỲ', value: 400 },
      { label: 'DÒNG TIỀN RÒNG (THU - CHI)', value: 600 },
    ]);
  });

  it('công nợ trong kỳ: phải thu dùng "Đã thu", phải trả dùng "Đã trả"', () => {
    expect(
      buildPeriodDebtKpis('receivable', summary.periodReceivable).map(
        (k) => k.label,
      ),
    ).toEqual(['PHÁT SINH TRONG KỲ', 'ĐÃ THU', 'CÒN LẠI']);
    expect(
      buildPeriodDebtKpis('payable', summary.periodPayable).map((k) => [
        k.label,
        k.value,
      ]),
    ).toEqual([
      ['PHÁT SINH TRONG KỲ', 800],
      ['ĐÃ TRẢ', 300],
      ['CÒN LẠI', 500],
    ]);
  });

  it('công nợ lũy kế: đúng 5 thẻ, ghi chú % tổng nợ và không ghi số đối tượng', () => {
    const cards = buildDebtCards(summary.receivable);
    expect(cards.map((c) => c.label)).toEqual([
      'PHẢI THU: TỔNG NỢ CÒN MỞ',
      'PHẢI THU: NỢ 31-60 NGÀY',
      'PHẢI THU: NỢ 61-90 NGÀY',
      'PHẢI THU: NỢ TRÊN 90 NGÀY',
      'PHẢI THU: TỶ LỆ QUÁ HẠN',
    ]);
    expect(cards.map((c) => c.value)).toEqual([1000, 200, 300, 400, 0.9]);
    expect(cards[1].note).toBe('20,0% tổng nợ');
    expect(cards[4].numFmt).toBe('0.0%');
    expect(cards.some((c) => /đối tượng/.test(c.note ?? ''))).toBe(false);
  });

  it('bậc không có nợ: nền xám, ghi "Không có"', () => {
    const cards = buildDebtCards(
      summarizePeriod(data({ openSupplierRows: [] })).payable,
    );
    expect(cards.slice(1, 4).map((c) => [c.value, c.note, c.fill])).toEqual([
      [0, 'Không có', 'FFF1F5F9'],
      [0, 'Không có', 'FFF1F5F9'],
      [0, 'Không có', 'FFF1F5F9'],
    ]);
  });
});
