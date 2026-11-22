import { DataSource, EntityManager } from 'typeorm';
import type {
  ProcurementFlowEvent,
  ProcurementFlowEventPort,
  SaveAndActPort,
} from '../contracts/procurement-flow-core.contract';
import { AbstractTransactionalFlow } from './abstract-transactional-flow.service';

class TestFlow extends AbstractTransactionalFlow {
  constructor(
    protected readonly dataSource: DataSource,
    protected readonly events: ProcurementFlowEventPort,
  ) {
    super();
  }

  run<TInput, TDoc>(
    port: SaveAndActPort<TInput, TDoc>,
    id: string | null,
    input: TInput,
  ) {
    return this.saveAndAct(port, id, input);
  }
}

const event: ProcurementFlowEvent = {
  type: 'X',
  documentType: 'DOC',
  documentId: 'd1',
};

/** DataSource giả: ghi lại thứ tự commit/rollback để kiểm tra transaction duy nhất. */
function setup() {
  const log: string[] = [];
  const manager = {} as EntityManager;
  const dataSource = {
    transaction: async (work: (m: EntityManager) => Promise<unknown>) => {
      log.push('begin');
      try {
        const result = await work(manager);
        log.push('commit');
        return result;
      } catch (error) {
        log.push('rollback');
        throw error;
      }
    },
  } as unknown as DataSource;
  const events: ProcurementFlowEventPort = {
    publish: (e) => {
      log.push(`publish:${e.type}`);
      return Promise.resolve();
    },
  };
  return { log, manager, flow: new TestFlow(dataSource, events) };
}

describe('AbstractTransactionalFlow.saveAndAct', () => {
  it('lưu rồi hành động trong MỘT transaction, phát sự kiện sau commit', async () => {
    const { flow, log, manager } = setup();
    const port: SaveAndActPort<{ n: number }, string> = {
      save: (m, id, input) => {
        expect(m).toBe(manager);
        log.push(`save:${id}:${input.n}`);
        return Promise.resolve({ id: 'new-1' });
      },
      act: (m, emit, id) => {
        expect(m).toBe(manager);
        log.push(`act:${id}`);
        emit(event);
        return Promise.resolve('done');
      },
    };

    await expect(flow.run(port, null, { n: 1 })).resolves.toBe('done');
    expect(log).toEqual([
      'begin',
      'save:null:1',
      'act:new-1',
      'commit',
      'publish:X',
    ]);
  });

  it('lỗi ở act thì rollback, không phát sự kiện', async () => {
    const { flow, log } = setup();
    const port: SaveAndActPort<object, string> = {
      save: () => Promise.resolve({ id: 'p1' }),
      act: (_m, emit) => {
        emit(event);
        return Promise.reject(new Error('submit lỗi'));
      },
    };

    await expect(flow.run(port, 'p1', {})).rejects.toThrow('submit lỗi');
    expect(log).toEqual(['begin', 'rollback']);
  });

  it('lỗi ở save thì không chạy act', async () => {
    const { flow, log } = setup();
    let acted = false;
    const port: SaveAndActPort<object, string> = {
      save: () => Promise.reject(new Error('save lỗi')),
      act: () => {
        acted = true;
        return Promise.resolve('x');
      },
    };

    await expect(flow.run(port, null, {})).rejects.toThrow('save lỗi');
    expect(acted).toBe(false);
    expect(log).toEqual(['begin', 'rollback']);
  });
});
