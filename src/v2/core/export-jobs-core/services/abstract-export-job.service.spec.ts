import { BadRequestException } from '@nestjs/common';

import { AbstractExportJobService } from './abstract-export-job.service';

class TestExportJobService extends AbstractExportJobService {
  constructor(reuseWindowMs?: number) {
    super({ processId: 'test-xlsx-export', reuseWindowMs });
  }

  start(userId: string, producer: () => Promise<Buffer>, fingerprint = 'fp') {
    return this.startJob({
      userId,
      fingerprint,
      fileName: 'test.xlsx',
      totalUnits: 100,
      producer,
    });
  }
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('AbstractExportJobService', () => {
  let service: TestExportJobService;

  beforeEach(() => {
    service = new TestExportJobService();
  });

  afterEach(() => service.onModuleDestroy());

  it('từ chối khi thiếu userId', () => {
    expect(() => service.start('', async () => Buffer.from('x'))).toThrow(
      BadRequestException,
    );
  });

  it('chạy nền, báo tiến độ qua progress$ và tải được file khi xong', async () => {
    const events: string[] = [];
    service.progress$.subscribe((e) =>
      events.push(`${e.processId}:${e.completed ? 'done' : 'run'}`),
    );

    const result = service.start('u1', async () => Buffer.from('xlsx'));
    expect(result.reused).toBe(false);
    await flush();

    expect(events[0]).toBe('test-xlsx-export:run');
    expect(events[events.length - 1]).toBe('test-xlsx-export:done');
    const file = service.getReadyFile(result.jobId, 'u1');
    expect(file.fileName).toBe('test.xlsx');
    expect(file.buffer.toString()).toBe('xlsx');
  });

  it('chỉ một job RUNNING mỗi user và trả lại job đang chạy', () => {
    const never = () => new Promise<Buffer>(() => undefined);
    const first = service.start('u1', never);
    const second = service.start('u1', never);
    expect(second.jobId).toBe(first.jobId);
    expect(second.reused).toBeUndefined();
    expect(service.getJobSnapshotForUser('u1')?.isRunning).toBe(true);
  });

  it('tái sử dụng file đã xong khi fingerprint trùng', async () => {
    const first = service.start('u1', async () => Buffer.from('a'), 'same');
    await flush();
    const second = service.start('u1', async () => Buffer.from('b'), 'same');
    expect(second).toMatchObject({ jobId: first.jobId, reused: true });
  });

  it('job lỗi báo failed và getReadyFile ném BadRequest', async () => {
    const { jobId } = service.start('u1', async () => {
      throw new Error('boom');
    });
    await flush();
    expect(() => service.getReadyFile(jobId, 'u1')).toThrow('boom');
    const history = service.listHistoryForUser('u1');
    expect(history.items[0]).toMatchObject({
      status: 'FAILED',
      canDownload: false,
      message: 'boom',
    });
  });

  it('không cho user khác tải file', async () => {
    const { jobId } = service.start('u1', async () => Buffer.from('a'));
    await flush();
    expect(() => service.getReadyFile(jobId, 'u2')).toThrow(
      'Không tìm thấy file xuất Excel.',
    );
  });
});
