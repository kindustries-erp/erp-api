import { Injectable } from '@nestjs/common';
import type { DebtFlowEvent, DebtFlowEventPort } from '@/v2/core/debts-core';
import { GarageHubService } from '@/kgara-api-core/hub/garage-hub.service';

export const GARAGE_DEBTS_FLOW_EVENTS = {
  voucherChanged: 'GARAGE_VOUCHER_CHANGED',
  allocationChanged: 'GARAGE_ALLOCATION_CHANGED',
} as const;

/**
 * Cổng sự kiện luồng thu chi garage. Chạy SAU commit: đặt lại dự thu của các vụ việc bị ảnh hưởng
 * qua hub V1. Lỗi chỉ được lõi ghi log, không làm hỏng giao dịch đã commit.
 */
@Injectable()
export class GarageDebtsFlowEventsService implements DebtFlowEventPort {
  constructor(private readonly hub: GarageHubService) {}

  async publish(event: DebtFlowEvent): Promise<void> {
    const ids = event.payload?.caseIds;
    if (!Array.isArray(ids)) return;
    for (const caseId of new Set(ids.filter((id) => typeof id === 'string'))) {
      await this.hub.handleCaseReceiptChanged(caseId);
    }
  }
}
