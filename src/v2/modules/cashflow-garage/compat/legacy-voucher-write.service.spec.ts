import { BadRequestException, NotFoundException } from '@nestjs/common';
import { KgaraCase } from '@/kgara-api-core/entities/kgara_case.entity';
import { CashflowAllocation, CashflowForecast } from '@/v2/core/cashflow-core';
import { CashflowGarageForecastExt } from '../entities/cashflow-garage-forecast-ext.entity';
import { LegacyVoucherWriteService } from './legacy-voucher-write.service';

type Row = Record<string, unknown>;

interface Fixture {
  header?: Row | null;
  ext?: Row | null;
  kCase?: Row | null;
  activePayments?: Array<{ id: string; bankTransactionId: string | null }>;
  recalcRows?: Array<{
    direction: string;
    status: string;
    paymentContent: string | null;
    debtCounted: boolean;
    amount: string;
  }>;
}

function makeHarness(fx: Fixture) {
  const manager = {
    findOne: jest.fn((entity: unknown) => {
      if (entity === CashflowForecast)
        return Promise.resolve(fx.header ?? null);
      if (entity === CashflowGarageForecastExt)
        return Promise.resolve(fx.ext ?? null);
      if (entity === KgaraCase) return Promise.resolve(fx.kCase ?? null);
      return Promise.resolve(null);
    }),
    create: jest.fn((_entity: unknown, values: Row) => ({
      id: 'new-id',
      ...values,
    })),
    save: jest.fn((value: unknown) => Promise.resolve(value)),
    update: jest.fn(() => Promise.resolve({})),
    delete: jest.fn(() => Promise.resolve({})),
    query: jest.fn((sql: string) => {
      if (sql.includes('INSERT INTO cashflow_payments'))
        return Promise.resolve([{ id: 'pay-new' }]);
      if (sql.includes('e.payment_content AS "paymentContent"'))
        return Promise.resolve(fx.recalcRows ?? []);
      if (
        sql.includes('a.forecast_id = $1') &&
        sql.includes('FROM cashflow_allocations')
      )
        return Promise.resolve(fx.activePayments ?? []);
      return Promise.resolve([]);
    }),
  };
  const dataSource = {
    transaction: jest.fn((cb: (m: unknown) => Promise<unknown>) => cb(manager)),
  };
  const receivables = { syncCaseReceipts: jest.fn(() => Promise.resolve()) };
  const service = new LegacyVoucherWriteService(
    dataSource as never,
    receivables as never,
  );
  return { service, manager };
}

const outHeader = (over: Row = {}): Row => ({
  id: 'fc-1',
  code: 'PC-GARA-261101-001',
  direction: 'OUT',
  status: 'OPEN',
  amount: '300',
  plannedDate: '2026-11-01',
  partnerName: 'NCC A',
  note: null,
  isDeleted: false,
  sourceType: null,
  ...over,
});

const ext = (over: Row = {}): Row => ({
  forecastId: 'fc-1',
  caseId: null,
  licensePlate: null,
  paymentContent: null,
  legacyPaymentMethod: null,
  legacyCreatedBy: null,
  ...over,
});

const kCase = (over: Row = {}): Row => ({
  id: 'case-1',
  bienSoXe: '51A-123',
  khachHangName: 'KH B',
  rawData: { TongTienThanhToan: 1000, TienDaThanhToan: 200 },
  ...over,
});

const callsWith = (fn: jest.Mock, needle: string) =>
  fn.mock.calls.filter((c) => String(c[0]).includes(needle));

describe('LegacyVoucherWriteService', () => {
  describe('createVoucher', () => {
    it('phiếu chi đã chi: tạo dự chi (SETTLED), thực chi và phân bổ, rồi tính lại công nợ theo phiếu dịch vụ', async () => {
      const { service, manager } = makeHarness({
        kCase: kCase(),
        recalcRows: [
          {
            direction: 'OUT',
            status: 'SETTLED',
            paymentContent: null,
            debtCounted: true,
            amount: '300',
          },
        ],
      });

      const result = await service.createVoucher(
        {
          voucherType: 'PAYMENT',
          amount: 300,
          paymentStatus: 'PAID',
          paymentMethod: 'Chuyển khoản',
          caseId: 'case-1',
          erpBankTransactionId: 'bt-1',
        } as never,
        { sub: 'user-1', email: 'a@b.c' },
      );

      expect(result.id).toBe('new-id');
      const header = manager.save.mock.calls[0][0] as Row;
      expect(header.status).toBe('SETTLED');
      expect(header.direction).toBe('OUT');
      expect(
        callsWith(manager.query, 'INSERT INTO cashflow_payments'),
      ).toHaveLength(1);
      const paymentParams = callsWith(
        manager.query,
        'INSERT INTO cashflow_payments',
      )[0][1] as unknown[];
      expect(paymentParams[4]).toBe('BANK');
      expect(paymentParams[5]).toBe('bt-1');
      const allocation = manager.create.mock.calls.find(
        (c) => c[0] === CashflowAllocation,
      );
      expect(allocation?.[1]).toMatchObject({
        paymentId: 'pay-new',
        forecastId: 'new-id',
        amount: '300',
      });
      expect(manager.update).toHaveBeenCalledWith(
        KgaraCase,
        { id: 'case-1' },
        { tienDaThanhToan: 0, tienConPhaiThanhToan: 1000 },
      );
    });

    it('phiếu thu đang dự thu (EXPECTED): không tạo thực thu, dự thu OPEN', async () => {
      const { service, manager } = makeHarness({});
      await service.createVoucher({
        voucherType: 'RECEIPT',
        amount: 500,
        paymentStatus: 'EXPECTED',
      } as never);

      const header = manager.save.mock.calls[0][0] as Row;
      expect(header.status).toBe('OPEN');
      expect(header.direction).toBe('IN');
      expect(
        callsWith(manager.query, 'INSERT INTO cashflow_payments'),
      ).toHaveLength(0);
      expect(manager.update).not.toHaveBeenCalled();
    });

    it('phiếu chi chưa duyệt (mặc định PENDING): trạng thái DRAFT, không thực chi', async () => {
      const { service, manager } = makeHarness({});
      await service.createVoucher({
        voucherType: 'PAYMENT',
        amount: 100,
      } as never);

      const header = manager.save.mock.calls[0][0] as Row;
      expect(header.status).toBe('DRAFT');
      expect(
        callsWith(manager.query, 'INSERT INTO cashflow_payments'),
      ).toHaveLength(0);
    });

    it('phiếu dịch vụ không tồn tại thì báo lỗi, không ghi gì', async () => {
      const { service, manager } = makeHarness({ kCase: null });
      await expect(
        service.createVoucher({
          voucherType: 'RECEIPT',
          amount: 1,
          caseId: 'x',
        } as never),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(manager.save).not.toHaveBeenCalled();
    });
  });

  describe('updateVoucher', () => {
    it('phiếu chi đã chi bị khóa: không đổi sang trạng thái khác', async () => {
      const { service } = makeHarness({
        header: outHeader({ status: 'SETTLED' }),
        ext: ext(),
      });
      await expect(
        service.updateVoucher('fc-1', { paymentStatus: 'PENDING' } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('phiếu chi đã chi bị khóa: không đổi loại phiếu', async () => {
      const { service } = makeHarness({
        header: outHeader({ status: 'SETTLED' }),
        ext: ext(),
      });
      await expect(
        service.updateVoucher('fc-1', { voucherType: 'RECEIPT' } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('đổi số tiền khi đã chi: cập nhật cả thực chi và phân bổ', async () => {
      const { service, manager } = makeHarness({
        header: outHeader({ status: 'SETTLED' }),
        ext: ext(),
        activePayments: [{ id: 'pay-1', bankTransactionId: null }],
      });
      await service.updateVoucher('fc-1', { amount: 450 } as never);

      expect(
        callsWith(manager.query, 'UPDATE cashflow_allocations SET amount'),
      ).toHaveLength(1);
      expect(
        callsWith(
          manager.query,
          'UPDATE cashflow_allocations SET amount',
        )[0][1],
      ).toEqual(['pay-1', '450', 'fc-1']);
      expect(
        callsWith(manager.query, 'INSERT INTO cashflow_payments'),
      ).toHaveLength(0);
    });

    it('phiếu chi đang OPEN được đánh dấu Đã chi: tạo thực chi và phân bổ mới', async () => {
      const { service, manager } = makeHarness({
        header: outHeader({ status: 'OPEN' }),
        ext: ext(),
        activePayments: [],
      });
      await service.updateVoucher('fc-1', { paymentStatus: 'PAID' } as never);

      const header = manager.save.mock.calls[0][0] as Row;
      expect(header.status).toBe('SETTLED');
      expect(
        callsWith(manager.query, 'INSERT INTO cashflow_payments'),
      ).toHaveLength(1);
    });

    it('phiếu thu đã thu chuyển về dự thu: hủy thực thu và phân bổ', async () => {
      const { service, manager } = makeHarness({
        header: outHeader({ direction: 'IN', status: 'SETTLED' }),
        ext: ext({ caseId: 'case-1' }),
        kCase: kCase(),
        activePayments: [{ id: 'pay-1', bankTransactionId: null }],
      });
      await service.updateVoucher('fc-1', {
        paymentStatus: 'EXPECTED',
      } as never);

      const header = manager.save.mock.calls[0][0] as Row;
      expect(header.status).toBe('OPEN');
      expect(callsWith(manager.query, "SET status = 'CANCELLED'")).toHaveLength(
        1,
      );
      expect(
        callsWith(manager.query, 'DELETE FROM cashflow_allocations'),
      ).toHaveLength(1);
    });

    it('đổi loại phiếu khi đã có thực thu/chi: báo lỗi', async () => {
      const { service } = makeHarness({
        header: outHeader({ status: 'OPEN' }),
        ext: ext(),
        activePayments: [{ id: 'pay-1', bankTransactionId: null }],
      });
      await expect(
        service.updateVoucher('fc-1', { voucherType: 'RECEIPT' } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('deleteVoucher', () => {
    it('phiếu đã liên kết giao dịch ngân hàng: chặn xóa', async () => {
      const { service, manager } = makeHarness({
        header: outHeader({ status: 'SETTLED' }),
        ext: ext(),
        activePayments: [{ id: 'pay-1', bankTransactionId: 'bt-1' }],
      });
      await expect(service.deleteVoucher('fc-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('xóa mềm: đánh dấu isDeleted, hủy thực chi và tính lại công nợ từ rawData khi không còn phân bổ', async () => {
      const header = outHeader({ status: 'SETTLED' });
      const { service, manager } = makeHarness({
        header,
        ext: ext({ caseId: 'case-1' }),
        kCase: kCase(),
        activePayments: [{ id: 'pay-1', bankTransactionId: null }],
      });
      await service.deleteVoucher('fc-1');

      expect(header.isDeleted).toBe(true);
      expect(
        callsWith(manager.query, 'DELETE FROM cashflow_allocations'),
      ).toHaveLength(1);
      expect(manager.update).toHaveBeenCalledWith(
        KgaraCase,
        { id: 'case-1' },
        { tienDaThanhToan: 200, tienConPhaiThanhToan: 800 },
      );
    });

    it('phiếu không tồn tại hoặc đã xóa: báo không tìm thấy', async () => {
      const { service } = makeHarness({ header: null, ext: null });
      await expect(service.deleteVoucher('fc-x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('công nợ phiếu dịch vụ', () => {
    it('có phân bổ: công nợ lấy tổng thực thu IN, không lấy rawData', async () => {
      const { service, manager } = makeHarness({
        header: outHeader({ direction: 'IN', status: 'SETTLED' }),
        ext: ext({ caseId: 'case-1' }),
        kCase: kCase(),
        activePayments: [{ id: 'pay-1', bankTransactionId: null }],
        recalcRows: [
          {
            direction: 'IN',
            status: 'SETTLED',
            paymentContent: null,
            debtCounted: true,
            amount: '350',
          },
        ],
      });
      await service.updateVoucher('fc-1', { amount: 350 } as never);

      expect(manager.update).toHaveBeenCalledWith(
        KgaraCase,
        { id: 'case-1' },
        { tienDaThanhToan: 350, tienConPhaiThanhToan: 650 },
      );
    });
  });
});
