import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ApprovalEventService } from '../../approval-core/approval-event.service';
import { BaseProcurementOrderEntity } from '../entities/base-procurement-order.entity';
import { BaseProcurementOrderLineEntity } from '../entities/base-procurement-order-line.entity';
import { AbstractProcurementOrderCommandService } from './abstract-procurement-order-command.service';
import { RequestLinkPort } from './request-link.port';

class Header extends BaseProcurementOrderEntity {}
class Line extends BaseProcurementOrderLineEntity {
  requestId!: string;
}

function makeHeader(over: Partial<Header> = {}): Header {
  return Object.assign(new Header(), {
    id: 'o1',
    orderNo: 'DMH-1',
    status: 'DRAFT',
    fulfillmentStatus: 'NONE',
    createdBy: 'creator',
    isDeleted: false,
    supplierId: 's1',
    totalAmount: '100',
    requestId: null,
    ...over,
  });
}

function makeLine(over: Partial<Line> = {}): Line {
  return Object.assign(new Line(), {
    id: 'l1',
    orderId: 'o1',
    lineType: 'GOODS',
    qtyOrdered: '5',
    qtyFulfilled: '0',
    unitPrice: '20',
    requestLineId: 'rl1',
    ...over,
  });
}

function setup(header: Header, lines: Line[]) {
  const manager = {
    findOne: jest.fn().mockResolvedValue(header),
    find: jest.fn().mockResolvedValue(lines),
    save: jest.fn(async (_t: unknown, v: unknown) => v),
  };
  const dataSource = {
    transaction: (cb: (m: unknown) => Promise<unknown>) => cb(manager),
  } as never;
  const events = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as ApprovalEventService;
  const link: RequestLinkPort = {
    reserve: jest.fn(),
    release: jest.fn().mockResolvedValue(undefined),
  };
  class TestCommand extends AbstractProcurementOrderCommandService<
    Header,
    Line
  > {
    protected readonly headerEntity = Header;
    protected readonly lineEntity = Line;
    protected readonly lineForeignKey = 'orderId' as never;
    protected readonly docType = 'PROCUREMENT_ORDER';
    protected readonly numberPrefix = 'DMH';
  }
  return {
    svc: new TestCommand(dataSource, events, link),
    manager,
    events,
    link,
  };
}

describe('AbstractProcurementOrderCommandService', () => {
  it('sửa đầu đơn khi DRAFT chỉ ghi các trường được truyền, bỏ qua undefined', async () => {
    const { svc, manager } = setup(makeHeader({ remarks: 'cu' }), []);
    const saved = (await svc.updateHeader('o1', {
      supplierId: 's2',
      remarks: undefined,
    })) as Header;
    expect(saved.supplierId).toBe('s2');
    expect(saved.remarks).toBe('cu');
    expect(manager.save).toHaveBeenCalled();
  });

  it('không cho sửa đầu đơn khi không còn DRAFT', async () => {
    const { svc, manager } = setup(makeHeader({ status: 'ISSUED' }), []);
    await expect(svc.updateHeader('o1', { supplierId: 's2' })).rejects.toThrow(
      ConflictException,
    );
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('xóa nháp có PR nguồn thì trả số lượng về PR và đánh dấu isDeleted', async () => {
    const { svc, link } = setup(makeHeader({ requestId: 'pr1' }), [
      makeLine({ requestLineId: 'rl1', qtyOrdered: '5' }),
    ]);
    const deleted = (await svc.softDeleteDraft('o1')) as Header;
    expect(deleted.isDeleted).toBe(true);
    expect(link.release).toHaveBeenCalledWith(expect.anything(), 'pr1', [
      expect.objectContaining({ requestLineId: 'rl1', qty: 5 }),
    ]);
  });

  it('xóa nháp không có PR thì không gọi cổng PR', async () => {
    const { svc, link } = setup(makeHeader(), [makeLine()]);
    await svc.softDeleteDraft('o1');
    expect(link.release).not.toHaveBeenCalled();
  });

  it('không xóa đơn đã duyệt bằng softDeleteDraft', async () => {
    const { svc, link, manager } = setup(
      makeHeader({ status: 'APPROVED', requestId: 'pr1' }),
      [makeLine()],
    );
    await expect(svc.softDeleteDraft('o1')).rejects.toThrow(ConflictException);
    expect(link.release).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('gửi duyệt cần NCC và đơn giá, sau đó ghi nhật ký', async () => {
    const { svc, events } = setup(makeHeader(), [makeLine()]);
    const out = await svc.transition('o1', 'submit', {
      id: 'creator',
      roles: [],
    });
    expect(out.status).toBe('PENDING_APPROVAL');
    expect(events.record).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'submit' }),
    );
  });

  it('gửi duyệt bị chặn khi thiếu đơn giá', async () => {
    const { svc } = setup(makeHeader(), [makeLine({ unitPrice: null })]);
    await expect(
      svc.transition('o1', 'submit', { id: 'creator', roles: [] }),
    ).rejects.toThrow(BadRequestException);
  });

  it('người tạo không tự duyệt được', async () => {
    const { svc } = setup(makeHeader({ status: 'PENDING_APPROVAL' }), [
      makeLine(),
    ]);
    await expect(
      svc.transition('o1', 'approve', { id: 'creator', roles: [] }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('duyệt chốt approvedTotal bằng totalAmount', async () => {
    const { svc } = setup(
      makeHeader({ status: 'PENDING_APPROVAL', totalAmount: '250' }),
      [makeLine()],
    );
    const out = await svc.transition('o1', 'approve', {
      id: 'boss',
      roles: ['MGR'],
    });
    expect(out.status).toBe('APPROVED');
    expect(out.approvedTotal).toBe('250');
  });

  it('confirm cũ bị loại: không issue được từ DRAFT', async () => {
    const { svc } = setup(makeHeader({ status: 'DRAFT' }), [makeLine()]);
    await expect(
      svc.transition('o1', 'issue', { id: 'boss', roles: [] }),
    ).rejects.toThrow(ConflictException);
  });

  it('hủy đơn có liên kết PR thì trả lại số lượng qua cổng', async () => {
    const { svc, link } = setup(
      makeHeader({ status: 'APPROVED', requestId: 'pr1' }),
      [makeLine({ qtyOrdered: '5', requestLineId: 'rl1' })],
    );
    await svc.transition(
      'o1',
      'cancel',
      { id: 'boss', roles: [] },
      'nhà cung cấp hết hàng',
    );
    expect(link.release).toHaveBeenCalledWith(expect.anything(), 'pr1', [
      { requestLineId: 'rl1', qty: 5 },
    ]);
  });

  it('không hủy được khi đã nhận hàng', async () => {
    const { svc, link } = setup(
      makeHeader({ status: 'ISSUED', requestId: 'pr1' }),
      [makeLine({ qtyFulfilled: '2' })],
    );
    await expect(
      svc.transition('o1', 'cancel', { id: 'boss', roles: [] }, 'x'),
    ).rejects.toThrow(ConflictException);
    expect(link.release).not.toHaveBeenCalled();
  });

  it('tạo nháp từ PR thì dòng phải gắn dòng PR, và không gọi DB khi dữ liệu sai', async () => {
    const { svc } = setup(makeHeader(), []);
    await expect(
      svc.createDraft(
        { id: 'u1', roles: [] },
        { orderDate: '2026-11-05', requestId: 'pr1' },
        [{ lineType: 'GOODS', qtyOrdered: 2, unitPrice: 10 }],
      ),
    ).rejects.toThrow(BadRequestException);
    await expect(
      svc.createDraft({ id: 'u1', roles: [] }, { orderDate: '2026-11-05' }, [
        {
          lineType: 'GOODS',
          qtyOrdered: 2,
          unitPrice: 10,
          requestLineId: 'rl1',
        },
      ]),
    ).rejects.toThrow(BadRequestException);
  });
});
