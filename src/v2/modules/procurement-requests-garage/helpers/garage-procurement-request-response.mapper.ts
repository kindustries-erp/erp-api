import { overriddenFields } from '@/v2/core/link-override-core';
import { toPurchaseRequestResponse } from '@/v2/core/procurement-requests-core/helpers/procurement-request.mapper';
import type { RequestLineLike } from '@/v2/core/procurement-requests-core/helpers/procurement-request.mapper';
import type { RelatedOrderDto } from '@/v2/core/procurement-requests-core/dto/procurement-request-response.dto';
import type { ApprovalEmailLookup } from '@/v2/core/approval-core/helpers/approval-summary.mapper';
import type { GarageProcurementRequest } from '../entities/procurement-request.entity';
import type { GarageProcurementRequestResponseDto } from '../dto/garage-procurement-request-response.dto';

/** Chuyển entity sang response, kèm chi nhánh liên kết và danh sách field đã override. */
export function toGarageProcurementRequestResponse(
  header: GarageProcurementRequest,
  lines: RequestLineLike[],
  emailOf?: ApprovalEmailLookup,
  relatedOrders?: RelatedOrderDto[],
): GarageProcurementRequestResponseDto {
  return {
    ...toPurchaseRequestResponse(header, lines, emailOf, relatedOrders),
    branchId: header.branchId ?? null,
    branchName: header.branchName ?? null,
    overriddenFields: overriddenFields(header.overrides ?? {}),
    sourceSnapshot: header.sourceSnapshot ?? {},
  };
}
