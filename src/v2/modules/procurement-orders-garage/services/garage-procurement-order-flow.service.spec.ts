import type { DataSource, EntityManager } from 'typeorm';
import { GarageProcurementOrderFlowService } from './garage-procurement-order-flow.service';

function setup() {
  const manager = {} as EntityManager;
  const dataSource = {
    transaction: jest.fn((work: (m: EntityManager) => Promise<unknown>) =>
      work(manager),
    ),
  } as unknown as DataSource;
  const command = {
    createDraft: jest.fn().mockResolvedValue({ id: 'o1' }),
    updateHeader: jest.fn().mockResolvedValue(undefined),
    replaceDraftLines: jest.fn().mockResolvedValue(undefined),
    transition: jest.fn().mockResolvedValue({ id: 'o1' }),
  };
  const flow = new GarageProcurementOrderFlowService(
    dataSource,
    command as never,
  );
  return { flow, command, manager, dataSource };
}

const actor = { id: 'u1', roles: [] };
const input = { header: { orderDate: '2026-11-11' }, lines: [] } as never;

describe('GarageProcurementOrderFlowService.saveAndSubmit', () => {
  it('tạo mới: createDraft rồi submit cùng một manager trong một transaction', async () => {
    const { flow, command, manager, dataSource } = setup();
    await flow.saveAndSubmit(null, input, actor, 'ap1');
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(command.createDraft).toHaveBeenCalledWith(
      actor,
      expect.anything(),
      [],
      manager,
    );
    expect(command.transition).toHaveBeenCalledWith(
      'o1',
      'submit',
      actor,
      undefined,
      'ap1',
      manager,
    );
  });

  it('cập nhật: updateHeader + replaceDraftLines rồi submit đúng id', async () => {
    const { flow, command, manager } = setup();
    await flow.saveAndSubmit('o9', input, actor, null);
    expect(command.updateHeader).toHaveBeenCalledWith(
      'o9',
      expect.anything(),
      manager,
    );
    expect(command.replaceDraftLines).toHaveBeenCalledWith('o9', [], manager);
    expect(command.createDraft).not.toHaveBeenCalled();
    expect(command.transition).toHaveBeenCalledWith(
      'o9',
      'submit',
      actor,
      undefined,
      null,
      manager,
    );
  });

  it('submit lỗi thì lỗi nổi lên (transaction rollback)', async () => {
    const { flow, command } = setup();
    command.transition.mockRejectedValueOnce(new Error('thiếu NCC'));
    await expect(flow.saveAndSubmit(null, input, actor, null)).rejects.toThrow(
      'thiếu NCC',
    );
  });
});
