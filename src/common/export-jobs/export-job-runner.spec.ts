import { BadRequestException, NotFoundException } from '@nestjs/common';

import {
  ExportJobRunner,
  ExportProgressEvent,
  normalizeJsonString,
  stableStringify,
} from './export-job-runner';

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('ExportJobRunner', () => {
  let runner: ExportJobRunner;

  beforeEach(() => {
    runner = new ExportJobRunner({ processId: 'test-export' });
  });

  afterEach(() => runner.destroy());

  const baseInput = (overrides: Record<string, unknown> = {}) => ({
    userId: 'u1',
    fingerprint: 'fp-1',
    fileName: 'a.xlsx',
    totalUnits: 100,
    producer: jest.fn().mockResolvedValue(Buffer.from('xlsx')),
    ...overrides,
  });

  it('chạy job, phát tiến độ và cho tải file khi hoàn tất', async () => {
    const events: ExportProgressEvent[] = [];
    runner.progress$.subscribe((e) => events.push(e));
    const producer = jest.fn(async (onProgress) => {
      onProgress(50, 100, 'nửa chừng');
      return Buffer.from('xlsx');
    });

    const result = runner.start(baseInput({ producer }));
    expect(result.reused).toBe(false);
    await flush();

    expect(events[0]).toMatchObject({
      processId: 'test-export',
      isRunning: true,
    });
    expect(
      events.some((e) => e.current === 50 && e.message === 'nửa chừng'),
    ).toBe(true);
    expect(events[events.length - 1]).toMatchObject({
      completed: true,
      ready: true,
    });

    const file = runner.getReadyFile(result.jobId, 'u1');
    expect(file.buffer.toString()).toBe('xlsx');
    expect(file.fileName).toBe('a.xlsx');
  });

  it('chỉ cho 1 job RUNNING mỗi user', async () => {
    let release!: (b: Buffer) => void;
    const slow = jest.fn(() => new Promise<Buffer>((r) => (release = r)));

    const first = runner.start(baseInput({ producer: slow }));
    const second = runner.start(baseInput({ fingerprint: 'fp-2' }));

    expect(second.jobId).toBe(first.jobId);
    expect(slow).toHaveBeenCalledTimes(1);
    expect(() => runner.getReadyFile(first.jobId, 'u1')).toThrow(
      BadRequestException,
    );

    release(Buffer.from('x'));
    await flush();
  });

  it('tái sử dụng file đã hoàn tất khi fingerprint trùng', async () => {
    const first = runner.start(baseInput());
    await flush();

    const again = runner.start(baseInput());
    expect(again).toMatchObject({ jobId: first.jobId, reused: true });

    const other = runner.start(baseInput({ fingerprint: 'fp-other' }));
    expect(other.jobId).not.toBe(first.jobId);
    await flush();
  });

  it('không reuse file quá cửa sổ reuseWindowMs', async () => {
    jest.useFakeTimers();
    const r = new ExportJobRunner({ processId: 'win', reuseWindowMs: 1000 });
    const first = r.start(baseInput());
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(r.start(baseInput())).toMatchObject({
      jobId: first.jobId,
      reused: true,
    });

    jest.advanceTimersByTime(1500);
    const later = r.start(baseInput());
    expect(later.jobId).not.toBe(first.jobId);
    expect(later.reused).toBe(false);

    r.destroy();
    jest.useRealTimers();
  });

  it('đánh dấu FAILED và báo lỗi khi tải', async () => {
    const producer = jest.fn().mockRejectedValue(new Error('boom'));
    const { jobId } = runner.start(baseInput({ producer }));
    await flush();

    expect(() => runner.getReadyFile(jobId, 'u1')).toThrow('boom');
    const history = runner.listHistoryForUser('u1');
    expect(history.items[0]).toMatchObject({
      status: 'FAILED',
      canDownload: false,
    });

    // job lỗi không chặn job mới
    const next = runner.start(baseInput({ fingerprint: 'fp-3' }));
    expect(next.jobId).not.toBe(jobId);
    await flush();
  });

  it('cô lập theo userId', async () => {
    const { jobId } = runner.start(baseInput());
    await flush();

    expect(() => runner.getReadyFile(jobId, 'u2')).toThrow(NotFoundException);
    expect(runner.listHistoryForUser('u2').total).toBe(0);
    expect(runner.listHistoryForUser('u1').total).toBe(1);
  });

  it('không cho tải và không reuse khi file hết hạn, dọn job cũ', async () => {
    jest.useFakeTimers();
    const r = new ExportJobRunner({
      processId: 'ttl',
      ttlMs: 1000,
      cleanupIntervalMs: 500,
    });
    const { jobId } = r.start(baseInput());
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(r.listHistoryForUser('u1').items[0].canDownload).toBe(true);

    jest.advanceTimersByTime(2000);
    expect(r.listHistoryForUser('u1').total).toBe(0);
    expect(() => r.getReadyFile(jobId, 'u1')).toThrow(NotFoundException);

    r.destroy();
    jest.useRealTimers();
  });

  it('snapshot trả job đang chạy của user', async () => {
    let release!: (b: Buffer) => void;
    runner.start(
      baseInput({ producer: () => new Promise<Buffer>((r) => (release = r)) }),
    );

    expect(runner.getJobSnapshotForUser('u1')).toMatchObject({
      processId: 'test-export',
      isRunning: true,
    });
    expect(runner.getJobSnapshotForUser('u2')).toBeNull();

    release(Buffer.from('x'));
    await flush();
    expect(runner.getJobSnapshotForUser('u1')).toBeNull();
  });

  it('phân trang lịch sử, giới hạn pageSize', async () => {
    for (let i = 0; i < 3; i++) {
      runner.start(baseInput({ fingerprint: `fp-${i}` }));
      await flush();
    }
    const page = runner.listHistoryForUser('u1', 2, 2);
    expect(page).toMatchObject({
      total: 3,
      page: 2,
      pageSize: 2,
      totalPages: 2,
    });
    expect(page.items).toHaveLength(1);
    expect(runner.listHistoryForUser('u1', 1, 9999).pageSize).toBe(100);
  });
});

describe('fingerprint helpers', () => {
  it('stableStringify không phụ thuộc thứ tự khóa', () => {
    expect(stableStringify({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe(
      stableStringify({ a: [2, { c: 2, d: 1 }], b: 1 }),
    );
  });

  it('normalizeJsonString chuẩn hóa JSON, giữ nguyên chuỗi không phải JSON', () => {
    expect(normalizeJsonString('{"b":1,"a":2}')).toBe('{"a":2,"b":1}');
    expect(normalizeJsonString('  abc ')).toBe('abc');
    expect(normalizeJsonString(undefined)).toBe('');
  });
});
