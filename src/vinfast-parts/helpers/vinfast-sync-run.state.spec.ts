import { VinfastSyncRunState } from './vinfast-sync-run.state';

describe('VinfastSyncRunState', () => {
  it('starts once and rejects a second start while running', () => {
    const state = new VinfastSyncRunState(
      () => new Date('2026-10-20T09:00:00Z'),
    );

    expect(state.start()).toBe(true);
    expect(state.start()).toBe(false);
    expect(state.snapshot().running).toBe(true);
    expect(state.snapshot().startedAt).toBe('2026-10-20T09:00:00.000Z');
  });

  it('applies progress events to phase, counters and message', () => {
    const state = new VinfastSyncRunState();
    state.start();

    state.applyProgress({
      processId: 'vinfast-sync',
      type: 'ledger',
      current: 200,
      total: 1000,
      message: 'Đang xử lý Sổ cái',
      completed: false,
    });

    expect(state.snapshot()).toMatchObject({
      phase: 'ledger',
      current: 200,
      total: 1000,
      message: 'Đang xử lý Sổ cái',
    });
  });

  it('marks the run finished and records an error when given one', () => {
    const state = new VinfastSyncRunState();
    state.start();

    state.finish('boom');

    expect(state.snapshot()).toMatchObject({
      running: false,
      lastError: 'boom',
    });
    expect(state.snapshot().finishedAt).not.toBeNull();
  });

  it('allows a new run after the previous one finished without error', () => {
    const state = new VinfastSyncRunState();
    state.start();
    state.finish();

    expect(state.snapshot()).toMatchObject({ running: false, lastError: null });
    expect(state.start()).toBe(true);
  });

  it('keeps a finished run snapshot independent from later changes', () => {
    const state = new VinfastSyncRunState();
    state.start();
    const before = state.snapshot();

    state.applyProgress({
      type: 'ledger',
      current: 5,
      total: 10,
      message: 'x',
      completed: false,
    });

    expect(before.current).toBe(0);
  });

  it('tracks the current invoice item and clears it when the run finishes', () => {
    const state = new VinfastSyncRunState();
    state.start();

    state.applyProgress({
      type: 'ledger',
      current: 200,
      total: 500,
      message: 'Đang xử lý Sổ cái: 200/500 dòng...',
      completed: false,
      currentItem: 'HĐ 1847 · C26MSP · ABC · 0001-XYZ',
    });
    expect(state.snapshot().currentItem).toBe(
      'HĐ 1847 · C26MSP · ABC · 0001-XYZ',
    );

    state.finish();
    expect(state.snapshot().currentItem).toBeNull();
  });
});
