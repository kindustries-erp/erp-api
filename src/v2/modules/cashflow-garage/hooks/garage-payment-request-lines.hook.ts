import { Injectable } from '@nestjs/common';
import {
  CashflowForecastHook,
  CashflowForecastHookContext,
  CashflowPaymentRequest,
  CashflowPaymentRequestLine,
} from '@/v2/core/cashflow-core';
import { fromCents } from '@/v2/core/cashflow-core/services/cashflow-payment-request.rules';
import {
  GARAGE_PO_REF_TYPE,
  isGaragePaymentRequestCreateInput,
} from '../contracts/garage-payment-request.types';
import { validatePaymentRequestLines } from '../services/garage-payment-request-lines.validator';

/**
 * Ghi dòng DNTT và tổng tiền khi tạo, cùng transaction với header. Lỗi kiểm tra ném ra làm hủy cả thao tác.
 */
@Injectable()
export class GaragePaymentRequestLinesHook implements CashflowForecastHook<CashflowPaymentRequest> {
  readonly name = 'garage-payment-request-lines';

  async afterCreate({
    manager,
    header,
    input,
  }: CashflowForecastHookContext<CashflowPaymentRequest>): Promise<void> {
    if (!isGaragePaymentRequestCreateInput(input)) return;

    const validated = await validatePaymentRequestLines(manager, input.lines);
    await manager.save(
      manager.create(
        CashflowPaymentRequestLine,
        validated.lines.map((line) => ({
          requestId: header.id,
          forecastId: null,
          refType: GARAGE_PO_REF_TYPE,
          refId: line.poId,
          amount: fromCents(line.amountCents),
        })),
      ),
    );
    header.amount = fromCents(validated.totalCents);
    header.supplierId = validated.supplierId;
    header.partnerName = header.partnerName ?? validated.supplierName;
    await manager.save(header);
  }
}
