import { BadRequestException } from '@nestjs/common';
import { RBAC_PERMISSIONS_KEY } from '@/auth/decorators/require-permissions.decorator';
import { ErpAction, ErpResource } from '@/v2/core/rbac-core';
import { DebtsGarageController } from './debts-garage.controller';

function makeController() {
  const customers = {
    findPage: jest.fn().mockResolvedValue({ items: [] }),
    findColumnOptions: jest.fn().mockResolvedValue({ items: [] }),
  };
  const suppliers = {
    findPage: jest.fn().mockResolvedValue({ items: [] }),
    findColumnOptions: jest.fn().mockResolvedValue({ items: [] }),
  };
  const analytics = { getAnalytics: jest.fn().mockResolvedValue({}) };
  const horizons = { findCases: jest.fn().mockResolvedValue({ items: [] }) };
  const controller = new DebtsGarageController(
    customers as never,
    suppliers as never,
    analytics as never,
    horizons as never,
  );
  return { controller, customers, suppliers, analytics, horizons };
}

describe('DebtsGarageController', () => {
  it('mọi endpoint đọc yêu cầu GARAGE_DEBTS:READ', () => {
    const proto = DebtsGarageController.prototype as unknown as Record<
      string,
      () => void
    >;
    const names = [
      'customersList',
      'customersColumnOptions',
      'suppliersList',
      'suppliersColumnOptions',
      'analyticsOverview',
      'horizonCases',
    ];
    for (const name of names) {
      const meta = Reflect.getMetadata(RBAC_PERMISSIONS_KEY, proto[name]) as
        | Array<{ resource: string; action: string }>
        | undefined;
      expect(meta).toEqual([
        { resource: ErpResource.GARAGE_DEBTS, action: ErpAction.READ },
      ]);
    }
  });

  it('thiếu chi nhánh thì từ chối, không chạm service', () => {
    const { controller, customers, analytics } = makeController();

    expect(() => controller.customersList({}, '')).toThrow(BadRequestException);
    expect(() => controller.analyticsOverview(undefined as never)).toThrow(
      BadRequestException,
    );
    expect(customers.findPage).not.toHaveBeenCalled();
    expect(analytics.getAnalytics).not.toHaveBeenCalled();
  });

  it('list gắn chi nhánh và đổi date_from/date_to thành from/to', async () => {
    const { controller, suppliers } = makeController();

    await controller.suppliersList(
      { page: 2, date_from: '2026-08-01', date_to: '2026-08-31' },
      'b1',
    );

    expect(suppliers.findPage).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        branchId: 'b1',
        from: '2026-08-01',
        to: '2026-08-31',
      }),
    );
  });

  it('column-options parse bộ lọc dạng rút gọn và giữ chi nhánh', async () => {
    const { controller, customers } = makeController();

    await controller.customersColumnOptions(
      'customerName',
      'b1',
      'an',
      '1',
      '20',
      JSON.stringify({ licensePlate: ['51A'] }),
    );

    expect(customers.findColumnOptions).toHaveBeenCalledWith(
      'customerName',
      expect.objectContaining({
        search: 'an',
        filters: { columnFilters: { licensePlate: ['51A'] } },
      }),
      { branchId: 'b1' },
    );
  });

  it('mốc thời gian lạ bị từ chối', () => {
    const { controller, horizons } = makeController();

    expect(() => controller.horizonCases('x; DROP', {}, 'b1')).toThrow(
      BadRequestException,
    );
    expect(horizons.findCases).not.toHaveBeenCalled();
  });

  it('mốc hợp lệ chuyển tham số cho service', async () => {
    const { controller, horizons } = makeController();

    await controller.horizonCases(
      'nextMonthDue',
      { page: 3, sortBy: 'balanceAmount', sortOrder: 'ASC' },
      'b1',
    );

    expect(horizons.findCases).toHaveBeenCalledWith(
      expect.objectContaining({
        horizon: 'nextMonthDue',
        branchId: 'b1',
        page: 3,
        sortBy: 'balanceAmount',
        sortOrder: 'ASC',
      }),
    );
  });
});
