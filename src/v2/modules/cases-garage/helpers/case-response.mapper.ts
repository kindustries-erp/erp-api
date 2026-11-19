import type {
  CaseResponse,
  CaseServiceResponse,
} from '../dto/case-response.types';
import type { CaseGarage } from '../entities/case-garage.entity';
import type { CaseServiceGarage } from '../entities/case-service-garage.entity';

const num = (v: string | number | null | undefined): number | null =>
  v == null || v === '' ? null : Number(v);
const iso = (v: Date | string | null | undefined): string | null =>
  v == null ? null : v instanceof Date ? v.toISOString() : String(v);

export function toCaseServiceResponse(
  s: CaseServiceGarage,
): CaseServiceResponse {
  return {
    id: s.id,
    caseId: s.caseId,
    lineNumber: s.lineNumber,
    externalId: s.externalId ?? null,
    description: s.description ?? null,
    productCode: s.productCode ?? null,
    productName: s.productName ?? null,
    productTypeCode: s.productTypeCode ?? null,
    unitName: s.unitName ?? null,
    quantity: num(s.quantity),
    unitPrice: num(s.unitPrice),
    amountBeforeTax: num(s.amountBeforeTax),
    taxRate: num(s.taxRate),
    amountWithTax: num(s.amountWithTax),
    laborHours: num(s.laborHours),
    serviceAmount: num(s.serviceAmount),
    partsAmount: num(s.partsAmount),
    partsCost: num(s.partsCost),
    lineDiscountRate: num(s.lineDiscountRate),
    lineDiscountAmount: num(s.lineDiscountAmount),
    surchargeAmount: num(s.surchargeAmount),
    warehouseCode: s.warehouseCode ?? null,
    externalDeletedAt: iso(s.externalDeletedAt),
    extraData: s.extraData ?? {},
  };
}

/** Entity → response DTO. Dòng đã `externalDeletedAt` không trả trong `services`. */
export function toCaseResponse(c: CaseGarage): CaseResponse {
  const base: CaseResponse = {
    id: c.id,
    origin: c.origin,
    caseCode: c.caseCode,
    externalId: c.externalId ?? null,
    branchExternalId: c.branchExternalId,
    accountKey: c.accountKey,
    branchId: c.branchId ?? null,
    licensePlate: c.licensePlate ?? null,
    chassisNumber: c.chassisNumber ?? null,
    vehicleBrandCode: c.vehicleBrandCode ?? null,
    vehicleBrandName: c.vehicleBrandName ?? null,
    vehicleModelCode: c.vehicleModelCode ?? null,
    vehicleModelName: c.vehicleModelName ?? null,
    manufactureYear: c.manufactureYear ?? null,
    customerCode: c.customerCode ?? null,
    customerName: c.customerName ?? null,
    customerSourceName: c.customerSourceName ?? null,
    customerSourceCode: c.customerSourceCode ?? null,
    payerCode: c.payerCode ?? null,
    payerName: c.payerName ?? null,
    status: c.status,
    kgaraStatusCode: c.kgaraStatusCode ?? null,
    statusName: c.statusName ?? null,
    issuedAt: iso(c.issuedAt),
    receivedAt: iso(c.receivedAt),
    completedAt: iso(c.completedAt),
    deliveredAt: iso(c.deliveredAt),
    totalAmountWithTax: num(c.totalAmountWithTax),
    paidAmount: num(c.paidAmount),
    outstandingAmount: num(c.outstandingAmount),
    revenue: num(c.revenue),
    cost: num(c.cost),
    profit: num(c.profit),
    categoryId: c.categoryId ?? null,
    classification: c.classification ?? null,
    classificationManuallyCleared: c.classificationManuallyCleared,
    excludeFromReports: c.excludeFromReports,
    excludeFromDebt: c.excludeFromDebt,
    internalNotes: c.internalNotes ?? null,
    externalDeletedAt: iso(c.externalDeletedAt),
    createdAt: iso(c.createdAt) ?? '',
    updatedAt: iso(c.updatedAt) ?? '',
    extraData: c.extraData ?? {},
  };
  if (c.services) {
    base.services = c.services
      .filter((s) => !s.externalDeletedAt)
      .sort((a, b) => a.lineNumber - b.lineNumber)
      .map(toCaseServiceResponse);
  }
  return base;
}
