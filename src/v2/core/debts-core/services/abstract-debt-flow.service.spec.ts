import { DataSource, EntityManager } from 'typeorm';
import type {
  DebtFlowEvent,
  DebtFlowEventPort,
} from '../contracts/debts-core.contract';
import { AbstractDebtFlowService } from './abstract-debt-flow.service';

class TestFlow extends AbstractDebtFlowService {
  constructor(
    protected readonly dataSource: DataSource,
    protected readonly events: DebtFlowEventPort,
  ) {
    super();
  }

  run<T>(
    work: (
      manager: EntityManager,
      emit: (e: DebtFlowEvent) => void,
    ) => Promise<T>,
  ) {
    return this.runInTransaction(work);
  }
}

const event: DebtFlowEvent = {
  type: 'DONE',
  documentType: 'DOC',
  documentId: 'd1',
};

function setup(publish = jest.fn().mockResolvedValue(undefined)) {
  const manager = {} as EntityManager;
  const dataSource = {
    transaction: jest.fn((cb: (m: EntityManager) => Promise<unknown>) =>
      cb(manager),
    ),
  } as unknown as DataSource;
  return { flow: new TestFlow(dataSource, { publish }), publish, dataSource };
}

describe('AbstractDebtFlowService', () => {
  it('phát sự kiện sau khi commit', async () => {
    const { flow, publish } = setup();
    const out = await flow.run(async (_m, emit) => {
      emit(event);
      expect(publish).not.toHaveBeenCalled();
      return 'ok';
    });
    expect(out).toBe('ok');
    expect(publish).toHaveBeenCalledWith(event);
  });

  it('rollback thì không phát sự kiện nào', async () => {
    const { flow, publish } = setup();
    await expect(
      flow.run(async (_m, emit) => {
        emit(event);
        throw new Error('lỗi bước giữa');
      }),
    ).rejects.toThrow('lỗi bước giữa');
    expect(publish).not.toHaveBeenCalled();
  });

  it('lỗi phát sự kiện chỉ ghi log, kết quả đã commit vẫn trả về', async () => {
    const { flow } = setup(jest.fn().mockRejectedValue(new Error('hết hạn')));
    await expect(
      flow.run(async (_m, emit) => {
        emit(event);
        return 'ok';
      }),
    ).resolves.toBe('ok');
  });
});
