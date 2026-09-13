import { NotFoundException } from '@nestjs/common';

import {
  VinfastPartsExportBackgroundService,
  type VinfastPartsExportQuery,
} from './vinfast-parts-export-background.service';

describe('VinfastPartsExportBackgroundService', () => {
  let service: VinfastPartsExportBackgroundService;

  beforeEach(() => {
    service = new VinfastPartsExportBackgroundService();
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  async function flushMicrotasks() {
    await Promise.resolve();
    await Promise.resolve();
  }

  it('creates and completes a background export job, then exposes downloadable file', async () => {
    const query: VinfastPartsExportQuery = {
      dateFrom: '2026-07-01',
      dateTo: '2026-07-31',
      search: 'filter-keyword',
    };

    const start = await service.startBackgroundExport(
      query,
      'user-1',
      async (onProgress) => {
        onProgress(20, 100, 'Dang tai du lieu...');
        onProgress(80, 100, 'Dang tao file...');
        return Buffer.from('xlsx-binary');
      },
    );

    expect(start.jobId).toBeTruthy();
    expect(start.reused).toBe(false);

    await flushMicrotasks();

    const history = service.listHistoryForUser('user-1', 1, 10);
    expect(history.total).toBe(1);
    expect(history.items[0].status).toBe('COMPLETED');
    expect(history.items[0].canDownload).toBe(true);

    const ready = service.getReadyExportFile(start.jobId, 'user-1');
    expect(ready.fileName).toContain('Bao_cao_phu_tung_VINFAST_');
    expect(ready.buffer.toString()).toBe('xlsx-binary');
  });

  it('reuses completed job for same user and same query fingerprint', async () => {
    const query: VinfastPartsExportQuery = {
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
      columnFilters: JSON.stringify({ vehicleType: ['CAR'] }),
    };

    const first = await service.startBackgroundExport(
      query,
      'user-2',
      async () => Buffer.from('file-1'),
    );

    await flushMicrotasks();

    const reused = await service.startBackgroundExport(
      query,
      'user-2',
      async () => Buffer.from('file-2-should-not-run'),
    );

    expect(reused.jobId).toBe(first.jobId);
    expect(reused.reused).toBe(true);
  });

  it('blocks second start request while same user already has running job', async () => {
    let resolveJob: (value: Buffer) => void = () => undefined;
    const pending = new Promise<Buffer>((resolve) => {
      resolveJob = resolve;
    });

    const first = await service.startBackgroundExport(
      { dateFrom: '2026-09-01', dateTo: '2026-09-30' },
      'user-3',
      async () => pending,
    );

    const second = await service.startBackgroundExport(
      { dateFrom: '2026-09-01', dateTo: '2026-09-30' },
      'user-3',
      async () => Buffer.from('should-not-run'),
    );

    expect(second.jobId).toBe(first.jobId);
    expect(second.reused).toBe(false);
    expect(second.message).toContain('Đang có một tiến trình');

    resolveJob(Buffer.from('done'));
    await flushMicrotasks();
  });

  it('denies download when requesting user does not own the job', async () => {
    const start = await service.startBackgroundExport(
      { dateFrom: '2026-10-01', dateTo: '2026-10-31' },
      'owner-user',
      async () => Buffer.from('secret-file'),
    );

    await flushMicrotasks();

    expect(() => service.getReadyExportFile(start.jobId, 'other-user')).toThrow(
      NotFoundException,
    );
  });
});
