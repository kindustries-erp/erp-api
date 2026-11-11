import { ConflictException } from '@nestjs/common';
import { ApprovalEventService } from '../../approval-core/approval-event.service';
import { BaseProcurementOrderEntity } from '../entities/base-procurement-order.entity';
import { BaseProcurementOrderLineEntity } from '../entities/base-procurement-order-line.entity';
import { AbstractProcurementOrderCommandService } from './abstract-procurement-order-command.service';
import { RequestLinkPort } from './request-link.port';

class Header extends BaseProcurementOrderEntity {
  branchId?: string | null;
  branchName?: string | null;
}
class Line extends BaseProcurementOrderLineEntity {
  orderId!: string;
}

class TestCommand extends AbstractProcurementOrderCommandService<Header, Line> {
  protected readonly headerEntity = Header;
  protected readonly lineEntity = Line;
  protected readonly lineForeignKey = 'orderId' as never;
  protected readonly docType = 'PROCUREMENT_ORDER';
  protected readonly numberPrefix = 'DMH';
}

function sourceHeader(over: Partial<Header> = {}): Header {
  return Object.assign(new Header(), {
    id: 'src',
    orderNo: 'DMH-1',
    status: 'REJECTED',
    fulfillmentStatus: 'NONE',
    createdBy: 'creator',
    approverId: null,
    isDeleted: false,
    orderDate: '2026-11-11',
    expectedDate: '2026-11-25',
    supplierId: 's1',
    supplierName: 'NCC A',
    remarks: 'gấp',
    requestId: 'req-1',
    branchId: 'branch-1',
    branchName: 'Chi nhánh 1',
    ...over,
  });
}

function sourceLine(over: Partial<Line> = {}): Line {
  return Object.assign(new Line(), {
    id: 'l1',
    orderId: 'src',
    lineNo: 1,
    lineType: 'GOODS',
    itemId: null,
    itemCode: 'OIL-1',
    itemName: 'Dầu nhớt',
    description: null,
    qtyOrdered: '2',
    qtyFulfilled: '0',
    unitPrice: '75',
    requestLineId: 'rl-1',
    ...over,
  });
}

function setup(header: Header | null, lines: Line[] = []) {
  const manager = {
    findOne: jest.fn().mockResolvedValue(header),
    find: jest.fn().mockResolvedValue(lines),
    getRepository: () => ({ findOne: jest.fn().mockResolvedValue(null) }),
    save: jest.fn(async (_t: unknown, v: unknown) => v),
  };
  const dataSource = {
    manager,
    transaction: (cb: (m: unknown) => Promise<unknown>) => cb(manager),
  } as never;
  const events = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as ApprovalEventService;
  const link: RequestLinkPort = {
    reserve: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
  };
  const svc = new TestCommand(dataSource, events, link);
  const createDraft = jest
    .spyOn(svc, 'createDraft')
    .mockResolvedValue({ id: 'new-1' } as unknown as Header);
  return { svc, createDraft, link };
}

describe('AbstractProcurementOrderCommandService.cloneDraft', () => {
  beforeEach(() => jest.clearAllMocks());

  it('nhân bản đơn đã từ chối: giữ PR nguồn và dòng đề nghị, truy vết đơn gốc', async () => {
    const { svc, createDraft } = setup(sourceHeader(), [sourceLine()]);

    await svc.cloneDraft('src', { id: 'staff-2', roles: [] }, [
      'branchId',
      'branchName',
    ]);

    const [actor, header, lines] = createDraft.mock.calls[0] as unknown as [
      { id: string },
      Record<string, unknown>,
      Array<Record<string, unknown>>,
    ];
    expect(actor.id).toBe('staff-2');
    expect(header).toMatchObject({
      supplierId: 's1',
      supplierName: 'NCC A',
      remarks: 'gấp',
      requestId: 'req-1',
      clonedFromId: 'src',
      branchId: 'branch-1',
      extraData: {},
    });
    expect(header).not.toHaveProperty('approverId');
    expect(lines).toEqual([
      expect.objectContaining({
        lineType: 'GOODS',
        qtyOrdered: 2,
        unitPrice: 75,
        requestLineId: 'rl-1',
        itemCode: 'OIL-1',
      }),
    ]);
  });

  it('từ chối nhân bản khi đơn đang chờ duyệt, nháp hoặc đã phát hành', async () => {
    for (const status of ['PENDING_APPROVAL', 'DRAFT', 'ISSUED']) {
      const { svc, createDraft } = setup(sourceHeader({ status }), [
        sourceLine(),
      ]);
      await expect(
        svc.cloneDraft('src', { id: 'staff-2', roles: [] }),
      ).rejects.toThrow(ConflictException);
      expect(createDraft).not.toHaveBeenCalled();
    }
  });
});

describe('AbstractProcurementOrderCommandService — từ chối đơn có PR nguồn', () => {
  it('trả lại số đã giữ trên PR (như khi hủy) và chuyển sang REJECTED', async () => {
    const header = sourceHeader({
      status: 'PENDING_APPROVAL',
      createdBy: 'creator',
      requestId: 'req-1',
    });
    const { svc, link } = setup(header, [sourceLine()]);

    const out = await svc.transition(
      'src',
      'reject',
      { id: 'boss', roles: [] },
      'sai giá',
    );

    expect(out.status).toBe('REJECTED');
    expect(link.release).toHaveBeenCalledWith(expect.anything(), 'req-1', [
      expect.objectContaining({ requestLineId: 'rl-1', qty: 2 }),
    ]);
  });
});
