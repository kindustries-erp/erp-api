export const GARAGE_FORECAST_PURCHASE_KIND = 'PURCHASE';

export interface GarageForecastLineInput {
  itemName: string;
  lineType?: 'GOODS' | 'SERVICE';
  qtyRequested: number;
  unitPrice: number;
}

/** Dữ liệu phụ Garage truyền qua `createDraft(..., input)` để hook ghi ext và dòng hàng cùng transaction. */
export interface GarageForecastCreateInput {
  caseId: string | null;
  licensePlate: string | null;
  paymentContent: string | null;
  lines: Array<GarageForecastLineInput & { amount: number }>;
}

export function isGarageForecastCreateInput(
  value: unknown,
): value is GarageForecastCreateInput {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as GarageForecastCreateInput).lines)
  );
}
