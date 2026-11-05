import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { ApprovalEventService } from '@/v2/core/approval/approval-event.service';
import { ProcurementOrderCommandService } from './services/procurement-order-command.service';
import {
  PROCUREMENT_REQUEST_LINK,
  ProcurementRequestLinkAdapter,
} from './services/procurement-request-link.adapter';
import { ProcurementRequestOrderingService } from '@/v2/modules/erp-procurement-requests/services/procurement-request-ordering.service';

describe('Nối DI của module PO (token cổng PR)', () => {
  it('ProcurementOrderCommandService nhận đúng cổng PR qua token', async () => {
    const adapter = { reserve: jest.fn(), release: jest.fn() };
    const mod = await Test.createTestingModule({
      providers: [
        ProcurementOrderCommandService,
        { provide: DataSource, useValue: {} },
        { provide: ApprovalEventService, useValue: {} },
        { provide: PROCUREMENT_REQUEST_LINK, useValue: adapter },
      ],
    }).compile();

    const svc = mod.get(ProcurementOrderCommandService);
    expect(svc).toBeDefined();
    // Chuỗi lớp cha giữ đúng tham chiếu cổng
    expect((svc as unknown as { requestLink: unknown }).requestLink).toBe(
      adapter,
    );
  });

  it('ProcurementRequestLinkAdapter chuyển reserve/release sang service PR đúng chữ ký', async () => {
    const ordering = {
      reserve: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
    };
    const adapter = new ProcurementRequestLinkAdapter(
      ordering as unknown as ProcurementRequestOrderingService,
    );
    const m = {} as never;
    await adapter.reserve(m, 'pr1', [
      { requestLineId: 'rl1', qty: 2, lineType: 'GOODS' },
    ]);
    await adapter.release(m, 'pr1', [{ requestLineId: 'rl1', qty: 2 }]);
    expect(ordering.reserve).toHaveBeenCalledWith(m, 'pr1', [
      { requestLineId: 'rl1', qty: 2, lineType: 'GOODS' },
    ]);
    expect(ordering.release).toHaveBeenCalledWith(m, 'pr1', [
      { requestLineId: 'rl1', qty: 2 },
    ]);
  });
});
