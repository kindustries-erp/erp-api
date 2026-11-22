import { ConflictException, NotFoundException } from '@nestjs/common';
import { BaseProcurementOrderEntity } from '../entities/base-procurement-order.entity';
import { BaseProcurementOrderLineEntity } from '../entities/base-procurement-order-line.entity';
import { BaseProcurementOrderAcceptanceEntity } from '../entities/base-procurement-order-acceptance.entity';
import { AbstractProcurementOrderFulfilmentService } from './abstract-procurement-order-fulfilment.service';

class Header extends BaseProcurementOrderEntity {}
class Line extends BaseProcurementOrderLineEntity {
  orderId!: string;
}
class Acc extends BaseProcurementOrderAcceptanceEntity {}

class Svc extends AbstractProcurementOrderFulfilmentService<Header, Line, Acc> {
  protected readonly headerEntity = Header;
  protected readonly lineEntity = Line;
  protected readonly acceptanceEntity = Acc;
  protected readonly lineForeignKey = 'orderId' as const;
  protected acceptanceForeignKey(): string {
    return 'orderId';
  }
}

function header(over: Partial<Header> = {}): Header {
  return Object.assign(new Header(), {
    id: 'o1',
    status: 'ISSUED',
    fulfillmentStatus: 'NONE',
    isDeleted: false,
    closeReason: null,
    closedAt: null,
    ...over,
  });
}
function line(over: Partial<Line>): Line {
  return Object.assign(new Line(), {
    id: 'l1',
    orderId: 'o1',
    lineType: 'GOODS',
    qtyOrdered: '10',
    qtyFulfilled: '0',
    ...over,
  });
}

function manager(h: Header | null, lines: Line[], acc?: Acc | null) {
  const saved: unknown[] = [];
  const m = {
    findOne: jest.fn(async (target: unknown) =>
      target === Acc ? (acc ?? null) : h,
    ),
    find: jest.fn().mockResolvedValue(lines),
    save: jest.fn(async (_t: unknown, v: unknown) => {
      saved.push(v);
      return v;
    }),
    create: jest.fn((_t: unknown, v: unknown) => v),
  };
  return { m, saved };
}

describe('AbstractProcurementOrderFulfilmentService', () => {
  it('nhập kho dòng GOODS đủ thì PO tự CLOSED', async () => {
    const h = header();
    const { m, saved } = manager(h, [
      line({ qtyOrdered: '10', qtyFulfilled: '4' }),
    ]);
    await new Svc({} as never).applyGoodsReceipt(m as never, 'o1', [
      { orderLineId: 'l1', qty: 6 },
    ]);
    const out = saved.find((v) => v instanceof Header) as Header;
    expect(out.fulfillmentStatus).toBe('FULL');
    expect(out.status).toBe('CLOSED');
    expect(out.closeReason).toBeNull();
  });

  it('hoàn nhận hàng trừ số đã nhận, đơn tự đóng được mở lại', async () => {
    const l = line({ qtyOrdered: '10', qtyFulfilled: '10' });
    const h = header({
      status: 'CLOSED',
      closeReason: null,
      closedAt: new Date(),
    });
    const { m } = manager(h, [l]);
    await new Svc({} as never).revertGoodsReceipt(m as never, 'o1', [
      { orderLineId: 'l1', qty: 4 },
    ]);
    expect(l.qtyFulfilled).toBe('6');
    expect(h.status).toBe('ISSUED');
  });

  it('không hoàn quá số đã nhận hoặc khi đơn đã hủy', async () => {
    const l = line({ qtyOrdered: '10', qtyFulfilled: '2' });
    const { m } = manager(header(), [l]);
    await expect(
      new Svc({} as never).revertGoodsReceipt(m as never, 'o1', [
        { orderLineId: 'l1', qty: 3 },
      ]),
    ).rejects.toThrow(ConflictException);

    const cancelled = manager(header({ status: 'CANCELLED' }), [l]);
    await expect(
      new Svc({} as never).revertGoodsReceipt(cancelled.m as never, 'o1', [
        { orderLineId: 'l1', qty: 1 },
      ]),
    ).rejects.toThrow(ConflictException);
  });

  it('nhập kho dòng SERVICE bị từ chối', async () => {
    const { m } = manager(header(), [line({ lineType: 'SERVICE' })]);
    await expect(
      new Svc({} as never).applyGoodsReceipt(m as never, 'o1', [
        { orderLineId: 'l1', qty: 1 },
      ]),
    ).rejects.toThrow(ConflictException);
  });

  it('nghiệm thu dòng GOODS bị từ chối', async () => {
    const { m } = manager(header(), [line({ lineType: 'GOODS' })]);
    await expect(
      new Svc({} as never).accept(m as never, 'o1', 'boss', [
        { orderLineId: 'l1', qty: 1 },
      ]),
    ).rejects.toThrow(ConflictException);
  });

  it('nghiệm thu vượt phần còn lại bị từ chối, nghiệm thu đủ thì đóng', async () => {
    const { m: m1 } = manager(header(), [
      line({ lineType: 'SERVICE', qtyOrdered: '2', qtyFulfilled: '0' }),
    ]);
    await expect(
      new Svc({} as never).accept(m1 as never, 'o1', 'boss', [
        { orderLineId: 'l1', qty: 3 },
      ]),
    ).rejects.toThrow(ConflictException);

    const { m, saved } = manager(header(), [
      line({ lineType: 'SERVICE', qtyOrdered: '2', qtyFulfilled: '0' }),
    ]);
    await new Svc({} as never).accept(m as never, 'o1', 'boss', [
      { orderLineId: 'l1', qty: 2, note: 'đạt' },
    ]);
    const out = saved.find((v) => v instanceof Header) as Header;
    expect(out.status).toBe('CLOSED');
  });

  it('không giao nhận khi đơn chưa phát hành', async () => {
    const { m } = manager(header({ status: 'APPROVED' }), [line({})]);
    await expect(
      new Svc({} as never).applyGoodsReceipt(m as never, 'o1', [
        { orderLineId: 'l1', qty: 1 },
      ]),
    ).rejects.toThrow(ConflictException);
  });

  it('hủy nghiệm thu bắt buộc lý do, trừ lại số lượng và mở lại đơn đã tự đóng', async () => {
    const acc = Object.assign(new Acc(), {
      id: 'a1',
      orderId: 'o1',
      orderLineId: 'l1',
      qty: '2',
      isVoided: false,
    });
    const closed = header({
      status: 'CLOSED',
      fulfillmentStatus: 'FULL',
      closeReason: null,
    });
    const { m, saved } = manager(
      closed,
      [line({ lineType: 'SERVICE', qtyOrdered: '2', qtyFulfilled: '2' })],
      acc,
    );

    await expect(
      new Svc({} as never).voidAcceptance(m as never, 'o1', 'a1', 'boss', '  '),
    ).rejects.toThrow();

    await new Svc({} as never).voidAcceptance(
      m as never,
      'o1',
      'a1',
      'boss',
      'nhập sai',
    );
    expect(acc.isVoided).toBe(true);
    expect(acc.voidReason).toBe('nhập sai');
    const out = saved.find((v) => v instanceof Header) as Header;
    expect(out.status).toBe('ISSUED');
    expect(out.fulfillmentStatus).toBe('NONE');
  });

  it('hủy nghiệm thu không tồn tại thì báo 404', async () => {
    const { m } = manager(header(), [line({})], null);
    await expect(
      new Svc({} as never).voidAcceptance(
        m as never,
        'o1',
        'zz',
        'boss',
        'lý do',
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
