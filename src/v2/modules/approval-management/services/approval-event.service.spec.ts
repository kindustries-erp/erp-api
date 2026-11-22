import { ApprovalEventService } from './approval-event.service';

describe('ApprovalEventService', () => {
  it('ghi một dòng nhật ký với đúng trường và comment mặc định null', async () => {
    const insert = jest.fn().mockResolvedValue({});
    const manager = {
      getRepository: jest.fn().mockReturnValue({ insert }),
    } as any;
    const svc = new ApprovalEventService();

    await svc.record(manager, {
      docType: 'PROCUREMENT_REQUEST',
      docId: 'd1',
      action: 'submit',
      fromStatus: 'DRAFT',
      toStatus: 'PENDING_APPROVAL',
      actorId: 'u1',
      actorRoles: ['STAFF'],
    });

    expect(insert).toHaveBeenCalledWith({
      docType: 'PROCUREMENT_REQUEST',
      docId: 'd1',
      action: 'submit',
      fromStatus: 'DRAFT',
      toStatus: 'PENDING_APPROVAL',
      actorId: 'u1',
      actorRoles: ['STAFF'],
      comment: null,
    });
  });
});
