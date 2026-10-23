/**
 * Mã message của API v2 invoice. API không trả câu tiếng Việt; web map mã sang bản dịch (translation key).
 */
export const INVOICE_MESSAGES = {
  FETCHED: 'INVOICE_FETCHED',
  CREATED: 'INVOICE_CREATED',
  UPDATED: 'INVOICE_UPDATED',
  DELETED: 'INVOICE_DELETED',
  NOT_FOUND: 'INVOICE_NOT_FOUND',
  DELETE_NOT_DRAFT: 'INVOICE_DELETE_NOT_DRAFT',
} as const;
