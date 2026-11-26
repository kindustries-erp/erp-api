import { KgaraReportsController } from './kgara-reports.controller';

describe('KgaraReportsController', () => {
  const receivableRepo = { find: jest.fn().mockResolvedValue([]) };
  const payableRepo = { find: jest.fn().mockResolvedValue([]) };
  const client = {
    getDashboard: jest.fn().mockResolvedValue({ ok: true }),
  };
  const controller = new KgaraReportsController(
    receivableRepo as any,
    payableRepo as any,
    {} as any,
    client as any,
  );

  beforeEach(() => jest.clearAllMocks());

  it('receivables/payables đọc DB, không lọc theo chi nhánh KGara', async () => {
    await controller.getReceivables();
    await controller.getPayables();

    expect(receivableRepo.find).toHaveBeenCalledWith({
      order: { updatedAt: 'DESC' },
    });
    expect(payableRepo.find).toHaveBeenCalledWith({
      order: { updatedAt: 'DESC' },
    });
  });

  it('dashboard gọi thẳng KGara nên vẫn cần chi nhánh KGara', async () => {
    const missing = await controller.getDashboard(undefined as any);
    expect(missing).toMatchObject({ success: false });
    expect(client.getDashboard).not.toHaveBeenCalled();

    await controller.getDashboard('br-1', '2026-11-01', '2026-11-25');
    expect(client.getDashboard).toHaveBeenCalledWith(
      'br-1',
      '2026-11-01',
      '2026-11-25',
    );
  });
});
