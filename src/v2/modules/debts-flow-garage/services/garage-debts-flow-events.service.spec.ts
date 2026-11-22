import { GarageDebtsFlowEventsService } from './garage-debts-flow-events.service';

describe('GarageDebtsFlowEventsService', () => {
  const event = (payload?: Record<string, unknown>) => ({
    type: 'GARAGE_VOUCHER_CHANGED',
    documentType: 'X',
    documentId: 'v1',
    payload,
  });

  it('đặt lại dự thu cho từng vụ việc bị ảnh hưởng, mỗi vụ một lần', async () => {
    const hub = { handleCaseReceiptChanged: jest.fn().mockResolvedValue({}) };
    await new GarageDebtsFlowEventsService(hub as never).publish(
      event({ caseIds: ['a', 'b', 'a', 7] }),
    );
    expect(hub.handleCaseReceiptChanged.mock.calls).toEqual([['a'], ['b']]);
  });

  it('không có caseIds thì không làm gì', async () => {
    const hub = { handleCaseReceiptChanged: jest.fn() };
    const svc = new GarageDebtsFlowEventsService(hub as never);
    await svc.publish(event());
    await svc.publish(event({ caseIds: 'x' }));
    expect(hub.handleCaseReceiptChanged).not.toHaveBeenCalled();
  });
});
