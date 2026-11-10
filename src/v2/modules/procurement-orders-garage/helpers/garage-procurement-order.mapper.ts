import {
  OrderHeaderLike,
  toProcurementOrderResponse,
} from '@/v2/core/procurement-orders-core/helpers/procurement-order.mapper';
import { ApprovalEmailLookup } from '@/v2/core/approval-core/helpers/approval-summary.mapper';
import {
  GarageProcurementOrderAcceptanceDto,
  GarageProcurementOrderResponseDto,
} from '../dto/garage-procurement-order-response.dto';

/** Header PO garage: lõi PO cộng các cột riêng của garage. */
export interface GarageHeaderLike extends OrderHeaderLike {
  branchId: string | null;
  branchName: string | null;
  paymentStatus: string;
  supplierInvoiceNo: string | null;
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
  emailOf: ApprovalEmailLookup = () => null,
): GarageProcurementOrderResponseDto {
  const base = toProcurementOrderResponse(header, lines, emailOf);
  return {
    ...base,
    branchId: header.branchId,
    branchName: header.branchName,
    paymentStatus: header.paymentStatus,
    supplierInvoiceNo: header.supplierInvoiceNo,
    issuedAt: header.issuedAt ?? null,
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
