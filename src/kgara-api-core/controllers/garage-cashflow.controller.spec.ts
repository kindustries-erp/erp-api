import { GarageCashflowController } from './garage-cashflow.controller';

describe('GarageCashflowController (Pattern A Sub-Controller)', () => {
  let controller: GarageCashflowController;
  let mockCashflowService: any;

  beforeEach(() => {
    mockCashflowService = {
      listCashflow: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      getColumnOptions: jest.fn().mockResolvedValue({ settlementTypes: [] }),
      createCashflow: jest.fn().mockResolvedValue({ id: 'new-id' }),
      updateCashflow: jest.fn().mockResolvedValue({ id: 'updated-id' }),
      deleteCashflow: jest.fn().mockResolvedValue({ success: true }),
    };

    controller = new GarageCashflowController(mockCashflowService);
  });

  it('delegates listCashflow to service', async () => {
    const query = { page: 1, pageSize: 20 };
    await controller.listCashflow(query);
    expect(mockCashflowService.listCashflow).toHaveBeenCalledWith(query);
  });

  it('delegates getColumnOptions to service', async () => {
    const query = { column: 'partnerName' };
    await controller.getColumnOptions(query as any);
    expect(mockCashflowService.getColumnOptions).toHaveBeenCalledWith(query);
  });

  it('delegates createCashflow to service', async () => {
    const body: any = {
      settlementType: 'RECEIPT',
      amount: 1000000,
      transDate: '2026-10-08',
    };
    await controller.createCashflow(body);
    expect(mockCashflowService.createCashflow).toHaveBeenCalledWith(body);
  });

  it('delegates updateCashflow to service', async () => {
    const body: any = { amount: 2000000 };
    await controller.updateCashflow('id-1', body);
    expect(mockCashflowService.updateCashflow).toHaveBeenCalledWith(
      'id-1',
      body,
    );
  });

  it('delegates deleteCashflow to service', async () => {
    await controller.deleteCashflow('id-1');
    expect(mockCashflowService.deleteCashflow).toHaveBeenCalledWith('id-1');
  });
});
