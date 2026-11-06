import { ConflictException, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ApprovalEventService } from '../../approval/approval-event.service';
import { BasePurchaseRequestEntity } from '../entities/base-purchase-request.entity';
import { BasePurchaseRequestLineEntity } from '../entities/base-purchase-request-line.entity';
import { AbstractPurchaseRequestCommandService } from './abstract-purchase-request-command.service';

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
    ...over,
  });
}

function makeLine(over: Partial<Line> = {}): Line {
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

class TestCommand extends AbstractPurchaseRequestCommandService<Header, Line> {
  protected readonly headerEntity = Header;
  protected readonly lineEntity = Line;
  protected readonly lineForeignKey = 'requestId' as const;
  protected readonly docType = 'PROCUREMENT_REQUEST';
  protected readonly numberPrefix = 'DNM';
  /** Số đơn mua tham chiếu giả lập, cho nhánh chặn xóa cứng. */
  dependentOrders = 0;

  protected override async assertNoDependentOrders(
    _manager: EntityManager,
    _id: string,
  ): Promise<void> {
    if (this.dependentOrders > 0) {
      throw new ConflictException('có đơn mua tham chiếu');
    }
  }
}

describe('AbstractPurchaseRequestCommandService.softDeleteDraft', () => {
  beforeEach(() => jest.clearAllMocks());

  it('đề nghị nháp không có số lượng giữ thì đặt isDeleted', async () => {
    const header = makeHeader();
    const { manager } = fakeManager(header, [makeLine()]);
    const svc = new TestCommand(fakeDataSource(manager), events);

    const out = await svc.softDeleteDraft('h1');

    expect(out.isDeleted).toBe(true);
    expect(manager.save).toHaveBeenCalledWith(Header, header);
  });

  it('từ chối khi không còn DRAFT và không ghi gì', async () => {
    const header = makeHeader({ status: 'PENDING_APPROVAL' });
    const { manager } = fakeManager(header, [makeLine()]);
    const svc = new TestCommand(fakeDataSource(manager), events);

    await expect(svc.softDeleteDraft('h1')).rejects.toThrow(ConflictException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('từ chối khi dòng đã được đơn mua giữ số lượng', async () => {
    const header = makeHeader();
    const { manager } = fakeManager(header, [makeLine({ qtyOrdered: '4' })]);
    const svc = new TestCommand(fakeDataSource(manager), events);

    await expect(svc.softDeleteDraft('h1')).rejects.toThrow(
      'Không xóa được đề nghị đã có đơn mua giữ số lượng',
    );
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('không tìm thấy hoặc đã xóa mềm thì báo NotFound', async () => {
    const { manager } = fakeManager(null);
    const svc = new TestCommand(fakeDataSource(manager), events);

    await expect(svc.softDeleteDraft('x')).rejects.toThrow(NotFoundException);
  });
});

describe('AbstractPurchaseRequestCommandService.hardDeleteDraft', () => {
  beforeEach(() => jest.clearAllMocks());

  it('nháp không có đơn tham chiếu thì xóa dòng rồi xóa đầu đề', async () => {
    const { manager, deleted } = fakeManager(makeHeader(), [makeLine()]);
    const svc = new TestCommand(fakeDataSource(manager), events);

    await svc.hardDeleteDraft('h1');

    expect(deleted).toEqual([
      { target: Line, criteria: { requestId: 'h1' } },
      { target: Header, criteria: 'h1' },
    ]);
  });

  it('còn đơn mua tham chiếu thì chặn và không xóa gì', async () => {
    const { manager, deleted } = fakeManager(makeHeader(), [makeLine()]);
    const svc = new TestCommand(fakeDataSource(manager), events);
    svc.dependentOrders = 1;

    await expect(svc.hardDeleteDraft('h1')).rejects.toThrow(ConflictException);
    expect(deleted).toHaveLength(0);
  });

  it('không còn DRAFT thì chặn và không xóa gì', async () => {
    const { manager, deleted } = fakeManager(
      makeHeader({ status: 'APPROVED' }),
      [makeLine()],
    );
    const svc = new TestCommand(fakeDataSource(manager), events);

    await expect(svc.hardDeleteDraft('h1')).rejects.toThrow(ConflictException);
    expect(deleted).toHaveLength(0);
  });

  it('dòng đã có số lượng giữ thì chặn và không xóa gì', async () => {
    const { manager, deleted } = fakeManager(makeHeader(), [
      makeLine({ qtyOrdered: '2' }),
    ]);
    const svc = new TestCommand(fakeDataSource(manager), events);

    await expect(svc.hardDeleteDraft('h1')).rejects.toThrow(ConflictException);
    expect(deleted).toHaveLength(0);
  });
});
