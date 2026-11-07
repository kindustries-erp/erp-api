import { Injectable } from '@nestjs/common';
import {
  CashflowForecastHook,
  CashflowForecastHookContext,
  CashflowForecast,
  CashflowForecastLine,
} from '@/v2/core/cashflow-core';
import { CashflowGarageForecastExt } from '../entities/cashflow-garage-forecast-ext.entity';
import { isGarageForecastCreateInput } from '../contracts/garage-forecast.types';

/**
 * Ghi phần riêng Garage (ext và dòng hàng dự chi mua hàng) ngay khi tạo header,
 * cùng transaction với header.
 */
@Injectable()
export class GarageForecastLinesHook implements CashflowForecastHook<CashflowForecast> {
  readonly name = 'garage-forecast-lines';

  async afterCreate({
    manager,
    header,
    input,
  }: CashflowForecastHookContext<CashflowForecast>): Promise<void> {
    if (!isGarageForecastCreateInput(input)) return;

    await manager.save(
      manager.create(CashflowGarageForecastExt, {
        forecastId: header.id,
        caseId: input.caseId,
        licensePlate: input.licensePlate,
        paymentContent: input.paymentContent,
        isAutoExpected: false,
        isAutoCommission: false,
      }),
    );

    if (input.lines.length === 0) return;
    const lines = input.lines.map((line, index) =>
      manager.create(CashflowForecastLine, {
        forecastId: header.id,
        lineNo: index + 1,
        lineType: line.lineType ?? 'GOODS',
        itemName: line.itemName,
        qtyRequested: String(line.qtyRequested),
        qtyOrdered: '0',
        unitPrice: line.unitPrice.toFixed(2),
        amount: line.amount.toFixed(2),
      }),
    );
    await manager.save(lines);
  }
}
