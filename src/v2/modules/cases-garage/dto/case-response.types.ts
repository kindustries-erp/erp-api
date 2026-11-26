import type { CaseOrigin, CaseStatus } from '../entities/case-garage.enums';

/** Một dòng hạng mục trả về cho client. Số tiền là number, ngày là ISO string. */
export interface CaseServiceResponse {
  id: string;
  caseId: string;
  lineNumber: number;
  externalId: string | null;
  description: string | null;
  productCode: string | null;
  productName: string | null;
  productTypeCode: string | null;
  unitName: string | null;
  quantity: number | null;
  unitPrice: number | null;
  amountBeforeTax: number | null;
  taxRate: number | null;
  amountWithTax: number | null;
  laborHours: number | null;
  serviceAmount: number | null;
  partsAmount: number | null;
  partsCost: number | null;
  lineDiscountRate: number | null;
  lineDiscountAmount: number | null;
  surchargeAmount: number | null;
  warehouseCode: string | null;
  externalDeletedAt: string | null;
  extraData: Record<string, unknown>;
  /** Khóa field đã sửa đè ở v2 (khác giá trị sync từ KGara). */
  overriddenFields: string[];
}

/** Vụ việc garage v2. Không có `raw_data`; `origin` phân biệt xe nhập tay và xe sync từ V1. */
export interface CaseResponse {
  id: string;
  origin: CaseOrigin;
  caseCode: string;
  externalId: string | null;
  branchExternalId: string | null;
  accountKey: string;
  branchId: string | null;
  licensePlate: string | null;
  chassisNumber: string | null;
  vehicleBrandCode: string | null;
  vehicleBrandName: string | null;
  vehicleModelCode: string | null;
  vehicleModelName: string | null;
  manufactureYear: number | null;
  customerCode: string | null;
  customerName: string | null;
  /** Tên khách in trên phiếu KGara, có thể khác `customerName` (danh mục). */
  voucherCustomerName: string | null;
  customerSourceName: string | null;
  customerSourceCode: string | null;
  payerCode: string | null;
  payerName: string | null;
  status: CaseStatus;
  kgaraStatusCode: number | null;
  statusName: string | null;
  issuedAt: string | null;
  receivedAt: string | null;
  startedAt: string | null;
  expectedCompletionAt: string | null;
  completedAt: string | null;
  deliveredAt: string | null;
  totalAmountWithTax: number | null;
  paidAmount: number | null;
  outstandingAmount: number | null;
  revenue: number | null;
  cost: number | null;
  profit: number | null;
  categoryId: string | null;
  classification: string | null;
  classificationManuallyCleared: boolean;
  excludeFromReports: boolean;
  excludeFromDebt: boolean;
  internalNotes: string | null;
  requestDescription: string | null;
  diagnosis: string | null;
  advisorCode: string | null;
  advisorName: string | null;
  assigneeId: string | null;
  progressStage: string | null;
  progressPercent: number | null;
  progressUpdatedAt: string | null;
  progressUpdatedBy: string | null;
  externalDeletedAt: string | null;
  /** Khóa field đã sửa đè ở v2 (khác giá trị sync từ KGara). */
  overriddenFields: string[];
  createdAt: string;
  updatedAt: string;
  extraData: Record<string, unknown>;
  services?: CaseServiceResponse[];
}

export interface CaseMutationResponse {
  message: string;
  data: CaseResponse;
}
