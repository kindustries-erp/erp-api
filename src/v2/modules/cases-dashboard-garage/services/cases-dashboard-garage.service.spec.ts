import { BadRequestException } from '@nestjs/common';
import { CasesDashboardGarageService } from './cases-dashboard-garage.service';

/** Instant của giờ tường Việt Nam (UTC+7), không phụ thuộc múi giờ tiến trình. */
const vn = (
  y: number,
  m: number,
  d: number,
  h = 0,
  mi = 0,
  s = 0,
  ms = 0,
): Date => new Date(Date.UTC(y, m, d, h - 7, mi, s, ms));
const NOW = vn(2026, 10, 20, 10, 0, 0); // 20/11/2026 10:00 giờ VN

describe('CasesDashboardGarageService (facade dashboard garage V2)', () => {
  let service: CasesDashboardGarageService;
  let kpi: { getPeriodKpis: jest.Mock };
  let funnel: { getFunnel: jest.Mock };
  let vehicles: { listVehicles: jest.Mock };

  beforeEach(() => {
    kpi = { getPeriodKpis: jest.fn().mockResolvedValue({ ok: 'kpi' }) };
    funnel = { getFunnel: jest.fn().mockResolvedValue({ ok: 'funnel' }) };
    vehicles = {
      listVehicles: jest.fn().mockResolvedValue({ ok: 'vehicles' }),
    };
    service = new CasesDashboardGarageService(
      kpi as any,
      funnel as any,
      vehicles as any,
    );
  });

  describe('listVehicles', () => {
    it('quy đổi tham số HTTP (ngày, giai đoạn) rồi gọi query theo xe, mặc định trang 1 và 20 dòng', async () => {
      await expect(
        service.listVehicles(
          { dateFrom: '2026-11-01', dateTo: '2026-11-30', stage: 'quotation' },
          NOW,
        ),
      ).resolves.toEqual({ ok: 'vehicles' });

      expect(vehicles.listVehicles).toHaveBeenCalledWith({
        range: {
          start: vn(2026, 10, 1),
          end: vn(2026, 10, 30, 23, 59, 59, 999),
        },
        stage: 'quotation',
        classification: undefined,
        page: 1,
        pageSize: 20,
      });
    });
  });

  describe('getPeriodKpis', () => {
    it('không truyền ngày thì dùng ngày gốc là `now`', async () => {
      await service.getPeriodKpis(undefined, NOW);

      const ranges = kpi.getPeriodKpis.mock.calls[0][0];
      expect(ranges.day.start).toEqual(vn(2026, 10, 20, 0, 0, 0, 0));
      expect(ranges.day.end).toEqual(vn(2026, 10, 20, 23, 59, 59, 999));
    });

    it('ngày gốc tính tháng (1..30/11) và tuần bắt đầu thứ Hai (16/11..22/11)', async () => {
      await service.getPeriodKpis('2026-11-18', NOW);

      const ranges = kpi.getPeriodKpis.mock.calls[0][0];
      expect(ranges.month.start).toEqual(vn(2026, 10, 1));
      expect(ranges.month.end).toEqual(vn(2026, 10, 30, 23, 59, 59, 999));
      expect(ranges.week.start).toEqual(vn(2026, 10, 16));
      expect(ranges.week.end).toEqual(vn(2026, 10, 22, 23, 59, 59, 999));
    });

    it('ngày sai định dạng thì ném BadRequest', () => {
      expect(() => service.getPeriodKpis('20/11/2026', NOW)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('getOverview', () => {
    it('trả {period, funnel} từ hai query service, mỗi bên gọi đúng một lần', async () => {
      await expect(
        service.getOverview('2026-11-18', '2026-11-01', '2026-11-05', NOW),
      ).resolves.toEqual({ period: { ok: 'kpi' }, funnel: { ok: 'funnel' } });

      expect(kpi.getPeriodKpis).toHaveBeenCalledTimes(1);
      expect(funnel.getFunnel).toHaveBeenCalledTimes(1);
      const ranges = kpi.getPeriodKpis.mock.calls[0][0];
      expect(ranges.week.start).toEqual(vn(2026, 10, 16));
      const range = funnel.getFunnel.mock.calls[0][0];
      expect(range.end).toEqual(vn(2026, 10, 5, 23, 59, 59, 999));
    });

    it('không truyền tham số nào thì mặc định hôm nay và tháng hiện tại', async () => {
      await service.getOverview(undefined, undefined, undefined, NOW);

      expect(kpi.getPeriodKpis.mock.calls[0][0].day.start).toEqual(
        vn(2026, 10, 20),
      );
      expect(funnel.getFunnel.mock.calls[0][0].start).toEqual(vn(2026, 10, 1));
    });

    it('chạy hai truy vấn song song (cùng bắt đầu trước khi bên nào xong)', async () => {
      const order: string[] = [];
      let releaseKpi: (v: unknown) => void = () => undefined;
      kpi.getPeriodKpis.mockImplementation(() => {
        order.push('kpi:start');
        return new Promise((resolve) => {
          releaseKpi = resolve;
        });
      });
      funnel.getFunnel.mockImplementation(() => {
        order.push('funnel:start');
        return Promise.resolve({ ok: 'funnel' });
      });

      const pending = service.getOverview(undefined, undefined, undefined, NOW);
      await Promise.resolve();
      expect(order).toEqual(['kpi:start', 'funnel:start']);

      releaseKpi({ ok: 'kpi' });
      await expect(pending).resolves.toEqual({
        period: { ok: 'kpi' },
        funnel: { ok: 'funnel' },
      });
    });

    it('tham số sai thì ném BadRequest và không chạy truy vấn nào', async () => {
      await expect(
        service.getOverview('20/11/2026', undefined, undefined, NOW),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.getOverview(undefined, '2026-11-10', '2026-11-01', NOW),
      ).rejects.toThrow(BadRequestException);

      expect(kpi.getPeriodKpis).not.toHaveBeenCalled();
      expect(funnel.getFunnel).not.toHaveBeenCalled();
    });
  });

  describe('getFunnel', () => {
    it('không truyền khoảng ngày thì mặc định tháng của now', async () => {
      await service.getFunnel(undefined, undefined, NOW);

      const range = funnel.getFunnel.mock.calls[0][0];
      expect(range.start).toEqual(vn(2026, 10, 1));
      expect(range.end).toEqual(vn(2026, 10, 30, 23, 59, 59, 999));
    });

    it('date_to bao trọn cả ngày cuối', async () => {
      await service.getFunnel('2026-11-01', '2026-11-05', NOW);

      const range = funnel.getFunnel.mock.calls[0][0];
      expect(range.start).toEqual(vn(2026, 10, 1));
      expect(range.end).toEqual(vn(2026, 10, 5, 23, 59, 59, 999));
    });

    it('chỉ có date_from thì date_to lấy cùng ngày đó', async () => {
      await service.getFunnel('2026-11-03', undefined, NOW);

      const range = funnel.getFunnel.mock.calls[0][0];
      expect(range.start).toEqual(vn(2026, 10, 3));
      expect(range.end).toEqual(vn(2026, 10, 3, 23, 59, 59, 999));
    });

    it('date_from sau date_to thì ném BadRequest', () => {
      expect(() => service.getFunnel('2026-11-10', '2026-11-01', NOW)).toThrow(
        BadRequestException,
      );
      expect(funnel.getFunnel).not.toHaveBeenCalled();
    });
  });
});
