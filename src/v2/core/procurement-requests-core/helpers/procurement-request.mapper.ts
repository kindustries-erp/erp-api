import {
  PurchaseRequestLineResponseDto,
  PurchaseRequestResponseDto,
} from '../dto/procurement-request-response.dto';
import {
  ApprovalEmailLookup,
  ApprovalHeaderLike,
  toApprovalSummary,
} from '@/v2/core/approval-core/helpers/approval-summary.mapper';

/** Hình dạng đọc từ entity. Khai báo tối thiểu để mapper không phụ thuộc TypeORM. */
export interface RequestHeaderLike extends ApprovalHeaderLike {
  id: string;
  extraData: Record<string, unknown> | null;
  requestNo: string;
  requestDate: string;
  neededDate: string | null;
  title: string | null;
  requesterEmployeeId: string | null;
  status: string;
  orderingStatus: string;
  estimatedTotal: string;
  remarks: string | null;
  createdBy: string | null;
}

export interface RequestLineLike {
  id: string;
  extraData: Record<string, unknown> | null;
  lineNo: number;
  lineType: 'GOODS' | 'SERVICE';
  itemId: string | null;
  itemCode: string | null;
  itemName: string | null;
  description: string | null;
  qtyRequested: string;
  qtyOrdered: string;
  estUnitPrice: string | null;
  estAmount: string | null;
  notes: string | null;
}

const num = (v: string | null): number | null => (v == null ? null : Number(v));

/**
 * Chuyển entity sang response DTO. Không bao giờ trả entity ra ngoài.
 * `emailOf` tra email theo lô ở facade; thiếu thì email để null.
 */
export function toPurchaseRequestResponse(
  header: RequestHeaderLike,
  lines: RequestLineLike[],
  emailOf: ApprovalEmailLookup = () => null,
): PurchaseRequestResponseDto {
  return {
    id: header.id,
    extraData: header.extraData ?? {},
    requestNo: header.requestNo,
    requestDate: header.requestDate,
    neededDate: header.neededDate,
    title: header.title,
    requesterEmployeeId: header.requesterEmployeeId,
    status: header.status,
    orderingStatus: header.orderingStatus,
    estimatedTotal: Number(header.estimatedTotal),
    remarks: header.remarks,
    createdByEmail: emailOf(header.createdBy),
    approval: toApprovalSummary(header, emailOf),
    lines: [...lines]
      .sort((a, b) => a.lineNo - b.lineNo)
      .map(
        (l): PurchaseRequestLineResponseDto => ({
          id: l.id,
          extraData: l.extraData ?? {},
          lineNo: l.lineNo,
          lineType: l.lineType,
          itemId: l.itemId,
          itemCode: l.itemCode,
          itemName: l.itemName,
          description: l.description,
          qtyRequested: Number(l.qtyRequested),
          qtyOrdered: Number(l.qtyOrdered),
          estUnitPrice: num(l.estUnitPrice),
          estAmount: num(l.estAmount),
          notes: l.notes,
        }),
      ),
  };
}
