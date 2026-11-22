import { BadRequestException, ParseUUIDPipe } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { RBAC_PERMISSIONS_KEY } from '@/auth/decorators/require-permissions.decorator';
import { ErpAction, ErpResource } from '@/v2/core/rbac-core';
import { CasesGarageController } from './cases-garage.controller';

function makeController() {
  const list = { findPage: jest.fn().mockResolvedValue({ items: [] }) };
  const options = { findOptions: jest.fn().mockResolvedValue({ items: [] }) };
  const detail = {
    findById: jest.fn().mockResolvedValue({}),
    findByCode: jest.fn().mockResolvedValue({}),
  };
  const services = { findPage: jest.fn().mockResolvedValue({ items: [] }) };
  const grossProfit = { getReport: jest.fn().mockResolvedValue({ items: [] }) };
  const progress = { findPage: jest.fn().mockResolvedValue({ items: [] }) };
  const controller = new CasesGarageController(
    list as never,
    options as never,
    detail as never,
    services as never,
    grossProfit as never,
    progress as never,
  );
  return { controller, list, options, detail, services, grossProfit, progress };
}

describe('CasesGarageController', () => {
  it('mọi endpoint đọc yêu cầu GARAGE:READ', () => {
    const proto = CasesGarageController.prototype as unknown as Record<
      string,
      () => void
    >;
    for (const name of [
      'listCases',
      'columnOptions',
      'listServices',
      'grossProfitReport',
      'progressBoard',
      'byCode',
      'byId',
    ]) {
      const meta = Reflect.getMetadata(RBAC_PERMISSIONS_KEY, proto[name]) as
        | Array<{ resource: string; action: string }>
        | undefined;
      expect(meta).toEqual([
        { resource: ErpResource.GARAGE, action: ErpAction.READ },
      ]);
    }
  });

  it('route cố định khai báo trước `:id`', () => {
    const names = Object.getOwnPropertyNames(
      CasesGarageController.prototype,
    ).filter((n) => n !== 'constructor');
    expect(names.indexOf('byId')).toBe(names.length - 1);
  });

  it('`:id` phải là UUID (ParseUUIDPipe), chuỗi lạ bị từ chối trước khi vào service', async () => {
    const args = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      CasesGarageController,
      'byId',
    ) as Record<string, { data?: string; pipes: unknown[] }>;
    const idArg = Object.values(args).find((a) => a.data === 'id');
    expect(idArg?.pipes[0]).toBeInstanceOf(ParseUUIDPipe);
    await expect(
      (idArg?.pipes[0] as ParseUUIDPipe).transform('abc', {
        type: 'param',
        data: 'id',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('thiếu chi nhánh thì từ chối, không chạm service', () => {
    const { controller, list, detail, grossProfit } = makeController();
    expect(() => controller.listCases({}, '')).toThrow(BadRequestException);
    expect(() => controller.byId('x', undefined as never)).toThrow(
      BadRequestException,
    );
    expect(() => controller.grossProfitReport({}, '')).toThrow(
      BadRequestException,
    );
    expect(list.findPage).not.toHaveBeenCalled();
    expect(detail.findById).not.toHaveBeenCalled();
    expect(grossProfit.getReport).not.toHaveBeenCalled();
  });

  it('list đổi tên tham số query sang filter của service', async () => {
    const { controller, services } = makeController();
    await controller.listServices(
      {
        page: 2,
        date_from: '2026-08-01',
        column_filters: '{"a":["b"]}',
        summary_keys: 'tienCoThue',
        serviceType: 'DV',
      },
      'b1',
    );
    expect(services.findPage).toHaveBeenCalledWith(
      expect.objectContaining({
        branchId: 'b1',
        page: 2,
        from: '2026-08-01',
        column_filters: '{"a":["b"]}',
        summaryKeys: 'tienCoThue',
        serviceType: 'DV',
      }),
    );
  });
});
