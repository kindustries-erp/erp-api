import {
  ProcurementOrderLineResponseDto,
  ProcurementOrderResponseDto,
} from '../dto/procurement-order-response.dto';
import {
  ApprovalEmailLookup,
  ApprovalHeaderLike,
  toApprovalSummary,
} from '@/v2/core/approval-core/helpers/approval-summary.mapper';

/** Header PO đọc từ entity. Cột duyệt kế thừa từ ApprovalHeaderLike. */
export interface OrderHeaderLike extends ApprovalHeaderLike {
  id: string;
  extraData: Record<string, unknown> | null;
  orderNo: string;
  orderDate: string;
  expectedDate: string | null;
  supplierId: string | null;
  supplierName: string | null;
  sourceType: 'DIRECT' | 'REQUEST';
  requestId: string | null;
  status: string;
  fulfillmentStatus: string;
  totalAmount: string;
  approvedTotal: string | null;
  remarks: string | null;
  createdBy: string | null;
}

export interface OrderLineLike {
  id: string;
  extraData: Record<string, unknown> | null;
  lineNo: number;
  lineType: 'GOODS' | 'SERVICE';
  itemId: string | null;
  itemCode: string | null;
  itemName: string | null;
  description: string | null;
  qtyOrdered: string;
  qtyFulfilled: string;
  unitPrice: string | null;
  amount: string | null;
  requestLineId: string | null;
}

const num = (v: string | null): number | null => (v == null ? null : Number(v));

/**
 * Chuyển entity sang response DTO. Không trả entity ra ngoài.
 * `emailOf` tra email theo lô ở facade; thiếu thì email để null.
 */
export function toProcurementOrderResponse(
  header: OrderHeaderLike,
  lines: OrderLineLike[],
  emailOf: ApprovalEmailLookup = () => null,
): ProcurementOrderResponseDto {
  return {
    id: header.id,
    extraData: header.extraData ?? {},
    orderNo: header.orderNo,
    orderDate: header.orderDate,
    expectedDate: header.expectedDate,
    supplierId: header.supplierId,
    supplierName: header.supplierName,
    sourceType: header.sourceType,
    requestId: header.requestId,
    status: header.status,
    fulfillmentStatus: header.fulfillmentStatus,
    totalAmount: Number(header.totalAmount),
    approvedTotal: num(header.approvedTotal),
    remarks: header.remarks,
    createdBy: header.createdBy ?? null,
    createdByEmail: emailOf(header.createdBy),
    approval: toApprovalSummary(header, emailOf),
    lines: [...lines]
      .sort((a, b) => a.lineNo - b.lineNo)
      .map(
        (l): ProcurementOrderLineResponseDto => ({
          id: l.id,
          extraData: l.extraData ?? {},
          lineNo: l.lineNo,
          lineType: l.lineType,
          itemId: l.itemId,
          itemCode: l.itemCode,
          itemName: l.itemName,
          description: l.description,
          qtyOrdered: Number(l.qtyOrdered),
          qtyFulfilled: Number(l.qtyFulfilled),
          unitPrice: num(l.unitPrice),
          amount: num(l.amount),
          requestLineId: l.requestLineId,
        }),
      ),
  };
}
