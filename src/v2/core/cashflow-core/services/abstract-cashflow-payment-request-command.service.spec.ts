import { ConflictException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ApprovalEventService } from '@/v2/core/approval-core/approval-event.service';
import { AbstractCashflowPaymentRequestCommandService } from './abstract-cashflow-payment-request-command.service';
import { CashflowPaymentRequest } from '../entities/cashflow-payment-request.entity';

class TestPaymentRequestCommand extends AbstractCashflowPaymentRequestCommandService {
  payments = false;
  protected hasEffectivePayments(): Promise<boolean> {
    return Promise.resolve(this.payments);
  }
}

const CREATOR = 'user-creator';
const APPROVER = 'user-approver';

function build(row: Partial<CashflowPaymentRequest> | null) {
  const header = row
    ? Object.assign(new CashflowPaymentRequest(), {
        id: 'r-1',
        code: 'DNTT-0001',
        status: 'PENDING_APPROVAL',
        requiresApproval: true,
        isDeleted: false,
        createdBy: CREATOR,
        approverId: APPROVER,
        ...row,
      })
    : null;
  const qb = {
    setLock: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(header),
  };
  const manager = {
    createQueryBuilder: jest.fn(() => qb),
    create: jest.fn((_e: unknown, v: object) => ({ ...v })),
    save: jest.fn(async (_e: unknown, v: unknown) => v),
  } as unknown as EntityManager;
  const dataSource = {
    transaction: jest.fn((cb: (m: EntityManager) => Promise<unknown>) =>
      cb(manager),
    ),
  } as unknown as DataSource;
  const events = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as ApprovalEventService;
  const service = new TestPaymentRequestCommand(dataSource, events, []);
  return { service, header, events };
}

describe('AbstractCashflowPaymentRequestCommandService', () => {
  it('tạo: có duyệt -> DRAFT, không duyệt -> APPROVED', async () => {
    const { service } = build(null);
    const withApproval = await service.createDraft({ id: CREATOR, roles: [] }, {
      requiresApproval: true,
      code: 'X',
    } as never);
    const noApproval = await service.createDraft({ id: CREATOR, roles: [] }, {
      requiresApproval: false,
      code: 'Y',
    } as never);
    expect(withApproval.status).toBe('DRAFT');
    expect(noApproval.status).toBe('APPROVED');
  });

  it('duyệt: PENDING_APPROVAL -> APPROVED (không phải OPEN)', async () => {
    const { service, header, events } = build({ status: 'PENDING_APPROVAL' });
    const out = await service.transition('r-1', 'approve', {
      id: APPROVER,
      roles: [],
    });
    expect(out.status).toBe('APPROVED');
    expect(header?.approvedBy).toBe(APPROVER);
    expect(events.record).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        docType: 'CASHFLOW_PAYMENT_REQUEST',
        fromStatus: 'PENDING_APPROVAL',
        toStatus: 'APPROVED',
      }),
    );
  });

  it('từ chối cần lý do', async () => {
    const { service } = build({ status: 'PENDING_APPROVAL' });
    await expect(
      service.transition('r-1', 'reject', { id: APPROVER, roles: [] }, ''),
    ).rejects.toThrow();
  });

  it('người tạo không tự duyệt được', async () => {
    const { service } = build({ status: 'PENDING_APPROVAL', approverId: null });
    await expect(
      service.transition('r-1', 'approve', { id: CREATOR, roles: [] }),
    ).rejects.toThrow();
  });

  it('hủy DNTT đã duyệt khi chưa có thực chi: được', async () => {
    const { service, header } = build({ status: 'APPROVED' });
    await service.transition(
      'r-1',
      'cancel',
      { id: CREATOR, roles: [] },
      'nhập sai',
    );
    expect(header?.status).toBe('CANCELLED');
  });

  it('hủy DNTT đã có thực chi: bị chặn 409, trạng thái không đổi', async () => {
    const { service, header } = build({ status: 'APPROVED' });
    (service as unknown as TestPaymentRequestCommand).payments = true;
    await expect(
      service.transition(
        'r-1',
        'cancel',
        { id: CREATOR, roles: [] },
        'nhập sai',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(header?.status).toBe('APPROVED');
  });

  it('PARTIAL / PAID không hủy được (không có trong bảng chuyển)', async () => {
    const { service } = build({ status: 'PARTIAL' });
    await expect(
      service.transition('r-1', 'cancel', { id: CREATOR, roles: [] }, 'x'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
