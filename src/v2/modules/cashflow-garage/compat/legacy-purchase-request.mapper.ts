import type {
  RequestHeaderLike,
  RequestLineLike,
} from '@/v2/core/procurement-requests-core/helpers/procurement-request.mapper';
import { orderingStatusOf } from '@/v2/core/procurement-requests-core/services/procurement-request-engine.service';
import { legacyPrStatus } from '../helpers/legacy-pr-status';

/** Dòng dự chi PURCHASE đọc bằng SQL (alias camelCase). */
export interface ForecastPrRow {
  id: string;
  code: string;
  status: string;
  branchId: string | null;
  amount: string;
  plannedDate: string | null;
  createdAt: Date | string;
  createdBy: string | null;
  title: string | null;
  requesterEmployeeId: string | null;
  note: string | null;
  submittedBy: string | null;
  approvedBy: string | null;
  approverId: string | null;
  rejectedBy: string | null;
  rejectReason: string | null;
  closedAt: Date | string | null;
  closeReason: string | null;
}

export interface ForecastPrLineRow {
  id: string;
  lineNo: number;
  lineType: 'GOODS' | 'SERVICE';
  itemId: string | null;
  itemCode: string | null;
  itemName: string;
  description: string | null;
  notes: string | null;
  qtyRequested: string;
  qtyOrdered: string;
  unitPrice: string;
  amount: string;
}

/** Header PR cũ suy từ dự chi. createdBy giữ lại để facade tra email người tạo. */
export type LegacyPrHeader = RequestHeaderLike & { createdBy: string | null };

const dateOnly = (v: Date | string | null): string | null => {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

/** Dòng dự chi -> dòng PR cũ. Mã hàng, mô tả, ghi chú lấy từ cột bổ sung (M4). */
export function toLegacyPrLine(row: ForecastPrLineRow): RequestLineLike {
  return {
    id: row.id,
    lineNo: row.lineNo,
    lineType: row.lineType,
    itemId: row.itemId,
    itemCode: row.itemCode,
    itemName: row.itemName,
    description: row.description,
    qtyRequested: row.qtyRequested,
    qtyOrdered: row.qtyOrdered,
    estUnitPrice: row.unitPrice,
    estAmount: row.amount,
    notes: row.notes,
  };
}

/**
 * Dự chi PURCHASE -> header PR cũ. Trạng thái và tiến độ đặt hàng suy ra, không lưu.
 * Chỗ khác bảng cũ: requestDate lấy ngày tạo (bảng cũ có ngày riêng), neededDate lấy planned_date,
 * cancelReason không có trên dự chi nên để null.
 */
export function toLegacyPrHeader(
  row: ForecastPrRow,
  lines: RequestLineLike[],
): LegacyPrHeader {
  return {
    id: row.id,
    requestNo: row.code,
    requestDate: dateOnly(row.createdAt) ?? '',
    neededDate: row.plannedDate,
    title: row.title,
    requesterEmployeeId: row.requesterEmployeeId,
    status: legacyPrStatus(row.status, row.closedAt),
    orderingStatus: orderingStatusOf(
      lines.map((l) => ({
        qtyRequested: Number(l.qtyRequested),
        qtyOrdered: Number(l.qtyOrdered),
      })),
    ),
    estimatedTotal: row.amount,
    remarks: row.note,
    submittedBy: row.submittedBy,
    approvedBy: row.approvedBy,
    approverId: row.approverId,
    rejectedBy: row.rejectedBy,
    rejectReason: row.rejectReason,
    cancelReason: null,
    closeReason: row.closeReason,
    createdBy: row.createdBy,
  };
}
