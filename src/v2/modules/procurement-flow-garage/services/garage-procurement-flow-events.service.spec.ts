import { GarageProcurementFlowEventsService } from './garage-procurement-flow-events.service';

function setup(order: unknown) {
  const createForUser = jest.fn().mockResolvedValue(undefined);
  const dataSource = {
    getRepository: () => ({ findOne: jest.fn().mockResolvedValue(order) }),
  };
  const svc = new GarageProcurementFlowEventsService(
    dataSource as never,
    { createForUser } as never,
  );
  return { svc, createForUser };
}

const base = {
  documentType: 'GOODS_RECEIPT_GARAGE',
  documentId: 'r1',
  actorId: 'receiver',
  payload: { orderId: 'o1' },
};

describe('GarageProcurementFlowEventsService', () => {
  it('báo người tạo đơn mua khi phiếu nhập được ghi sổ', async () => {
    const { svc, createForUser } = setup({
      id: 'o1',
      orderNo: 'PO-1',
      createdBy: 'creator',
    });
    await svc.publish({ ...base, type: 'GOODS_RECEIPT_POSTED' });
    expect(createForUser).toHaveBeenCalledWith(
      'creator',
      expect.objectContaining({
        target: expect.objectContaining({
          module: 'PROCUREMENT_ORDER_GARAGE',
          id: 'o1',
        }),
      }),
    );
  });

  it('không tự báo cho chính người thao tác', async () => {
    const { svc, createForUser } = setup({
      id: 'o1',
      orderNo: 'PO-1',
      createdBy: 'receiver',
    });
    await svc.publish({ ...base, type: 'GOODS_RECEIPT_POSTED' });
    expect(createForUser).not.toHaveBeenCalled();
  });

  it('bỏ qua sự kiện lạ hoặc không có đơn mua', async () => {
    const { svc, createForUser } = setup(null);
    await svc.publish({ ...base, type: 'OTHER' });
    await svc.publish({
      ...base,
      type: 'GOODS_RECEIPT_POSTED',
      payload: { orderId: null },
    });
    await svc.publish({ ...base, type: 'GOODS_RECEIPT_CANCELLED' });
    expect(createForUser).not.toHaveBeenCalled();
  });
});
