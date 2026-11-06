import { ConflictException, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ApprovalEventService } from '../../approval/approval-event.service';
import { BaseProcurementOrderEntity } from '../entities/base-procurement-order.entity';
import { BaseProcurementOrderLineEntity } from '../entities/base-procurement-order-line.entity';
import { AbstractProcurementOrderCommandService } from './abstract-procurement-order-command.service';
import type { RequestLinkPort } from './request-link.port';

class Header extends BaseProcurementOrderEntity {}
class Line extends BaseProcurementOrderLineEntity {
  orderId!: string;
}

function makeHeader(over: Partial<Header> = {}): Header {
  return Object.assign(new Header(), {
    id: 'o1',
    orderNo: 'DMH-1',
    status: 'DRAFT',
    fulfillmentStatus: 'NONE',
    requestId: null,
    createdBy: 'creator',
    isDeleted: false,
    ...over,
  });
}

function makeLine(over: Partial<Line> = {}): Line {
  return Object.assign(new Line(), {
    id: 'ol1',
    orderId: 'o1',
    lineType: 'GOODS',
    qtyOrdered: '4',
    qtyFulfilled: '0',
    unitPrice: '10',
    requestLineId: 'rl1',
    ...over,
  });
}

function fakeManager(header: Header | null, lines: Line[] = []) {
  const deleted: Array<{ target: unknown; criteria: unknown }> = [];
  const manager = {
    findOne: jest.fn().mockResolvedValue(header),
    find: jest.fn().mockResolvedValue(lines),
    save: jest.fn(async (_target: unknown, value: unknown) => value),
    delete: jest.fn(async (target: unknown, criteria: unknown) => {
      deleted.push({ target, criteria });
      return {};
    }),
  };
  return { manager, deleted };
}

function fakeDataSource(manager: unknown) {
  return {
    transaction: async (cb: (m: unknown) => Promise<unknown>) => cb(manager),
  } as never;
}

const events = {
  record: jest.fn().mockResolvedValue(undefined),
} as unknown as ApprovalEventService;

function makeLink(): RequestLinkPort & { release: jest.Mock } {
  return {
    reserve: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
  } as unknown as RequestLinkPort & { release: jest.Mock };
}

class TestOrderCommand extends AbstractProcurementOrderCommandService<
  Header,
  Line
> {
  protected readonly headerEntity = Header;
  protected readonly lineEntity = Line;
  protected readonly lineForeignKey = 'orderId' as const;
  protected readonly docType = 'PROCUREMENT_ORDER';
  protected readonly numberPrefix = 'DMH';
  /** Số phiếu nhập tham chiếu giả lập, cho nhánh chặn xóa cứng. */
  dependentReceipts = 0;

  protected override async assertNoDependentReceipts(
    _manager: EntityManager,
    _id: string,
  ): Promise<void> {
    if (this.dependentReceipts > 0) {
      throw new ConflictException('có phiếu nhập tham chiếu');
    }
  }
}

describe('AbstractProcurementOrderCommandService.hardDeleteDraft', () => {
  beforeEach(() => jest.clearAllMocks());

  it('đơn nháp có PR nguồn: trả số lượng về PR, xóa dòng rồi xóa đầu đơn', async () => {
    const link = makeLink();
    const { manager, deleted } = fakeManager(makeHeader({ requestId: 'r1' }), [
      makeLine(),
    ]);
    const svc = new TestOrderCommand(fakeDataSource(manager), events, link);

    await svc.hardDeleteDraft('o1');

    expect(link.release).toHaveBeenCalledWith(manager, 'r1', [
      { requestLineId: 'rl1', qty: 4, lineType: 'GOODS' },
    ]);
    expect(deleted).toEqual([
      { target: Line, criteria: { orderId: 'o1' } },
      { target: Header, criteria: 'o1' },
    ]);
  });

  it('đơn nháp không có PR nguồn: không gọi cổng PR, vẫn xóa được', async () => {
    const link = makeLink();
    const { manager, deleted } = fakeManager(makeHeader(), [
      makeLine({ requestLineId: null }),
    ]);
    const svc = new TestOrderCommand(fakeDataSource(manager), events, link);

    await svc.hardDeleteDraft('o1');

    expect(link.release).not.toHaveBeenCalled();
    expect(deleted).toHaveLength(2);
  });

  it('còn phiếu nhập tham chiếu thì chặn và không xóa gì', async () => {
    const link = makeLink();
    const { manager, deleted } = fakeManager(makeHeader({ requestId: 'r1' }), [
      makeLine(),
    ]);
    const svc = new TestOrderCommand(fakeDataSource(manager), events, link);
    svc.dependentReceipts = 1;

    await expect(svc.hardDeleteDraft('o1')).rejects.toThrow(ConflictException);
    expect(link.release).not.toHaveBeenCalled();
    expect(deleted).toHaveLength(0);
  });

  it('đơn không còn DRAFT thì chặn và không xóa gì', async () => {
    const link = makeLink();
    const { manager, deleted } = fakeManager(makeHeader({ status: 'ISSUED' }), [
      makeLine(),
    ]);
    const svc = new TestOrderCommand(fakeDataSource(manager), events, link);

    await expect(svc.hardDeleteDraft('o1')).rejects.toThrow(ConflictException);
    expect(deleted).toHaveLength(0);
  });

  it('không tìm thấy đơn thì báo NotFound', async () => {
    const link = makeLink();
    const { manager } = fakeManager(null);
    const svc = new TestOrderCommand(fakeDataSource(manager), events, link);

    await expect(svc.hardDeleteDraft('x')).rejects.toThrow(NotFoundException);
  });
});

describe('AbstractProcurementOrderCommandService.softDeleteDraft (sau tách hàm trả SL)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('vẫn trả SL về PR và đặt isDeleted, không xóa dòng', async () => {
    const link = makeLink();
    const { manager, deleted } = fakeManager(makeHeader({ requestId: 'r1' }), [
      makeLine(),
    ]);
    const svc = new TestOrderCommand(fakeDataSource(manager), events, link);

    const out = await svc.softDeleteDraft('o1');

    expect(out.isDeleted).toBe(true);
    expect(link.release).toHaveBeenCalledTimes(1);
    expect(deleted).toHaveLength(0);
  });
});
