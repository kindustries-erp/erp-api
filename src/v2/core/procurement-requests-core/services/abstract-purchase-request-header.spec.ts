import { ConflictException } from '@nestjs/common';
import { ApprovalEventService } from '../../approval-core/approval-event.service';
import { BasePurchaseRequestEntity } from '../entities/base-purchase-request.entity';
import { BasePurchaseRequestLineEntity } from '../entities/base-purchase-request-line.entity';
import { AbstractPurchaseRequestCommandService } from './abstract-purchase-request-command.service';

class Header extends BasePurchaseRequestEntity {}
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

function setup(status: string) {
  const header = Object.assign(new Header(), {
    id: 'h1',
    requestNo: 'DNM-1',
    status,
    requestDate: '2026-11-01',
    neededDate: null,
    title: 'cũ',
    remarks: 'ghi chú cũ',
    createdBy: 'creator',
    isDeleted: false,
  });
  const manager = {
    findOne: jest.fn().mockResolvedValue(header),
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn(async (_t: unknown, v: unknown) => v),
  };
  const dataSource = {
    transaction: (cb: (m: unknown) => Promise<unknown>) => cb(manager),
  } as never;
  const events = {
    record: jest.fn(),
  } as unknown as ApprovalEventService;
  return { svc: new TestCommand(dataSource, events), manager };
}

describe('AbstractPurchaseRequestCommandService.updateHeader', () => {
  it('chỉ ghi các trường được truyền khi còn nháp', async () => {
    const { svc, manager } = setup('DRAFT');
    const saved = (await svc.updateHeader('h1', {
      title: 'mới',
      neededDate: '2026-11-20',
      remarks: undefined,
    })) as Header;
    expect(saved.title).toBe('mới');
    expect(saved.neededDate).toBe('2026-11-20');
    expect(saved.remarks).toBe('ghi chú cũ');
    expect(saved.requestDate).toBe('2026-11-01');
    expect(manager.save).toHaveBeenCalledTimes(1);
  });

  it('từ chối sửa đầu đề khi không còn nháp', async () => {
    const { svc, manager } = setup('PENDING_APPROVAL');
    await expect(svc.updateHeader('h1', { title: 'x' })).rejects.toThrow(
      ConflictException,
    );
    expect(manager.save).not.toHaveBeenCalled();
  });
});
