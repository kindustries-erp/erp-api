import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  PROCUREMENT_ORDER_STATUS,
  PROCUREMENT_ORDER_TRANSITIONS,
} from '../contracts/procurement-orders.contract';
import { resolveTransition } from '../../approval-core/approval.engine';
import {
  assertCanCancel,
  assertEditable,
  assertReadyToSubmit,
  fulfillmentStatusOf,
} from './procurement-order-engine.service';

describe('procurement-order engine', () => {
  it('confirm cũ bị loại: không issue được từ DRAFT, phải qua duyệt', () => {
    expect(() =>
      resolveTransition(PROCUREMENT_ORDER_TRANSITIONS, 'DRAFT', 'issue'),
    ).toThrow(ConflictException);
    expect(
      resolveTransition(PROCUREMENT_ORDER_TRANSITIONS, 'APPROVED', 'issue'),
    ).toBe('ISSUED');
  });

  it('fulfillmentStatusOf: NONE, PARTIAL, FULL, không lệch số thập phân', () => {
    expect(fulfillmentStatusOf([{ qtyOrdered: 5, qtyFulfilled: 0 }])).toBe(
      'NONE',
    );
    expect(fulfillmentStatusOf([{ qtyOrdered: 5, qtyFulfilled: 2 }])).toBe(
      'PARTIAL',
    );
    expect(
      fulfillmentStatusOf([{ qtyOrdered: 0.3, qtyFulfilled: 0.1 + 0.2 }]),
    ).toBe('FULL');
  });

  it('chỉ sửa khi DRAFT', () => {
    expect(() => assertEditable(PROCUREMENT_ORDER_STATUS.DRAFT)).not.toThrow();
    expect(() => assertEditable(PROCUREMENT_ORDER_STATUS.APPROVED)).toThrow(
      ConflictException,
    );
  });

  it('gửi duyệt cần NCC và đơn giá đủ', () => {
    expect(() => assertReadyToSubmit(null, [{ unitPrice: '10' }])).toThrow(
      BadRequestException,
    );
    expect(() => assertReadyToSubmit('s1', [])).toThrow(BadRequestException);
    expect(() => assertReadyToSubmit('s1', [{ unitPrice: null }])).toThrow(
      BadRequestException,
    );
    expect(() =>
      assertReadyToSubmit('s1', [{ unitPrice: '10' }]),
    ).not.toThrow();
  });

  it('không hủy được khi đã nhận hàng hoặc nghiệm thu', () => {
    expect(() => assertCanCancel([{ qtyOrdered: 5, qtyFulfilled: 1 }])).toThrow(
      ConflictException,
    );
    expect(() =>
      assertCanCancel([{ qtyOrdered: 5, qtyFulfilled: 0 }]),
    ).not.toThrow();
  });
});
