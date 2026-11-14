import {
  NotifiableRequest,
  PROCUREMENT_REQUEST_GARAGE_TARGET,
  ProcurementRequestNotifierService,
} from './procurement-request-notifier.service';

const CREATOR = 'creator-1';
const APPROVER = 'approver-1';
const OTHER = 'other-1';

function header(over: Partial<NotifiableRequest> = {}): NotifiableRequest {
  return {
    id: 'req-1',
    requestNo: 'GDNM-0001',
    title: 'Mua lốp',
    status: 'PENDING_APPROVAL',
    createdBy: CREATOR,
    approverId: APPROVER,
    ...over,
  };
}

describe('ProcurementRequestNotifierService', () => {
  let publisher: { createForUser: jest.Mock };
  let service: ProcurementRequestNotifierService;

  beforeEach(() => {
    publisher = { createForUser: jest.fn().mockResolvedValue(undefined) };
    service = new ProcurementRequestNotifierService(publisher as never);
  });

  it('gửi duyệt có người duyệt: báo đúng người duyệt, bấm vào mở modal duyệt (AC-1)', async () => {
    await service.afterTransition('submit', header(), CREATOR);

    expect(publisher.createForUser).toHaveBeenCalledTimes(1);
    const [userId, payload] = publisher.createForUser.mock.calls[0];
    expect(userId).toBe(APPROVER);
    expect(payload.type).toBe('INFO');
    expect(payload.message).toContain('GDNM-0001');
    expect(payload.target).toEqual({
      module: PROCUREMENT_REQUEST_GARAGE_TARGET,
      id: 'req-1',
      action: 'APPROVE',
    });
  });

  it('gửi duyệt khi khóa tắt (đã APPROVED) hoặc không có người duyệt: không gửi (AC-2)', async () => {
    await service.afterTransition(
      'submit',
      header({ status: 'APPROVED', approverId: null }),
      CREATOR,
    );
    await service.afterTransition(
      'submit',
      header({ approverId: null }),
      CREATOR,
    );

    expect(publisher.createForUser).not.toHaveBeenCalled();
  });

  it('không báo người gửi nếu tự chọn chính mình làm người duyệt (AC-2)', async () => {
    await service.afterTransition(
      'submit',
      header({ approverId: CREATOR }),
      CREATOR,
    );

    expect(publisher.createForUser).not.toHaveBeenCalled();
  });

  it('duyệt: báo người tạo phiếu, loại SUCCESS, bấm vào xem phiếu (AC-3)', async () => {
    await service.afterTransition(
      'approve',
      header({ status: 'APPROVED' }),
      APPROVER,
    );

    const [userId, payload] = publisher.createForUser.mock.calls[0];
    expect(userId).toBe(CREATOR);
    expect(payload.type).toBe('SUCCESS');
    expect(payload.target.action).toBe('VIEW');
  });

  it('từ chối: báo người tạo kèm lý do, loại WARNING (AC-3)', async () => {
    await service.afterTransition(
      'reject',
      header({ status: 'DRAFT', approverId: null }),
      APPROVER,
      'Thiếu báo giá',
    );

    const [userId, payload] = publisher.createForUser.mock.calls[0];
    expect(userId).toBe(CREATOR);
    expect(payload.type).toBe('WARNING');
    expect(payload.message).toContain('Thiếu báo giá');
  });

  it('người thao tác trùng người nhận thì không gửi (AC-3)', async () => {
    await service.afterTransition('approve', header(), CREATOR);

    expect(publisher.createForUser).not.toHaveBeenCalled();
  });

  it('hành động khác (thu hồi, hủy, đóng) không gửi thông báo', async () => {
    await service.afterTransition('recall', header(), CREATOR);
    await service.afterTransition('cancel', header(), OTHER, 'hủy');

    expect(publisher.createForUser).not.toHaveBeenCalled();
  });

  it('lỗi từ publisher không ném ra ngoài (AC-2)', async () => {
    publisher.createForUser.mockRejectedValue(new Error('db down'));

    await expect(
      service.afterTransition('submit', header(), CREATOR),
    ).resolves.toBeUndefined();
  });
});
