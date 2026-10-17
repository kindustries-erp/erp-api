import type { GarageDebtExportRow } from './garage-debts-export.helper';
import type { GaragePeriodReportData } from './garage-period-report.types';
import { summarizePeriod } from './garage-period-summary.builder';
import {
  buildCashflowKpis,
  buildOverdueAlertCards,
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
      planned: 0,
    });
  });

  it('dự chi = phiếu chi Chờ duyệt + Đã duyệt; Đã chi vẫn cộng mọi phiếu chi', () => {
    const s = summarizePeriod(
      data({
        vouchers: [
          { type: 'RECEIPT', amount: 1000 },
          { type: 'PAYMENT', amount: 400, paymentStatus: 'PAID' },
          { type: 'PAYMENT', amount: 100, paymentStatus: 'PENDING' },
          { type: 'PAYMENT', amount: 50, paymentStatus: 'APPROVED' },
        ] as GaragePeriodReportData['vouchers'],
      }),
    );
    expect(s.cashflow).toEqual({
      received: 1000,
      paid: 550,
      net: 450,
      planned: 150,
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
    expect(s.cashflow).toEqual({ received: 0, paid: 0, net: 0, planned: 0 });
    expect(s.periodReceivable).toEqual({ total: 0, paid: 0, balance: 0 });
    expect(s.receivable.level).toBe('OK');
  });
});

describe('card Dashboard', () => {
  const summary = summarizePeriod(data());

  it('thu chi trong kỳ: đúng 4 thẻ, có Dự chi', () => {
    expect(buildCashflowKpis(summary)).toEqual([
      { label: 'ĐÃ THU TRONG KỲ', value: 1000 },
      { label: 'ĐÃ CHI TRONG KỲ', value: 400 },
      { label: 'DỰ CHI TRONG KỲ', value: 0 },
      { label: 'DÒNG TIỀN RÒNG (THU - CHI)', value: 600 },
    ]);
  });

  it('công nợ phát sinh: chỉ thẻ "Phát sinh trong kỳ" của hai phía', () => {
    expect(buildPeriodDebtKpis(summary)).toEqual([
      { label: 'PHẢI THU PHÁT SINH TRONG KỲ (KH)', value: 1500 },
      { label: 'PHẢI TRẢ PHÁT SINH TRONG KỲ (NCC)', value: 800 },
    ]);
  });

  it('cảnh báo lũy kế: đúng 4 thẻ 61-90 và trên 90 ngày của hai phía, ghi chú % tổng nợ', () => {
    const cards = buildOverdueAlertCards(summary.receivable, summary.payable);
    expect(cards.map((c) => c.label)).toEqual([
      'PHẢI THU: NỢ 61-90 NGÀY',
      'PHẢI THU: NỢ TRÊN 90 NGÀY',
      'PHẢI TRẢ: NỢ 61-90 NGÀY',
      'PHẢI TRẢ: NỢ TRÊN 90 NGÀY',
    ]);
    expect(cards.map((c) => c.value)).toEqual([300, 400, 0, 150]);
    expect(cards[0].note).toBe('30,0% tổng nợ');
    expect(cards.some((c) => /đối tượng/.test(c.note ?? ''))).toBe(false);
  });

  it('bậc không có nợ: nền xám, ghi "Không có"', () => {
    const s = summarizePeriod(data({ openSupplierRows: [] }));
    const cards = buildOverdueAlertCards(s.receivable, s.payable);
    expect(cards.slice(2).map((c) => [c.value, c.note, c.fill])).toEqual([
      [0, 'Không có', 'FFF1F5F9'],
      [0, 'Không có', 'FFF1F5F9'],
    ]);
  });
});
