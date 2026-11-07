import {
  PurchaseRequestLineResponseDto,
  PurchaseRequestResponseDto,
} from '../dto/procurement-request-response.dto';

/** Hình dạng đọc từ entity. Khai báo tối thiểu để mapper không phụ thuộc TypeORM. */
export interface RequestHeaderLike {
  id: string;
  requestNo: string;
  requestDate: string;
  neededDate: string | null;
  title: string | null;
  requesterEmployeeId: string | null;
  status: string;
  orderingStatus: string;
  estimatedTotal: string;
  remarks: string | null;
  submittedBy: string | null;
  approvedBy: string | null;
  approverId: string | null;
  rejectedBy: string | null;
  rejectReason: string | null;
  cancelReason: string | null;
  closeReason: string | null;
}

/** Email người tạo và người duyệt, tra từ user (không lộ tên nội bộ khác). */
export interface PurchaseRequestPeople {
  createdByEmail: string | null;
  approverEmail: string | null;
}

export interface RequestLineLike {
  id: string;
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
 * `people` (email người tạo/duyệt) do facade tra theo lô; thiếu thì để null.
 */
export function toPurchaseRequestResponse(
  header: RequestHeaderLike,
  lines: RequestLineLike[],
  people?: PurchaseRequestPeople | null,
): PurchaseRequestResponseDto {
  return {
    id: header.id,
    requestNo: header.requestNo,
    requestDate: header.requestDate,
    neededDate: header.neededDate,
    title: header.title,
    requesterEmployeeId: header.requesterEmployeeId,
    status: header.status,
    orderingStatus: header.orderingStatus,
    estimatedTotal: Number(header.estimatedTotal),
    remarks: header.remarks,
    createdByEmail: people?.createdByEmail ?? null,
    submittedBy: header.submittedBy,
    approvedBy: header.approvedBy,
    approverId: header.approverId,
    approverEmail: people?.approverEmail ?? null,
    rejectedBy: header.rejectedBy,
    rejectReason: header.rejectReason,
    cancelReason: header.cancelReason,
    closeReason: header.closeReason,
    lines: [...lines]
      .sort((a, b) => a.lineNo - b.lineNo)
      .map(
        (l): PurchaseRequestLineResponseDto => ({
          id: l.id,
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
