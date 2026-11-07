import { CashflowForecast } from '@/v2/core/cashflow-core';
import { CashflowGarageForecastExt } from '../entities/cashflow-garage-forecast-ext.entity';
import { GarageCaseReceivableSyncService } from './garage-case-receivable-sync.service';

type Row = Record<string, unknown>;

function makeService(fx: {
  existing?: Row | null;
  rows?: Row[];
  kCase?: Row | null;
}) {
  const qb = {
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getOne: jest.fn(() => Promise.resolve(fx.existing ?? null)),
    getMany: jest.fn(() => Promise.resolve(fx.rows ?? [])),
  };
  const manager = {
    createQueryBuilder: jest.fn(() => qb),
    findOneBy: jest.fn(() =>
      Promise.resolve(
        fx.existing
          ? {
              forecastId: fx.existing.id,
              licensePlate: null,
              paymentContent: null,
            }
          : null,
      ),
    ),
    create: jest.fn((_e: unknown, values: Row) => ({
      id: 'new-id',
      ...values,
    })),
    save: jest.fn((value: unknown) => Promise.resolve(value)),
  };
  const kCaseRepo = {
    findOne: jest.fn(() => Promise.resolve(fx.kCase ?? null)),
  };
  const dataSource = {
    manager,
    getRepository: jest.fn(() => kCaseRepo),
  };
  const service = new GarageCaseReceivableSyncService(dataSource as never);
  return { service, manager, qb };
}

const existingAuto = (over: Row = {}): Row => ({
  id: 'auto-1',
  code: 'DT-GARA-261101-001',
  direction: 'IN',
  status: 'OPEN',
  amount: '500',
  plannedDate: '2026-11-08',
  partnerName: 'KH',
  note: null,
  ...over,
});

describe('GarageCaseReceivableSyncService', () => {
  describe('syncCaseForecast', () => {
    it('hoàn tất, chưa có dự thu: tạo dự thu IN OPEN, ngày dự kiến = hoàn thành + 7 ngày', async () => {
      const { service, manager } = makeService({});
      await service.syncCaseForecast({
        caseId: 'case-1',
        previousStatus: 2,
        newStatus: 3,
        ngayHoanThanhCongViec: '2026-11-01',
        tienConPhaiThanhToan: 1000,
        khachHangName: 'KH A',
        licensePlate: '51A-111',
      });

      const headerCall = manager.create.mock.calls.find(
        (c) => c[0] === CashflowForecast,
      );
      expect(headerCall?.[1]).toMatchObject({
        direction: 'IN',
        kind: 'CASE_RECEIVABLE',
        source: 'AUTO',
        status: 'OPEN',
        amount: '1000',
        partnerName: 'KH A',
      });
      expect(String(headerCall?.[1].plannedDate)).toMatch(/^2026-11-0[78]$/);
      const extCall = manager.create.mock.calls.find(
        (c) => c[0] === CashflowGarageForecastExt,
      );
      expect(extCall?.[1]).toMatchObject({
        caseId: 'case-1',
        isAutoExpected: true,
        paymentContent: 'Dự thu hoàn tất phiếu dịch vụ',
        licensePlate: '51A-111',
      });
    });

    it('hoàn tất, dự thu đang mở: cập nhật số tiền theo còn phải thu, không tạo mới', async () => {
      const existing = existingAuto();
      const { service, manager } = makeService({ existing });
      await service.syncCaseForecast({
        caseId: 'case-1',
        newStatus: 3,
        ngayHoanThanhCongViec: '2026-11-01',
        tienConPhaiThanhToan: 300,
      });

      expect(existing.amount).toBe('300');
      expect(existing.status).toBe('OPEN');
      expect(manager.create).not.toHaveBeenCalledWith(
        CashflowForecast,
        expect.anything(),
      );
    });

    it('còn phải thu bằng 0: hủy dự thu đang mở', async () => {
      const existing = existingAuto();
      const { service } = makeService({ existing });
      await service.syncCaseForecast({
        caseId: 'case-1',
        newStatus: 3,
        tienConPhaiThanhToan: 0,
      });

      expect(existing.status).toBe('CANCELLED');
      expect(existing.amount).toBe('0');
    });

    it('còn phải thu bằng 0 và không có dự thu mở: không làm gì', async () => {
      const { service, manager } = makeService({ existing: null });
      await service.syncCaseForecast({
        caseId: 'case-1',
        newStatus: 3,
        tienConPhaiThanhToan: 0,
      });
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('dự thu đã hủy được mở lại khi hoàn tất với số tiền mới', async () => {
      const existing = existingAuto({ status: 'CANCELLED' });
      const { service } = makeService({ existing });
      await service.syncCaseForecast({
        caseId: 'case-1',
        newStatus: 3,
        ngayHoanThanhCongViec: '2026-11-01',
        tienConPhaiThanhToan: 200,
      });
      expect(existing.status).toBe('OPEN');
      expect(existing.amount).toBe('200');
    });

    it('rời khỏi Hoàn tất: hủy các dự thu đang mở của phiếu', async () => {
      const rows = [existingAuto({ id: 'a1' }), existingAuto({ id: 'a2' })];
      const { service, manager } = makeService({ rows });
      await service.syncCaseForecast({
        caseId: 'case-1',
        previousStatus: 3,
        newStatus: 2,
      });

      expect(rows.every((r) => r.status === 'CANCELLED')).toBe(true);
      expect(manager.save).toHaveBeenCalledWith(rows);
    });

    it('trạng thái khác (không từ Hoàn tất, không sang Hoàn tất): không làm gì', async () => {
      const { service, manager } = makeService({});
      await service.syncCaseForecast({
        caseId: 'case-1',
        previousStatus: 1,
        newStatus: 2,
      });
      expect(manager.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('syncCaseReceipts', () => {
    it('phiếu dịch vụ không còn hoàn tất: bỏ qua', async () => {
      const { service, qb } = makeService({
        kCase: { id: 'case-1', tinhTrangDichVu: 2 },
      });
      await service.syncCaseReceipts(['case-1']);
      expect(qb.getOne).not.toHaveBeenCalled();
    });

    it('phiếu dịch vụ hoàn tất: đặt lại dự thu theo còn phải thu', async () => {
      const existing = existingAuto();
      const { service } = makeService({
        existing,
        kCase: {
          id: 'case-1',
          tinhTrangDichVu: 3,
          ngayHoanThanhCongViec: '2026-11-01',
          tienConPhaiThanhToan: 150,
        },
      });
      await service.syncCaseReceipts(['case-1', null, undefined]);
      expect(existing.amount).toBe('150');
    });
  });
});
