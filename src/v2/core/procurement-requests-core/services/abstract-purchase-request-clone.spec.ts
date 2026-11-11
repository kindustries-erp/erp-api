import { ConflictException, NotFoundException } from '@nestjs/common';
import { ApprovalEventService } from '../../approval-core/approval-event.service';
import { BasePurchaseRequestEntity } from '../entities/base-purchase-request.entity';
import { BasePurchaseRequestLineEntity } from '../entities/base-purchase-request-line.entity';
import { AbstractPurchaseRequestCommandService } from './abstract-purchase-request-command.service';

class Header extends BasePurchaseRequestEntity {
  branchId?: string | null;
  branchName?: string | null;
}
class Line extends BasePurchaseRequestLineEntity {
  requestId!: string;
}

class TestCommand extends AbstractPurchaseRequestCommandService<Header, Line> {
  protected readonly headerEntity = Header;
  protected readonly lineEntity = Line;
  protected readonly lineForeignKey = 'requestId' as const;
  protected readonly docType = 'PROCUREMENT_REQUEST';
  protected readonly numberPrefix = 'DNM';
}

const events = {
  record: jest.fn().mockResolvedValue(undefined),
} as unknown as ApprovalEventService;

function sourceHeader(over: Partial<Header> = {}): Header {
  return Object.assign(new Header(), {
    id: 'src',
    requestNo: 'DNM-1',
    status: 'REJECTED',
    orderingStatus: 'NONE',
    createdBy: 'creator',
    approverId: null,
    title: 'Mua dầu',
    neededDate: '2026-11-20',
    requesterEmployeeId: null,
    remarks: 'gấp',
    estimatedTotal: '300',
    isDeleted: false,
    branchId: 'branch-1',
    branchName: 'Chi nhánh 1',
    rejectReason: 'thiếu báo giá',
    ...over,
  });
}

function sourceLine(over: Partial<Line> = {}): Line {
  return Object.assign(new Line(), {
    id: 'l1',
    requestId: 'src',
    lineNo: 1,
    lineType: 'GOODS',
    itemId: null,
    itemCode: 'OIL-1',
    itemName: 'Dầu nhớt',
    description: null,
    qtyRequested: '4',
    qtyOrdered: '0',
    estUnitPrice: '75',
    notes: null,
    ...over,
  });
}

function setup(header: Header | null, lines: Line[] = []) {
  const manager = {
    findOne: jest.fn().mockResolvedValue(header),
    find: jest.fn().mockResolvedValue(lines),
  };
  const dataSource = {
    manager,
    transaction: async (cb: (m: unknown) => Promise<unknown>) => cb(manager),
  } as never;
  const svc = new TestCommand(dataSource, events);
  const createDraft = jest
    .spyOn(svc, 'createDraft')
    .mockResolvedValue({ id: 'new-1' } as unknown as Header);
  return { svc, createDraft };
}

describe('AbstractPurchaseRequestCommandService.cloneDraft', () => {
  beforeEach(() => jest.clearAllMocks());

  it('nhân bản phiếu đã từ chối: copy đầu đề và dòng, truy vết phiếu gốc, không copy duyệt/từ chối', async () => {
    const { svc, createDraft } = setup(sourceHeader(), [sourceLine()]);

    await svc.cloneDraft('src', { id: 'staff-2', roles: ['STAFF'] }, [
      'branchId',
      'branchName',
    ]);

    expect(createDraft).toHaveBeenCalledTimes(1);
    const [actor, header, lines] = createDraft.mock.calls[0] as unknown as [
      { id: string },
      Record<string, unknown>,
      Array<Record<string, unknown>>,
    ];
    expect(actor.id).toBe('staff-2');
    expect(header).toMatchObject({
      title: 'Mua dầu',
      neededDate: '2026-11-20',
      remarks: 'gấp',
      clonedFromId: 'src',
      branchId: 'branch-1',
      branchName: 'Chi nhánh 1',
      extraData: {},
    });
    expect(header).not.toHaveProperty('rejectReason');
    expect(header).not.toHaveProperty('approverId');
    expect(header.requestDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(lines).toEqual([
      expect.objectContaining({
        lineType: 'GOODS',
        itemCode: 'OIL-1',
        itemName: 'Dầu nhớt',
        qtyRequested: 4,
        estUnitPrice: 75,
      }),
    ]);
  });

  it('không copy trường riêng của họ khi không được yêu cầu', async () => {
    const { svc, createDraft } = setup(sourceHeader(), [sourceLine()]);

    await svc.cloneDraft('src', { id: 'staff-2', roles: [] });

    const header = createDraft.mock.calls[0][1] as unknown as Record<
      string,
      unknown
    >;
    expect(header).not.toHaveProperty('branchId');
  });

  it('nhân bản phiếu đã hủy cũng được phép', async () => {
    const { svc, createDraft } = setup(sourceHeader({ status: 'CANCELLED' }), [
      sourceLine(),
    ]);

    await svc.cloneDraft('src', { id: 'staff-2', roles: [] });

    expect(createDraft).toHaveBeenCalledTimes(1);
  });

  it('từ chối nhân bản khi phiếu đang chờ duyệt hoặc đang nháp', async () => {
    for (const status of ['PENDING_APPROVAL', 'DRAFT', 'APPROVED']) {
      const { svc, createDraft } = setup(sourceHeader({ status }), [
        sourceLine(),
      ]);
      await expect(
        svc.cloneDraft('src', { id: 'staff-2', roles: [] }),
      ).rejects.toThrow(ConflictException);
      expect(createDraft).not.toHaveBeenCalled();
    }
  });

  it('báo không tìm thấy khi phiếu gốc không tồn tại', async () => {
    const { svc, createDraft } = setup(null);

    await expect(
      svc.cloneDraft('missing', { id: 'staff-2', roles: [] }),
    ).rejects.toThrow(NotFoundException);
    expect(createDraft).not.toHaveBeenCalled();
  });
});

describe('AbstractPurchaseRequestCommandService — REJECTED là trạng thái cuối', () => {
  it('phiếu đã từ chối không gửi lại, không duyệt được', async () => {
    const header = sourceHeader({ status: 'REJECTED' });
    const manager = {
      findOne: jest.fn().mockResolvedValue(header),
      find: jest.fn().mockResolvedValue([]),
      getRepository: () => ({ findOne: jest.fn().mockResolvedValue(null) }),
      save: jest.fn(async (_t: unknown, v: unknown) => v),
    };
    const dataSource = {
      transaction: async (cb: (m: unknown) => Promise<unknown>) => cb(manager),
    } as never;
    const svc = new TestCommand(dataSource, events);

    await expect(
      svc.transition('src', 'submit', { id: 'creator', roles: [] }),
    ).rejects.toThrow(ConflictException);
    await expect(
      svc.transition('src', 'approve', { id: 'boss', roles: [] }),
    ).rejects.toThrow(ConflictException);
  });
});
