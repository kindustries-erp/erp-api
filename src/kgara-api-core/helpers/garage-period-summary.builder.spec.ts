import type { GarageDebtExportRow } from './garage-debts-export.helper';
import { classifyVoucher } from './garage-ledger-classifier';
import type { GaragePeriodReportData } from './garage-period-report.types';
import { summarizePeriod } from './garage-period-summary.builder';
import {
  buildCashflowKpis,
  buildPeriodDebtKpis,
  trendNote,
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

/** Phiếu đã gắn nhóm dòng tiền như sổ quỹ Hub trả về. */
const ledger = (
  type: 'RECEIPT' | 'PAYMENT',
  amount: number,
  paymentStatus: string | null = null,
) =>
  ({
    type,
    amount,
    paymentStatus,
    category: classifyVoucher({ voucherType: type, paymentStatus }),
  }) as GaragePeriodReportData['vouchers'][number];

const data = (
  patch: Partial<GaragePeriodReportData> = {},
): GaragePeriodReportData => ({
  from: '2026-10-01',
  to: '2026-10-31',
  asOfDate: new Date(2026, 9, 16),
  pnlMonths: [],
  vouchers: [
    ledger('RECEIPT', 700, 'PAID'),
    ledger('RECEIPT', 300, 'PAID'),
    ledger('PAYMENT', 400, 'PAID'),
  ],
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
      expected: 0,
      paid: 400,
      net: 600,
      planned: 0,
    });
  });

  it('phiếu thu dự kiến (EXPECTED) không vào Đã thu mà vào Dự thu', () => {
    const s = summarizePeriod(
      data({
        vouchers: [
          ledger('RECEIPT', 1000, 'PAID'),
          ledger('RECEIPT', 250, 'EXPECTED'),
        ],
      }),
    );
    expect(s.cashflow).toEqual({
      received: 1000,
      expected: 250,
      paid: 0,
      net: 1000,
      planned: 0,
    });
  });

  it('Đã chi chỉ gồm phiếu PAID; Chờ duyệt + Đã duyệt là dự chi và không bị đếm vào Đã chi', () => {
    const s = summarizePeriod(
      data({
        vouchers: [
          ledger('RECEIPT', 1000, 'PAID'),
          ledger('PAYMENT', 400, 'PAID'),
          ledger('PAYMENT', 100, 'PENDING'),
          ledger('PAYMENT', 50, 'APPROVED'),
        ],
      }),
    );
    expect(s.cashflow).toEqual({
      received: 1000,
      expected: 0,
      paid: 400,
      net: 600,
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
    expect(s.cashflow).toEqual({
      received: 0,
      expected: 0,
      paid: 0,
      net: 0,
      planned: 0,
    });
    expect(s.periodReceivable).toEqual({ total: 0, paid: 0, balance: 0 });
    expect(s.receivable.level).toBe('OK');
  });
});

describe('card Dashboard', () => {
  const summary = summarizePeriod(data());

  it('công nợ phát sinh không có ±% khi không có kỳ trước', () => {
    expect(buildPeriodDebtKpis(summary).map((k) => k.note)).toEqual([
      undefined,
      undefined,
    ]);
  });

  it('công nợ phát sinh có ±% so với kỳ trước khi có số kỳ trước', () => {
    const s = summarizePeriod(
      data({
        previousPeriod: {
          vouchers: [],
          customerRows: [debtRow({ totalAmount: 1200 })],
          supplierRows: [debtRow({ totalAmount: 0 })],
        },
      }),
    );
    expect(buildPeriodDebtKpis(s).map((k) => k.note)).toEqual([
      '+25,0% so với kỳ trước',
      'Kỳ trước: 0',
    ]);
  });

  it('trendNote: tăng, không đổi, kỳ trước 0 và cả hai bằng 0', () => {
    expect(trendNote(150, 100)).toBe('+50,0% so với kỳ trước');
    expect(trendNote(100, 100)).toBe('Không đổi so với kỳ trước');
    expect(trendNote(0, 0)).toBe('Không đổi so với kỳ trước');
    expect(trendNote(50, 0)).toBe('Kỳ trước: 0');
    expect(trendNote(50, undefined)).toBeUndefined();
  });

  it('thẻ thu chi: có DỰ THU và DỰ CHI tách khỏi ĐÃ THU và ĐÃ CHI', () => {
    const s = summarizePeriod(
      data({
        vouchers: [
          ledger('RECEIPT', 1000, 'PAID'),
          ledger('RECEIPT', 250, 'EXPECTED'),
          ledger('PAYMENT', 400, 'PAID'),
          ledger('PAYMENT', 100, 'PENDING'),
        ],
      }),
    );
    expect(buildCashflowKpis(s).map((k) => [k.label, k.value])).toEqual([
      ['ĐÃ THU TRONG KỲ', 1000],
      ['DỰ THU TRONG KỲ', 250],
      ['ĐÃ CHI TRONG KỲ', 400],
      ['DỰ CHI TRONG KỲ', 100],
      ['DÒNG TIỀN RÒNG (THU - CHI)', 600],
    ]);
  });

  it('công nợ phát sinh: chỉ thẻ "Phát sinh trong kỳ" của hai phía', () => {
    expect(buildPeriodDebtKpis(summary)).toEqual([
      { label: 'PHẢI THU PHÁT SINH (KH)', value: 1500 },
      { label: 'PHẢI CHI PHÁT SINH (NCC)', value: 800 },
    ]);
  });
});
