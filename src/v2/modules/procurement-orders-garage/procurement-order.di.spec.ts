import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { ApprovalEventService } from '@/v2/core/approval-core/approval-event.service';
import { GarageProcurementOrderCommandService } from './services/procurement-order-command.service';
import {
  GARAGE_PROCUREMENT_REQUEST_LINK,
  GarageProcurementRequestLinkAdapter,
} from './services/garage-procurement-request-link.adapter';
import { GarageProcurementRequestOrderingService } from '@/v2/modules/procurement-requests-garage/services/garage-procurement-request-ordering.service';

describe('Nối DI của module PO (token cổng PR)', () => {
  it('GarageProcurementOrderCommandService nhận đúng cổng PR qua token', async () => {
    const adapter = { reserve: jest.fn(), release: jest.fn() };
    const mod = await Test.createTestingModule({
      providers: [
        GarageProcurementOrderCommandService,
        { provide: DataSource, useValue: {} },
        { provide: ApprovalEventService, useValue: {} },
        { provide: GARAGE_PROCUREMENT_REQUEST_LINK, useValue: adapter },
      ],
    }).compile();

    const svc = mod.get(GarageProcurementOrderCommandService);
    expect(svc).toBeDefined();
    // Chuỗi lớp cha giữ đúng tham chiếu cổng
    expect((svc as unknown as { requestLink: unknown }).requestLink).toBe(
      adapter,
    );
  });

  it('GarageProcurementRequestLinkAdapter chuyển reserve/release sang service PR đúng chữ ký', async () => {
    const ordering = {
      reserve: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
    };
    const adapter = new GarageProcurementRequestLinkAdapter(
      ordering as unknown as GarageProcurementRequestOrderingService,
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
