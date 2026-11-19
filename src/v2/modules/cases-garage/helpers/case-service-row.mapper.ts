import { toMoney } from '@/v2/core/debts-core';
import type { CaseServiceRow } from '../dto/case-service-row.types';
import type { CaseOrigin } from '../entities/case-garage.enums';

type Raw = Record<string, unknown>;
const text = (v: unknown) => (typeof v === 'string' ? v : null);
const num = (v: unknown) => toMoney((v ?? 0) as string | number);

/** Cột SELECT của một dòng hạng mục (bí danh `s` = dòng, `c` = vụ việc, `b` = chi nhánh KGara). */
export const CASE_SERVICE_SELECT: string[] = [
  's.id AS "id"',
  's.case_id AS "caseId"',
  's.external_id AS "externalId"',
  's.description AS "description"',
  's.product_code AS "productCode"',
  's.product_name AS "productName"',
  's.product_type_code AS "productTypeCode"',
  's.unit_name AS "unitName"',
  's.quantity AS "quantity"',
  's.unit_price AS "unitPrice"',
  's.amount_before_tax AS "amountBeforeTax"',
  's.tax_rate AS "taxRate"',
  's.amount_with_tax AS "amountWithTax"',
  's.labor_hours AS "laborHours"',
  's.service_amount AS "serviceAmount"',
  's.parts_amount AS "partsAmount"',
  's.parts_cost AS "partsCost"',
  's.line_discount_rate AS "lineDiscountRate"',
  's.line_discount_amount AS "lineDiscountAmount"',
  's.warehouse_code AS "warehouseCode"',
  's.surcharge_amount AS "surchargeAmount"',
  'c.origin AS "origin"',
  'c.case_code AS "caseCode"',
  'c.license_plate AS "licensePlate"',
  'c.customer_code AS "customerCode"',
  'c.customer_name AS "customerName"',
  'c.kgara_status_code AS "kgaraStatusCode"',
  'c.status_name AS "statusName"',
  'c.classification AS "classification"',
  'c.branch_external_id AS "branchExternalId"',
  'COALESCE(b.name, b.code, c.branch_external_id) AS "branchName"',
  `TO_CHAR(COALESCE(c.received_at, c.issued_at), 'YYYY-MM-DD') AS "caseDate"`,
  `TO_CHAR(c.completed_at, 'YYYY-MM-DD') AS "completedDate"`,
];

export function toCaseServiceRow(r: Raw): CaseServiceRow {
  return {
    id: String(text(r.id) ?? ''),
    caseId: text(r.caseId) ?? '',
    origin: r.origin as CaseOrigin,
    externalId: text(r.externalId),
    caseCode: text(r.caseCode),
    licensePlate: text(r.licensePlate),
    customerCode: text(r.customerCode),
    customerName: text(r.customerName),
    caseDate: text(r.caseDate),
    completedDate: text(r.completedDate),
    branchExternalId: text(r.branchExternalId),
    branchName: text(r.branchName),
    kgaraStatusCode: Number(r.kgaraStatusCode ?? 0) || 0,
    statusName: text(r.statusName),
    classification: text(r.classification),
    productCode: text(r.productCode),
    productName: text(r.productName),
    description: text(r.description),
    productTypeCode: text(r.productTypeCode),
    unitName: text(r.unitName),
    quantity: num(r.quantity),
    unitPrice: num(r.unitPrice),
    amountBeforeTax: num(r.amountBeforeTax),
    taxRate: num(r.taxRate),
    amountWithTax: num(r.amountWithTax),
    laborHours: num(r.laborHours),
    serviceAmount: num(r.serviceAmount),
    partsAmount: num(r.partsAmount),
    partsCost: num(r.partsCost),
    lineDiscountRate: num(r.lineDiscountRate),
    lineDiscountAmount: num(r.lineDiscountAmount),
    warehouseCode: text(r.warehouseCode),
    surchargeAmount: num(r.surchargeAmount),
  };
}
