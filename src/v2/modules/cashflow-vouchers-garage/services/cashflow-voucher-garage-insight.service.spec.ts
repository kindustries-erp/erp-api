import {
  createSqlCapture,
  type SqlCapture,
} from '@/common/testing/sql-capture.testing';
import { CashflowVoucherGarage } from '../entities/cashflow-voucher-garage.entity';
import {
  CashflowVoucherGarageInsightService,
  normalizePlate,
  shiftDate,
} from './cashflow-voucher-garage-insight.service';

describe('CashflowVoucherGarageInsightService', () => {
  let cap: SqlCapture;
  let service: CashflowVoucherGarageInsightService;

  beforeEach(async () => {
    cap = await createSqlCapture([CashflowVoucherGarage]);
    service = new CashflowVoucherGarageInsightService(
      cap.dataSource.getRepository(CashflowVoucherGarage),
    );
  });

  it('helper: chuẩn hóa biển số, dịch ngày', () => {
    expect(normalizePlate('51a-123.45')).toBe('51A12345');
    expect(shiftDate('2026-11-01', -7)).toBe('2026-10-25');
  });

  it('dashboard: tính thu chi đã trả/dự kiến, net, bỏ phiếu hủy, lọc chi nhánh và kỳ', async () => {
    cap.respond(() => [
      {
        receipt_paid: '1000.00',
        payment_paid: '400.50',
        receipt_expected: '200.00',
        payment_expected: '50.00',
        voucher_count: '7',
      },
    ]);
    const out = await service.getDashboard('b1', {
      from: '2026-11-01',
      to: '2026-11-30',
    });
    expect(out).toEqual({
      receiptPaid: 1000,
      paymentPaid: 400.5,
      netPaid: 599.5,
      receiptExpected: 200,
      paymentExpected: 50,
      voucherCount: 7,
    });
    const { sql, params } = cap.calls[0];
    expect(sql).toContain('"v"."status" <> \'CANCELLED\'');
    expect(params).toEqual(
      expect.arrayContaining(['b1', '2026-11-01', '2026-11-30']),
    );
  });

  it('dashboard: không có dữ liệu thì trả 0 hết', async () => {
    cap.respond(() => []);
    expect(await service.getDashboard('b1', {})).toMatchObject({
      receiptPaid: 0,
      netPaid: 0,
      voucherCount: 0,
    });
  });

  it('duplicate-check: chi nhánh + số tiền + loại hủy; nhóm vụ việc/biển số chỉ chạy khi có tham số', async () => {
    cap.respond((sql) => (sql.includes('COUNT(') ? [{ cnt: '0' }] : []));
    const out = await service.findPotentialDuplicates('b1', { amount: 500 });
    expect(out.sameCase).toEqual({ items: [], total: 0 });
    expect(out.samePlate).toEqual({ items: [], total: 0 });
    for (const { sql, params } of cap.calls) {
      expect(sql).toContain('"v"."status" <> \'CANCELLED\'');
      expect(params).toEqual(expect.arrayContaining(['b1', 500]));
    }
    const nearbyOnly = cap.calls.length;
    cap.calls.length = 0;
    await service.findPotentialDuplicates('b1', {
      amount: 500,
      caseId: 'c1',
      licensePlate: '51A-1',
      excludeId: 'x',
    });
    expect(cap.calls.length).toBeGreaterThan(nearbyOnly);
    expect(cap.calls.some((c) => c.params.includes('51A1'))).toBe(true);
    expect(cap.calls.every((c) => c.params.includes('x'))).toBe(true);
  });
});
