export class FinancialReconciliationDto {
  originalAmount: number;
  adjustedDeltaAmount: number;
  netEffectiveAmount: number;
  isFullyCancelled: boolean;
  netoffOffsetAmount: number;
  remainingDebt: number;
}

export class ItemReconciliationDto {
  itemCode: string | null;
  description: string;
  originalQty: number;
  adjustedDeltaQty: number;
  netEffectiveQty: number;
  unit: string | null;
  unitPrice: number;
  netAmount: number;
}

export class InfoDiffItemDto {
  field: string;
  fieldNameVi: string;
  oldValue: string;
  newValue: string;
}

export class InfoDiffReconciliationDto {
  hasInfoAdjustment: boolean;
  diffs: InfoDiffItemDto[];
}

export class RelatedInvoiceSummaryDto {
  id: string;
  invoiceNo: string;
  serialNo: string | null;
  invoiceDate: string | null;
  totalAmount: number;
  taxInvoiceStatus: number | null;
  relationType: 'ADJUSTING_FOR_THIS' | 'ORIGINAL_OF_THIS';
}

export class AdjustmentReconciliationDto {
  invoiceId: string;
  invoiceNo: string;
  serialNo: string | null;
  taxInvoiceStatus: number | null;
  role: 'ORIGINAL' | 'ADJUSTING' | 'REPLACEMENT' | 'STANDARD';
  financial: FinancialReconciliationDto;
  itemReconciliations: ItemReconciliationDto[];
  infoDiff: InfoDiffReconciliationDto;
  relatedInvoices: RelatedInvoiceSummaryDto[];
}

export class ExecuteAdjustmentNetoffDto {
  originalInvoiceId: string;
  adjustingInvoiceId: string;
  offsetAmount?: number;
  notes?: string;
}
