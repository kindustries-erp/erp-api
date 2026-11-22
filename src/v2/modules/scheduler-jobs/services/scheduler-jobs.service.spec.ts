import { CronJob } from 'cron';
import { ScheduledJob } from '@/v2/core/scheduler-core';
import { SchedulerJobsService } from './scheduler-jobs.service';

jest.mock('cron', () => ({
  CronJob: jest.fn().mockImplementation((_cron, onTick) => ({
    start: jest.fn(),
    stop: jest.fn(),
    fireTick: onTick,
  })),
}));

type MockedCron = { start: jest.Mock; fireTick: () => void };

function makeRegistry() {
  return {
    addCronJob: jest.fn(),
    deleteCronJob: jest.fn(),
  };
}

function makeDiscovery(instances: unknown[] = []) {
  return { getProviders: () => instances.map((instance) => ({ instance })) };
}

class FakeJob extends ScheduledJob {
  readonly jobName = 'fake-job';
  readonly cron = '0 15 4 * * *';
  runCount = 0;

  async run(): Promise<void> {
    this.runCount += 1;
  }
}

function lastCronJob(): MockedCron {
  const results = (CronJob as unknown as jest.Mock).mock.results;
  return results[results.length - 1].value as MockedCron;
}

describe('SchedulerJobsService', () => {
  const originalEnv = process.env.ENABLE_CRON;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ENABLE_CRON = 'true';
  });

  afterAll(() => {
    if (originalEnv === undefined) delete process.env.ENABLE_CRON;
    else process.env.ENABLE_CRON = originalEnv;
  });

  it('từ chối đăng ký trùng tên job (AC-2)', () => {
    const service = new SchedulerJobsService(
      makeRegistry() as any,
      makeDiscovery() as any,
    );
    const def = { name: 'job-a', cron: '0 0 2 * * *', execute: async () => {} };
    service.register(def);
    expect(() => service.register(def)).toThrow('đã được đăng ký');
  });

  it('không tạo timer khi ENABLE_CRON=false (AC-1)', () => {
    process.env.ENABLE_CRON = 'false';
    const registry = makeRegistry();
    const service = new SchedulerJobsService(
      registry as any,
      makeDiscovery() as any,
    );
    service.register({
      name: 'job-a',
      cron: '0 0 2 * * *',
      execute: async () => {},
    });

    service.onApplicationBootstrap();

    expect(CronJob).not.toHaveBeenCalled();
    expect(registry.addCronJob).not.toHaveBeenCalled();
    expect(service.getStatus()[0].enabled).toBe(false);
  });

  it('tạo CronJob với múi giờ mặc định Asia/Ho_Chi_Minh và bắt đầu chạy', () => {
    const registry = makeRegistry();
    const service = new SchedulerJobsService(
      registry as any,
      makeDiscovery() as any,
    );
    service.register({
      name: 'job-a',
      cron: '0 30 2 * * *',
      execute: async () => {},
    });

    service.onApplicationBootstrap();

    expect(CronJob).toHaveBeenCalledWith(
      '0 30 2 * * *',
      expect.any(Function),
      null,
      false,
      'Asia/Ho_Chi_Minh',
    );
    expect(registry.addCronJob).toHaveBeenCalledWith(
      'job-a',
      expect.anything(),
    );
    expect(lastCronJob().start).toHaveBeenCalled();
    expect(service.getStatus()[0].enabled).toBe(true);
  });

  it('job đăng ký sau bootstrap được bật ngay', () => {
    const service = new SchedulerJobsService(
      makeRegistry() as any,
      makeDiscovery() as any,
    );
    service.onApplicationBootstrap();
    service.register({
      name: 'late',
      cron: '0 0 3 * * *',
      execute: async () => {},
    });
    expect(lastCronJob().start).toHaveBeenCalled();
  });

  it('không chạy chồng: tick thứ hai khi job còn chạy bị bỏ qua (AC-3)', async () => {
    const service = new SchedulerJobsService(
      makeRegistry() as any,
      makeDiscovery() as any,
    );
    let release!: () => void;
    const execute = jest.fn(
      () => new Promise<void>((resolve) => (release = resolve)),
    );
    service.register({ name: 'slow', cron: '0 0 2 * * *', execute });
    service.onApplicationBootstrap();

    lastCronJob().fireTick();
    lastCronJob().fireTick();
    expect(execute).toHaveBeenCalledTimes(1);

    release();
    await new Promise((r) => setImmediate(r));
    expect(service.getStatus()[0].running).toBe(false);
    expect(service.getStatus()[0].lastSuccess).toBe(true);
  });

  it('lỗi một job không làm ảnh hưởng job khác (AC-3)', async () => {
    const service = new SchedulerJobsService(
      makeRegistry() as any,
      makeDiscovery() as any,
    );
    const failing = jest.fn().mockRejectedValue(new Error('boom'));
    const ok = jest.fn().mockResolvedValue(undefined);
    service.register({ name: 'bad', cron: '0 0 2 * * *', execute: failing });
    service.register({ name: 'good', cron: '0 0 3 * * *', execute: ok });
    service.onApplicationBootstrap();

    const [bad, good] = (CronJob as unknown as jest.Mock).mock.results.map(
      (r) => r.value as MockedCron,
    );
    bad.fireTick();
    good.fireTick();
    await new Promise((r) => setImmediate(r));

    const status = service.getStatus();
    expect(status.find((s) => s.name === 'bad')?.lastSuccess).toBe(false);
    expect(status.find((s) => s.name === 'good')?.lastSuccess).toBe(true);
    expect(ok).toHaveBeenCalledTimes(1);
  });

  it('getStatus trả lịch, múi giờ và thời điểm chạy cuối', async () => {
    const service = new SchedulerJobsService(
      makeRegistry() as any,
      makeDiscovery() as any,
    );
    service.register({
      name: 'job-a',
      cron: '0 0 2 * * *',
      execute: async () => {},
    });
    service.onApplicationBootstrap();
    expect(service.getStatus()[0].lastRunAt).toBeNull();

    lastCronJob().fireTick();
    await new Promise((r) => setImmediate(r));

    const status = service.getStatus()[0];
    expect(status.cron).toBe('0 0 2 * * *');
    expect(status.timeZone).toBe('Asia/Ho_Chi_Minh');
    expect(status.lastRunAt).toBeInstanceOf(Date);
    expect(status.lastDurationMs).toEqual(expect.any(Number));
  });

  it('tự phát hiện ScheduledJob trong container và bỏ qua provider khác', async () => {
    const job = new FakeJob();
    const service = new SchedulerJobsService(
      makeRegistry() as any,
      makeDiscovery([job, { notAJob: true }, 'text']) as any,
    );

    service.onModuleInit();
    service.onApplicationBootstrap();

    expect(service.getStatus()).toEqual([
      expect.objectContaining({
        name: 'fake-job',
        cron: '0 15 4 * * *',
        timeZone: 'Asia/Ho_Chi_Minh',
        enabled: true,
      }),
    ]);
    lastCronJob().fireTick();
    await new Promise((r) => setImmediate(r));
    expect(job.runCount).toBe(1);
  });

  it('từ chối hai ScheduledJob trùng jobName khi discovery', () => {
    const service = new SchedulerJobsService(
      makeRegistry() as any,
      makeDiscovery([new FakeJob(), new FakeJob()]) as any,
    );
    expect(() => service.onModuleInit()).toThrow('đã được đăng ký');
  });

  it('onModuleDestroy gỡ các job đã bật khỏi registry', () => {
    const registry = makeRegistry();
    const service = new SchedulerJobsService(
      registry as any,
      makeDiscovery() as any,
    );
    service.register({
      name: 'job-a',
      cron: '0 0 2 * * *',
      execute: async () => {},
    });
    service.onApplicationBootstrap();

    service.onModuleDestroy();

    expect(registry.deleteCronJob).toHaveBeenCalledWith('job-a');
  });
});
