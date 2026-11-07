/** Token DI cho hook của DNTT Garage (ghi dòng khi tạo). */
export const GARAGE_PAYMENT_REQUEST_HOOKS = Symbol(
  'GARAGE_PAYMENT_REQUEST_HOOKS',
);

/** Loại chứng từ nguồn của dòng DNTT Garage: đơn mua garage. */
export const GARAGE_PO_REF_TYPE = 'GARAGE_PO';

export interface GaragePaymentRequestLineInput {
  /** Đơn mua garage cần chi (trạng thái ISSUED). */
  poId: string;
  /** Số tiền đề nghị chi cho đơn mua này. */
  amount: number;
}

/** Dữ liệu phụ truyền vào hook afterCreate của DNTT. */
export interface GaragePaymentRequestCreateInput {
  lines: GaragePaymentRequestLineInput[];
}

export function isGaragePaymentRequestCreateInput(
  value: unknown,
): value is GaragePaymentRequestCreateInput {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as { lines?: unknown }).lines)
  );
}
