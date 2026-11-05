import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  PURCHASE_REQUEST_ORDERING_STATUS,
  PURCHASE_REQUEST_STATUS,
  PurchaseRequestOrderingStatus,
  PurchaseRequestStatus,
} from '../contracts/procurement-requests.contract';

/** Dung sai so sánh số lượng (cột numeric 3 chữ số thập phân). */
const EPS = 1e-9;

export interface RequestLineQty {
  qtyRequested: number;
  qtyOrdered: number;
}

/**
 * Suy tiến độ đặt hàng từ các dòng. Hàm thuần, không đụng DB.
 * NONE: chưa đặt dòng nào. FULL: mọi dòng đã đặt đủ. Còn lại: PARTIAL.
 */
export function orderingStatusOf(
  lines: RequestLineQty[],
): PurchaseRequestOrderingStatus {
  const totalOrdered = lines.reduce((sum, l) => sum + l.qtyOrdered, 0);
  if (totalOrdered <= EPS) return PURCHASE_REQUEST_ORDERING_STATUS.NONE;
  const allFull = lines.every((l) => l.qtyOrdered >= l.qtyRequested - EPS);
  return allFull
    ? PURCHASE_REQUEST_ORDERING_STATUS.FULL
    : PURCHASE_REQUEST_ORDERING_STATUS.PARTIAL;
}

/** Chỉ sửa dòng khi còn DRAFT. */
export function assertLinesEditable(status: PurchaseRequestStatus): void {
  if (status !== PURCHASE_REQUEST_STATUS.DRAFT) {
    throw new ConflictException(
      `Chỉ sửa được khi ở DRAFT, hiện tại là ${status}`,
    );
  }
}

/** Hủy PR chỉ khi chưa có PO nào giữ số lượng. */
export function assertCanCancel(lines: RequestLineQty[]): void {
  const held = lines.some((l) => l.qtyOrdered > EPS);
  if (held) {
    throw new ConflictException(
      'Không hủy được đề nghị đã có đơn mua giữ số lượng',
    );
  }
}

/** Xóa đề nghị chỉ khi chưa có đơn mua nào giữ số lượng. */
export function assertNoHeldQty(lines: RequestLineQty[]): void {
  const held = lines.some((l) => l.qtyOrdered > EPS);
  if (held) {
    throw new ConflictException(
      'Không xóa được đề nghị đã có đơn mua giữ số lượng',
    );
  }
}

/** Chỉ tạo PO từ PR đã duyệt và còn số lượng chưa đặt. */
export function assertOrderable(
  status: PurchaseRequestStatus,
  line: RequestLineQty,
  requestedNow: number,
): void {
  if (status !== PURCHASE_REQUEST_STATUS.APPROVED) {
    throw new ConflictException('Chỉ đặt hàng từ đề nghị đã duyệt');
  }
  const remaining = line.qtyRequested - line.qtyOrdered;
  if (requestedNow > remaining + EPS) {
    throw new ConflictException(
      `Số lượng đặt ${requestedNow} vượt phần còn lại ${remaining}`,
    );
  }
}

export interface PoDraftSourceLine extends RequestLineQty {
  id: string;
  lineNo: number;
  lineType: 'GOODS' | 'SERVICE';
  itemId: string | null;
  itemCode: string | null;
  itemName: string | null;
  description: string | null;
  estUnitPrice: number | null;
}

export interface PoDraftLine {
  requestLineId: string;
  lineNo: number;
  lineType: 'GOODS' | 'SERVICE';
  itemId: string | null;
  itemCode: string | null;
  itemName: string | null;
  description: string | null;
  qtyRemaining: number;
  estUnitPrice: number | null;
}

/**
 * Các dòng còn số lượng chưa đặt, dùng để điền sẵn PO. Chỉ đọc.
 * Chỉ cho phép khi PR đã APPROVED.
 */
export function remainingPoDraftLinesOf(
  status: PurchaseRequestStatus,
  lines: PoDraftSourceLine[],
): PoDraftLine[] {
  if (status !== PURCHASE_REQUEST_STATUS.APPROVED) {
    throw new ConflictException('Chỉ đặt hàng từ đề nghị đã duyệt');
  }
  return [...lines]
    .sort((a, b) => a.lineNo - b.lineNo)
    .map((l) => ({
      requestLineId: l.id,
      lineNo: l.lineNo,
      lineType: l.lineType,
      itemId: l.itemId,
      itemCode: l.itemCode,
      itemName: l.itemName,
      description: l.description,
      qtyRemaining: l.qtyRequested - l.qtyOrdered,
      estUnitPrice: l.estUnitPrice,
    }))
    .filter((l) => l.qtyRemaining > EPS);
}

export interface DraftLineInput {
  lineType: string;
  qtyRequested: number;
  estUnitPrice?: number | null;
}

/** Dòng đề nghị: loại hàng hợp lệ và số lượng dương. */
export function assertValidDraftLines(lines: DraftLineInput[]): void {
  if (lines.length === 0) {
    throw new BadRequestException('Đề nghị mua phải có ít nhất một dòng');
  }
  lines.forEach((l, i) => {
    if (l.lineType !== 'GOODS' && l.lineType !== 'SERVICE') {
      throw new BadRequestException(
        `Dòng ${i + 1}: loại dòng phải là GOODS hoặc SERVICE`,
      );
    }
    if (!(l.qtyRequested > 0)) {
      throw new BadRequestException(`Dòng ${i + 1}: số lượng phải lớn hơn 0`);
    }
    if (l.estUnitPrice != null && l.estUnitPrice < 0) {
      throw new BadRequestException(
        `Dòng ${i + 1}: đơn giá ước tính không được âm`,
      );
    }
  });
}

/** Tổng tiền ước tính, làm tròn 2 chữ số như cột numeric(18,2). */
export function estimatedTotalOf(lines: DraftLineInput[]): number {
  const sum = lines.reduce(
    (acc, l) => acc + l.qtyRequested * (l.estUnitPrice ?? 0),
    0,
  );
  return Math.round(sum * 100) / 100;
}
