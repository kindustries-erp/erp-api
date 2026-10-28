import { VinfastPartsService } from './vinfast-parts.service';

describe('VinfastPartsService.runFullSync', () => {
  it('starts one run and reports started=false while it is still running', async () => {
    const syncService: any = {
      syncCatalog: jest.fn(() => new Promise(() => undefined)),
      syncLedger: jest.fn(),
    };
    const service = new VinfastPartsService(
      syncService,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const first = service.runFullSync({});
    const second = service.runFullSync({});

    expect(first.started).toBe(true);
    expect(second.started).toBe(false);
    expect(second.state.running).toBe(true);
    expect(service.getSyncState().running).toBe(true);
  });

  it('records the error and releases the lock when a run fails', async () => {
    const syncService: any = {
      syncCatalog: jest.fn().mockRejectedValue(new Error('boom')),
      syncLedger: jest.fn(),
    };
    const service = new VinfastPartsService(
      syncService,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    service.runFullSync({});
    await new Promise((r) => setImmediate(r));

    expect(service.getSyncState()).toMatchObject({
      running: false,
      lastError: 'boom',
    });
    expect(service.runFullSync({}).started).toBe(true);
  });
});
