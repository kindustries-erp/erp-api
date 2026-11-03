import { BadRequestException } from '@nestjs/common';
import { InvoiceBranchService } from './invoice-branch.service';

describe('InvoiceBranchService', () => {
  let manager: any;
  let accounting: any;
  let service: InvoiceBranchService;

  const invoice = (over: Record<string, unknown> = {}) => ({
    id: 'inv-1',
    direction: 'IN',
    postingStatus: 'UNPOSTED',
    branchIds: [],
    branchId: null,
    ...over,
  });

  beforeEach(() => {
    manager = {
      find: jest.fn().mockResolvedValue([invoice()]),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      query: jest.fn().mockResolvedValue([{ id: 'b1' }]),
    };
    accounting = {
      reallocateJournalEntriesBySource: jest.fn().mockResolvedValue(null),
    };
    const dataSource = { transaction: jest.fn((run: any) => run(manager)) };
    service = new InvoiceBranchService(
      {} as any,
      accounting,
      dataSource as any,
    );
  });

  it('writes both branch columns in sync', async () => {
    manager.query.mockResolvedValueOnce([{ id: 'b1' }, { id: 'b2' }]);

    await service.assign(['inv-1'], ['b1', 'b2', 'b1']);

    expect(manager.update).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'inv-1' },
      {
        branchIds: ['b1', 'b2'],
        branchId: 'b1',
      },
    );
  });

  it('rejects a branch that is missing or inactive, and writes nothing', async () => {
    manager.query.mockResolvedValueOnce([]);

    await expect(service.assign(['inv-1'], ['b1'])).rejects.toThrow(
      new BadRequestException('Có chi nhánh không tồn tại.'),
    );
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('reallocates posted invoices inside the same transaction manager', async () => {
    manager.find.mockResolvedValue([
      invoice({ postingStatus: 'POSTED', branchIds: ['b1'], branchId: 'b1' }),
    ]);

    await service.assign(['inv-1'], ['b2']);

    expect(accounting.reallocateJournalEntriesBySource).toHaveBeenCalledWith(
      'inv-1',
      'INVOICE',
      ['b2'],
      'HĐM',
      manager,
    );
  });

  it('propagates a reallocation failure so the whole transaction rolls back', async () => {
    manager.find.mockResolvedValue([invoice({ postingStatus: 'POSTED' })]);
    accounting.reallocateJournalEntriesBySource.mockRejectedValue(
      new Error('je failed'),
    );

    await expect(service.assign(['inv-1'], ['b1'])).rejects.toThrow(
      'je failed',
    );
  });

  it('skips invoices whose branches did not change', async () => {
    manager.find.mockResolvedValue([
      invoice({ branchIds: ['b1'], branchId: 'b1' }),
    ]);

    const result = await service.assign(['inv-1'], ['b1']);

    expect(manager.update).not.toHaveBeenCalled();
    expect(result).toEqual({ updated: [], skipped: ['inv-1'] });
  });

  it('with onlyIfUnassigned keeps invoices that already have a branch', async () => {
    manager.find.mockResolvedValue([
      invoice({ branchIds: ['b1'], branchId: 'b1' }),
      invoice({ id: 'inv-2' }),
    ]);

    const result = await service.assign(['inv-1', 'inv-2'], ['b2'], {
      onlyIfUnassigned: true,
    });

    expect(result).toEqual({ updated: ['inv-2'], skipped: ['inv-1'] });
  });

  it('does nothing for an empty id list', async () => {
    expect(await service.assign([], ['b1'])).toEqual({
      updated: [],
      skipped: [],
    });
    expect(manager.find).not.toHaveBeenCalled();
  });
});
