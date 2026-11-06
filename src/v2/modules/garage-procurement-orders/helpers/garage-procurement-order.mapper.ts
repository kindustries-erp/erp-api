import { toProcurementOrderResponse } from '@/v2/core/procurement-orders/helpers/procurement-order.mapper';
import {
  GarageProcurementOrderAcceptanceDto,
  GarageProcurementOrderResponseDto,
} from '../dto/garage-procurement-order-response.dto';

interface GarageHeaderLike {
  id: string;
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
  rejectReason: string | null;
  cancelReason: string | null;
  closeReason: string | null;
  branchId: string | null;
  branchName: string | null;
  paymentStatus: string;
  supplierInvoiceNo: string | null;
  createdBy: string | null;
  issuedAt: Date | null;
}

interface GarageAcceptanceLike {
  id: string;
  orderLineId: string;
  qty: string;
  acceptedAt: Date;
  note: string | null;
  isVoided: boolean;
}

/** Chuyển entity PO garage sang response DTO. Không trả entity ra ngoài. */
export function toGarageProcurementOrderResponse(
  header: GarageHeaderLike,
  lines: Parameters<typeof toProcurementOrderResponse>[1],
  acceptances: GarageAcceptanceLike[] = [],
): GarageProcurementOrderResponseDto {
  const base = toProcurementOrderResponse(header, lines);
  return {
    ...base,
    branchId: header.branchId,
    branchName: header.branchName,
    paymentStatus: header.paymentStatus,
    supplierInvoiceNo: header.supplierInvoiceNo,
    createdBy: header.createdBy,
    issuedAt: header.issuedAt,
    acceptances: acceptances.map(
      (a): GarageProcurementOrderAcceptanceDto => ({
        id: a.id,
        orderLineId: a.orderLineId,
        qty: Number(a.qty),
        acceptedAt: a.acceptedAt,
        note: a.note,
        isVoided: a.isVoided,
      }),
    ),
  };
}
