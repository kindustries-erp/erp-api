import {
  CashflowForecast,
  CashflowForecastLine,
} from '@/v2/core/cashflow-core';
import { CashflowGarageForecastExt } from '../entities/cashflow-garage-forecast-ext.entity';
import { GarageForecastLinesHook } from './garage-forecast-lines.hook';

function buildManager() {
  return {
    create: jest.fn((_entity: unknown, values: object) => ({ ...values })),
    save: jest.fn(async (value: unknown) => value),
  };
}

const header = Object.assign(new CashflowForecast(), { id: 'f-9' });

describe('GarageForecastLinesHook', () => {
  it('ghi ext và dòng hàng đánh số từ 1, số tiền dạng chuỗi 2 chữ số', async () => {
    const manager = buildManager();
    await new GarageForecastLinesHook().afterCreate({
      manager: manager as never,
      header,
      actor: { id: 'u', roles: [] },
      input: {
        caseId: 'case-1',
        licensePlate: '29A-123.45',
        paymentContent: null,
        lines: [
          { itemName: 'Lọc', qtyRequested: 2, unitPrice: 10, amount: 20 },
          {
            itemName: 'Nhớt',
            lineType: 'SERVICE',
            qtyRequested: 1,
            unitPrice: 5.5,
            amount: 5.5,
          },
        ],
      },
    });

    expect(manager.create).toHaveBeenCalledWith(
      CashflowGarageForecastExt,
      expect.objectContaining({ forecastId: 'f-9', caseId: 'case-1' }),
    );
    expect(manager.create).toHaveBeenCalledWith(
      CashflowForecastLine,
      expect.objectContaining({
        forecastId: 'f-9',
        lineNo: 1,
        lineType: 'GOODS',
        qtyRequested: '2',
        qtyOrdered: '0',
        unitPrice: '10.00',
        amount: '20.00',
      }),
    );
    expect(manager.create).toHaveBeenCalledWith(
      CashflowForecastLine,
      expect.objectContaining({
        lineNo: 2,
        lineType: 'SERVICE',
        amount: '5.50',
      }),
    );
    expect(manager.save).toHaveBeenCalledTimes(2);
  });

  it('bỏ qua khi input không phải dữ liệu Garage (họ khác)', async () => {
    const manager = buildManager();
    await new GarageForecastLinesHook().afterCreate({
      manager: manager as never,
      header,
      actor: { id: 'u', roles: [] },
      input: undefined,
    });
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('chỉ ghi ext khi không có dòng hàng', async () => {
    const manager = buildManager();
    await new GarageForecastLinesHook().afterCreate({
      manager: manager as never,
      header,
      actor: { id: 'u', roles: [] },
      input: {
        caseId: null,
        licensePlate: null,
        paymentContent: 'Tiền phí',
        lines: [],
      },
    });
    expect(manager.save).toHaveBeenCalledTimes(1);
  });
});
