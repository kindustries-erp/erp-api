import { ReportsCoreController } from './reports-core.controller';

describe('ReportsCoreController', () => {
  const service = {
    getSalesDashboard: jest.fn(),
    getPurchasingDashboard: jest.fn(),
    getVinfastPartsTracking: jest.fn(),
    getVinfastPartsTrackingDetails: jest.fn(),
    exportVinfastPartsTrackingExcel: jest.fn(),
  } as any;

  let controller: ReportsCoreController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ReportsCoreController(service);
  });

  it('delegates getSalesDashboard to service', async () => {
    service.getSalesDashboard.mockResolvedValue({ ok: true });

    await expect(
      controller.getSalesDashboard('2026-01-01', '2026-01-31'),
    ).resolves.toEqual({ ok: true });

    expect(service.getSalesDashboard).toHaveBeenCalledWith({
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
    });
  });

  it('delegates getPurchasingDashboard to service', async () => {
    service.getPurchasingDashboard.mockResolvedValue({ ok: true });

    await expect(
      controller.getPurchasingDashboard('2026-02-01', '2026-02-29'),
    ).resolves.toEqual({ ok: true });

    expect(service.getPurchasingDashboard).toHaveBeenCalledWith({
      dateFrom: '2026-02-01',
      dateTo: '2026-02-29',
    });
  });
});
