import { BadRequestException } from '@nestjs/common';
import { CasesDashboardGarageService } from './cases-dashboard-garage.service';

const NOW = new Date(2026, 10, 20, 10, 0, 0); // 20/11/2026 giờ máy chủ

describe('CasesDashboardGarageService (facade dashboard garage V2)', () => {
  let service: CasesDashboardGarageService;
  let kpi: { getPeriodKpis: jest.Mock };
  let funnel: { getFunnel: jest.Mock };
  let cases: { listCases: jest.Mock };

  beforeEach(() => {
    kpi = { getPeriodKpis: jest.fn().mockResolvedValue({ ok: 'kpi' }) };
    funnel = { getFunnel: jest.fn().mockResolvedValue({ ok: 'funnel' }) };
    cases = { listCases: jest.fn().mockResolvedValue({ ok: 'cases' }) };
    service = new CasesDashboardGarageService(
      kpi as any,
      funnel as any,
      cases as any,
    );
  });

  describe('getPeriodKpis', () => {
    it('không truyền ngày thì dùng ngày gốc là `now`', async () => {
      await service.getPeriodKpis(undefined, NOW);

      const ranges = kpi.getPeriodKpis.mock.calls[0][0];
      expect(ranges.day.start).toEqual(new Date(2026, 10, 20, 0, 0, 0, 0));
      expect(ranges.day.end).toEqual(new Date(2026, 10, 20, 23, 59, 59, 999));
    });

    it('ngày gốc tính tháng (1..30/11) và tuần bắt đầu thứ Hai (16/11..22/11)', async () => {
      await service.getPeriodKpis('2026-11-18', NOW);

      const ranges = kpi.getPeriodKpis.mock.calls[0][0];
      expect(ranges.month.start).toEqual(new Date(2026, 10, 1));
      expect(ranges.month.end).toEqual(new Date(2026, 10, 30, 23, 59, 59, 999));
      expect(ranges.week.start).toEqual(new Date(2026, 10, 16));
      expect(ranges.week.end).toEqual(new Date(2026, 10, 22, 23, 59, 59, 999));
    });

    it('ngày sai định dạng thì ném BadRequest', () => {
      expect(() => service.getPeriodKpis('20/11/2026', NOW)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('getFunnel', () => {
    it('không truyền khoảng ngày thì mặc định tháng của now', async () => {
      await service.getFunnel(undefined, undefined, NOW);

      const range = funnel.getFunnel.mock.calls[0][0];
      expect(range.start).toEqual(new Date(2026, 10, 1));
      expect(range.end).toEqual(new Date(2026, 10, 30, 23, 59, 59, 999));
    });

    it('date_to bao trọn cả ngày cuối', async () => {
      await service.getFunnel('2026-11-01', '2026-11-05', NOW);

      const range = funnel.getFunnel.mock.calls[0][0];
      expect(range.start).toEqual(new Date(2026, 10, 1));
      expect(range.end).toEqual(new Date(2026, 10, 5, 23, 59, 59, 999));
    });

    it('chỉ có date_from thì date_to lấy cùng ngày đó', async () => {
      await service.getFunnel('2026-11-03', undefined, NOW);

      const range = funnel.getFunnel.mock.calls[0][0];
      expect(range.start).toEqual(new Date(2026, 10, 3));
      expect(range.end).toEqual(new Date(2026, 10, 3, 23, 59, 59, 999));
    });

    it('date_from sau date_to thì ném BadRequest', () => {
      expect(() => service.getFunnel('2026-11-10', '2026-11-01', NOW)).toThrow(
        BadRequestException,
      );
      expect(funnel.getFunnel).not.toHaveBeenCalled();
    });
  });

  describe('listCases', () => {
    it('mặc định trang 1, 20 dòng và chuyển lọc giai đoạn/phân loại xuống query', async () => {
      await service.listCases(
        {
          dateFrom: '2026-11-01',
          dateTo: '2026-11-30',
          stage: 'quotation',
          classification: 'KHAC',
        },
        NOW,
      );

      expect(cases.listCases).toHaveBeenCalledWith({
        range: {
          start: new Date(2026, 10, 1),
          end: new Date(2026, 10, 30, 23, 59, 59, 999),
        },
        stage: 'quotation',
        classification: 'KHAC',
        page: 1,
        pageSize: 20,
      });
    });

    it('trả về đúng kết quả từ query service', async () => {
      await expect(service.listCases({}, NOW)).resolves.toEqual({
        ok: 'cases',
      });
    });
  });
});
