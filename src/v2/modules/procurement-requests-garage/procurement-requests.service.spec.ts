import { GarageProcurementRequestsService } from './procurement-requests-garage.service';

describe('GarageProcurementRequestsService (facade)', () => {
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
          approvedAt: new Date('2026-11-08T01:00:00Z'),
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

    const approvers = { assertEligible: jest.fn() };
    const notifier = {
      afterTransition: jest.fn().mockResolvedValue(undefined),
    };

    const svc = new GarageProcurementRequestsService(
      command as never,
      query as never,
      rbac as never,
      { resolve: jest.fn().mockResolvedValue(new Map()) } as never,
      approvers as never,
      notifier as never,
      {} as never,
      {} as never,
    );
    const out = await svc.transition('h1', 'approve', 'boss');

    expect(rbac.getUserRoleNames).toHaveBeenCalledWith('boss');
    expect(command.transition).toHaveBeenCalledWith(
      'h1',
      'approve',
      { id: 'boss', roles: ['GIAM_DOC'] },
      undefined,
      null,
    );
    expect(out.status).toBe('APPROVED');
    expect(out.approval.approve?.by).toBe('boss');
    expect(notifier.afterTransition).toHaveBeenCalledWith(
      'approve',
      {},
      'boss',
      undefined,
    );
  });

  it('không gửi thông báo khi chuyển trạng thái thất bại', async () => {
    const command = {
      transition: jest.fn().mockRejectedValue(new Error('khóa')),
    };
    const notifier = { afterTransition: jest.fn() };
    const svc = new GarageProcurementRequestsService(
      command as never,
      { findOne: jest.fn() } as never,
      { getUserRoleNames: jest.fn().mockResolvedValue([]) } as never,
      { resolve: jest.fn() } as never,
      { assertEligible: jest.fn() } as never,
      notifier as never,
      {} as never,
      {} as never,
    );

    await expect(
      svc.transition('h1', 'submit', 'u1', undefined, 'a1'),
    ).rejects.toThrow('khóa');
    expect(notifier.afterTransition).not.toHaveBeenCalled();
  });
  describe('createAndSubmit / updateAndSubmit (orchestrator)', () => {
    const build = (flow: { saveAndSubmit: jest.Mock }) => {
      const notifier = {
        afterTransition: jest.fn().mockResolvedValue(undefined),
      };
      const approvers = {
        assertEligible: jest.fn().mockResolvedValue(undefined),
      };
      const svc = new GarageProcurementRequestsService(
        {} as never,
        {
          findOne: jest.fn().mockResolvedValue({
            header: {
              id: 'h9',
              requestNo: 'GDNM-9',
              status: 'PENDING_APPROVAL',
              orderingStatus: 'NONE',
              estimatedTotal: '0',
            },
            lines: [],
          }),
        } as never,
        { getUserRoleNames: jest.fn().mockResolvedValue(['NV']) } as never,
        { resolve: jest.fn().mockResolvedValue(new Map()) } as never,
        approvers as never,
        notifier as never,
        flow as never,
        { forRequests: jest.fn().mockResolvedValue(new Map()) } as never,
      );
      return { svc, notifier, approvers };
    };
    const lines = [{ lineType: 'GOODS', qtyRequested: 1 }];

    it('tạo + gửi duyệt qua flow một bước, rồi thông báo sau commit', async () => {
      const flow = {
        saveAndSubmit: jest.fn().mockResolvedValue({ id: 'h9' }),
      };
      const { svc, notifier, approvers } = build(flow);

      const out = await svc.createAndSubmit(
        { requestDate: '2026-11-11', lines, approverId: 'boss' } as never,
        'u1',
      );

      expect(approvers.assertEligible).toHaveBeenCalledWith(
        expect.anything(),
        'boss',
        'u1',
      );
      expect(flow.saveAndSubmit).toHaveBeenCalledWith(
        null,
        { header: { requestDate: '2026-11-11' }, lines },
        { id: 'u1', roles: ['NV'] },
        'boss',
      );
      expect(notifier.afterTransition).toHaveBeenCalledWith(
        'submit',
        { id: 'h9' },
        'u1',
        undefined,
      );
      expect(out.id).toBe('h9');
    });

    it('cập nhật nháp + gửi duyệt dùng id sẵn có', async () => {
      const flow = {
        saveAndSubmit: jest.fn().mockResolvedValue({ id: 'h9' }),
      };
      const { svc } = build(flow);

      await svc.updateAndSubmit('h9', { title: 'Mới', lines } as never, 'u1');

      expect(flow.saveAndSubmit).toHaveBeenCalledWith(
        'h9',
        { header: { title: 'Mới' }, lines },
        { id: 'u1', roles: ['NV'] },
        null,
      );
    });

    it('flow lỗi thì không gửi thông báo', async () => {
      const flow = {
        saveAndSubmit: jest
          .fn()
          .mockRejectedValue(new Error('thiếu người duyệt')),
      };
      const { svc, notifier } = build(flow);

      await expect(
        svc.createAndSubmit(
          { requestDate: '2026-11-11', lines } as never,
          'u1',
        ),
      ).rejects.toThrow('thiếu người duyệt');
      expect(notifier.afterTransition).not.toHaveBeenCalled();
    });
  });
});
