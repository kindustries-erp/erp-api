import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ApprovalEventService } from '../../approval-core/approval-event.service';
import { BasePurchaseRequestEntity } from '../entities/base-purchase-request.entity';
import { BasePurchaseRequestLineEntity } from '../entities/base-purchase-request-line.entity';
import { AbstractPurchaseRequestCommandService } from './abstract-purchase-request-command.service';
import { AbstractPurchaseRequestOrderingService } from './abstract-purchase-request-ordering.service';

class Header extends BasePurchaseRequestEntity {}
class Line extends BasePurchaseRequestLineEntity {
  requestId!: string;
}

function makeHeader(over: Partial<Header> = {}): Header {
  return Object.assign(new Header(), {
    id: 'h1',
    requestNo: 'DNM-1',
    status: 'DRAFT',
    orderingStatus: 'NONE',
    createdBy: 'creator',
    isDeleted: false,
    closeReason: null,
    closedAt: null,
    ...over,
  });
}

function makeLine(over: Partial<Line>): Line {
  return Object.assign(new Line(), {
    id: 'l1',
    requestId: 'h1',
    lineType: 'GOODS',
    qtyRequested: '10',
    qtyOrdered: '0',
    ...over,
  });
}

function fakeManager(header: Header | null, lines: Line[] = []) {
  const saved: unknown[] = [];
  const manager = {
    findOne: jest.fn().mockResolvedValue(header),
    find: jest.fn().mockResolvedValue(lines),
    save: jest.fn(async (_target: unknown, value: unknown) => {
      saved.push(value);
      return value;
    }),
  };
  return { manager, saved };
}

function fakeDataSource(manager: unknown) {
  return {
    transaction: async (cb: (m: unknown) => Promise<unknown>) => cb(manager),
  } as never;
}

class TestCommand extends AbstractPurchaseRequestCommandService<Header, Line> {
  protected readonly headerEntity = Header;
  protected readonly lineEntity = Line;
  protected readonly lineForeignKey = 'requestId' as const;
  protected readonly docType = 'PROCUREMENT_REQUEST';
  protected readonly numberPrefix = 'DNM';
}

class TestOrdering extends AbstractPurchaseRequestOrderingService<
  Header,
  Line
> {
  protected readonly headerEntity = Header;
  protected readonly lineEntity = Line;
  protected readonly lineForeignKey = 'requestId' as const;
}

const events = {
  record: jest.fn().mockResolvedValue(undefined),
} as unknown as ApprovalEventService;

describe('AbstractPurchaseRequestCommandService.transition', () => {
  beforeEach(() => jest.clearAllMocks());

  it('gửi duyệt và ghi nhật ký trong cùng transaction', async () => {
    const header = makeHeader();
    const { manager } = fakeManager(header);
    const svc = new TestCommand(fakeDataSource(manager), events);

    const out = await svc.transition('h1', 'submit', {
      id: 'creator',
      roles: ['STAFF'],
    });

    expect(out.status).toBe('PENDING_APPROVAL');
    expect(out.submittedBy).toBe('creator');
    expect(events.record).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        action: 'submit',
        fromStatus: 'DRAFT',
        toStatus: 'PENDING_APPROVAL',
        docId: 'h1',
      }),
    );
  });

  it('chặn người tạo tự duyệt', async () => {
    const header = makeHeader({ status: 'PENDING_APPROVAL' });
    const svc = new TestCommand(
      fakeDataSource(fakeManager(header).manager),
      events,
    );
    await expect(
      svc.transition('h1', 'approve', { id: 'creator', roles: ['MGR'] }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('từ chối bắt buộc lý do và đưa về DRAFT', async () => {
    const header = makeHeader({ status: 'PENDING_APPROVAL' });
    const svc = new TestCommand(
      fakeDataSource(fakeManager(header).manager),
      events,
    );
    await expect(
      svc.transition('h1', 'reject', { id: 'boss', roles: ['MGR'] }, '  '),
    ).rejects.toThrow(BadRequestException);

    const out = await svc.transition(
      'h1',
      'reject',
      { id: 'boss', roles: ['MGR'] },
      'thiếu báo giá',
    );
    expect(out.status).toBe('DRAFT');
    expect(out.rejectReason).toBe('thiếu báo giá');
  });

  it('không hủy được khi đã có dòng được đặt', async () => {
    const header = makeHeader({ status: 'APPROVED' });
    const lines = [makeLine({ qtyOrdered: '2' })];
    const svc = new TestCommand(
      fakeDataSource(fakeManager(header, lines).manager),
      events,
    );
    await expect(
      svc.transition('h1', 'cancel', { id: 'boss', roles: [] }, 'hủy'),
    ).rejects.toThrow(ConflictException);
  });

  it('không tìm thấy hoặc đã xóa mềm thì không xử lý', async () => {
    const svc = new TestCommand(
      fakeDataSource(fakeManager(null).manager),
      events,
    );
    await expect(
      svc.transition('x', 'submit', { id: 'a', roles: [] }),
    ).rejects.toThrow();
  });
});

describe('AbstractPurchaseRequestOrderingService', () => {
  it('đặt đủ toàn bộ thì PR giữ APPROVED, chỉ orderingStatus thành FULL', async () => {
    const header = makeHeader({ status: 'APPROVED' });
    const lines = [makeLine({ id: 'l1', qtyRequested: '10', qtyOrdered: '4' })];
    const { manager, saved } = fakeManager(header, lines);
    const svc = new TestOrdering();

    await svc.reserve(manager as never, 'h1', [
      { requestLineId: 'l1', qty: 6 },
    ]);

    const savedHeader = saved.find((v) => v instanceof Header) as Header;
    expect(savedHeader.orderingStatus).toBe('FULL');
    expect(savedHeader.status).toBe('APPROVED');
    expect(savedHeader.closedAt).toBeNull();
    expect(lines[0].qtyOrdered).toBe('10');
  });

  it('đặt vượt phần còn lại thì từ chối', async () => {
    const header = makeHeader({ status: 'APPROVED' });
    const lines = [makeLine({ qtyRequested: '10', qtyOrdered: '7' })];
    const svc = new TestOrdering();
    await expect(
      svc.reserve(fakeManager(header, lines).manager as never, 'h1', [
        { requestLineId: 'l1', qty: 4 },
      ]),
    ).rejects.toThrow(ConflictException);
  });

  it('trả lại số lượng thì orderingStatus về PARTIAL, status không đổi', async () => {
    const header = makeHeader({ status: 'APPROVED', orderingStatus: 'FULL' });
    const lines = [makeLine({ qtyRequested: '10', qtyOrdered: '10' })];
    const { manager, saved } = fakeManager(header, lines);
    await new TestOrdering().release(manager as never, 'h1', [
      { requestLineId: 'l1', qty: 3 },
    ]);
    const savedHeader = saved.find((v) => v instanceof Header) as Header;
    expect(savedHeader.status).toBe('APPROVED');
    expect(savedHeader.orderingStatus).toBe('PARTIAL');
  });

  it('trả hết số lượng thì orderingStatus về NONE', async () => {
    const header = makeHeader({
      status: 'APPROVED',
      orderingStatus: 'PARTIAL',
    });
    const lines = [makeLine({ qtyRequested: '10', qtyOrdered: '4' })];
    const { manager, saved } = fakeManager(header, lines);
    await new TestOrdering().release(manager as never, 'h1', [
      { requestLineId: 'l1', qty: 4 },
    ]);
    const savedHeader = saved.find((v) => v instanceof Header) as Header;
    expect(savedHeader.orderingStatus).toBe('NONE');
    expect(savedHeader.status).toBe('APPROVED');
  });
});

describe('cổng đặt hàng: loại dòng', () => {
  it('từ chối đặt khi loại dòng PO không khớp với dòng đề nghị', async () => {
    const header = makeHeader({ status: 'APPROVED' });
    const line = makeLine({
      lineType: 'SERVICE',
      qtyRequested: '5',
      qtyOrdered: '0',
    });
    const { manager } = fakeManager(header, [line]);
    await expect(
      new TestOrdering().reserve(manager as never, 'h1', [
        { requestLineId: 'l1', qty: 1, lineType: 'GOODS' },
      ]),
    ).rejects.toThrow(ConflictException);
  });
});
