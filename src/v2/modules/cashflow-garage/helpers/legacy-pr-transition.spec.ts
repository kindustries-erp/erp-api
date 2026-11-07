import { ConflictException } from '@nestjs/common';
import { planForecastPrTransition } from './legacy-pr-transition';

const open = { status: 'OPEN', closedAt: null };

describe('planForecastPrTransition', () => {
  it('nháp -> gửi duyệt -> duyệt: dự chi DRAFT -> PENDING_APPROVAL -> OPEN', () => {
    const submit = planForecastPrTransition(
      { status: 'DRAFT', closedAt: null },
      'submit',
    );
    expect(submit.next).toEqual({ status: 'PENDING_APPROVAL', closed: false });
    const approve = planForecastPrTransition(
      { status: 'PENDING_APPROVAL', closedAt: null },
      'approve',
    );
    expect(approve.next).toEqual({ status: 'OPEN', closed: false });
  });

  it('từ chối trả về nháp (DRAFT), không phải REJECTED', () => {
    const r = planForecastPrTransition(
      { status: 'PENDING_APPROVAL', closedAt: null },
      'reject',
    );
    expect(r.next.status).toBe('DRAFT');
  });

  it('thu hồi từ chờ duyệt về nháp', () => {
    const r = planForecastPrTransition(
      { status: 'PENDING_APPROVAL', closedAt: null },
      'recall',
    );
    expect(r.next.status).toBe('DRAFT');
  });

  it('Đóng PR đã duyệt: dự chi CANCELLED kèm dấu đóng', () => {
    const r = planForecastPrTransition(open, 'close');
    expect(r.to).toBe('CLOSED');
    expect(r.next).toEqual({ status: 'CANCELLED', closed: true });
  });

  it('Hủy PR đã duyệt: dự chi CANCELLED không dấu đóng', () => {
    const r = planForecastPrTransition(open, 'cancel');
    expect(r.next).toEqual({ status: 'CANCELLED', closed: false });
  });

  it('không được đóng nháp', () => {
    expect(() =>
      planForecastPrTransition({ status: 'DRAFT', closedAt: null }, 'close'),
    ).toThrow(ConflictException);
  });

  it('PR đã đóng không đổi được nữa', () => {
    expect(() =>
      planForecastPrTransition(
        { status: 'CANCELLED', closedAt: new Date() },
        'cancel',
      ),
    ).toThrow(ConflictException);
  });
});
