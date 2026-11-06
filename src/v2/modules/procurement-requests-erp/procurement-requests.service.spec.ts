import { ErpProcurementRequestsService } from './procurement-requests-erp.service';

describe('ErpProcurementRequestsService (facade)', () => {
  it('lấy role người thực hiện từ RBAC khi duyệt để ghi nhật ký', async () => {
    const command = {
      transition: jest.fn().mockResolvedValue({}),
    };
    const query = {
      findOne: jest.fn().mockResolvedValue({
        header: {
          id: 'h1',
          requestNo: 'DNM-1',
          requestDate: '2026-11-05',
          neededDate: null,
          title: null,
          requesterEmployeeId: null,
          status: 'APPROVED',
          orderingStatus: 'NONE',
          estimatedTotal: '0',
          remarks: null,
          submittedBy: null,
          approvedBy: 'boss',
          rejectedBy: null,
          rejectReason: null,
          cancelReason: null,
          closeReason: null,
        },
        lines: [],
      }),
    };
    const rbac = {
      getUserRoleNames: jest.fn().mockResolvedValue(['GIAM_DOC']),
    };

    const svc = new ErpProcurementRequestsService(
      command as never,
      query as never,
      rbac as never,
    );
    const out = await svc.transition('h1', 'approve', 'boss');

    expect(rbac.getUserRoleNames).toHaveBeenCalledWith('boss');
    expect(command.transition).toHaveBeenCalledWith(
      'h1',
      'approve',
      { id: 'boss', roles: ['GIAM_DOC'] },
      undefined,
    );
    expect(out.status).toBe('APPROVED');
    expect(out.approvedBy).toBe('boss');
  });
});
