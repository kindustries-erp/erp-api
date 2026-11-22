import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { isCronEnabled, runSafeCronJob } from '@/common/utils/cron.util';
import {
  DEFAULT_JOB_TIMEZONE,
  JobStatus,
  ScheduledJob,
  ScheduledJobDefinition,
} from '@/v2/core/scheduler-core';

interface JobEntry {
  def: ScheduledJobDefinition;
  timeZone: string;
  enabled: boolean;
  running: boolean;
  lastRunAt: Date | null;
  lastSuccess: boolean | null;
  lastDurationMs: number | null;
}

/**
 * Điều phối job định kỳ. Tự tìm mọi provider kế thừa `ScheduledJob` khi khởi động
 * và đăng ký chúng. Một cổng `isCronEnabled()` duy nhất quyết định có tạo timer hay không.
 */
@Injectable()
export class SchedulerJobsService
  implements OnModuleInit, OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(SchedulerJobsService.name);
  private readonly jobs = new Map<string, JobEntry>();
  private bootstrapped = false;

  constructor(
    private readonly registry: SchedulerRegistry,
    private readonly discovery: DiscoveryService,
  ) {}

  /** Đăng ký mọi `ScheduledJob` có trong container. Chạy trước bootstrap nên job được bật cùng lúc. */
  onModuleInit(): void {
    for (const wrapper of this.discovery.getProviders()) {
      const instance: unknown = wrapper.instance;
      if (!(instance instanceof ScheduledJob)) continue;
      this.register({
        name: instance.jobName,
        cron: instance.cron,
        timeZone: instance.timeZone,
        execute: () => instance.run(),
      });
    }
  }

  register(def: ScheduledJobDefinition): void {
    if (this.jobs.has(def.name)) {
      throw new Error(`Job "${def.name}" đã được đăng ký`);
    }
    const entry: JobEntry = {
      def,
      timeZone: def.timeZone ?? DEFAULT_JOB_TIMEZONE,
      enabled: false,
      running: false,
      lastRunAt: null,
      lastSuccess: null,
      lastDurationMs: null,
    };
    this.jobs.set(def.name, entry);
    if (this.bootstrapped) {
      this.activate(entry);
    }
  }

  onApplicationBootstrap(): void {
    this.bootstrapped = true;
    for (const entry of this.jobs.values()) {
      this.activate(entry);
    }
  }

  onModuleDestroy(): void {
    for (const entry of this.jobs.values()) {
      if (!entry.enabled) continue;
      try {
        this.registry.deleteCronJob(entry.def.name);
      } catch {
        // Job có thể đã bị gỡ trước đó; không cần làm gì thêm.
      }
      entry.enabled = false;
    }
  }

  getStatus(): JobStatus[] {
    return [...this.jobs.values()].map((entry) => ({
      name: entry.def.name,
      cron: entry.def.cron,
      timeZone: entry.timeZone,
      enabled: entry.enabled,
      running: entry.running,
      lastRunAt: entry.lastRunAt,
      lastSuccess: entry.lastSuccess,
      lastDurationMs: entry.lastDurationMs,
    }));
  }

  private activate(entry: JobEntry): void {
    entry.enabled = isCronEnabled();
    if (!entry.enabled) {
      this.logger.log(
        `[${entry.def.name}] Cron tắt (ENABLE_CRON), không tạo timer.`,
      );
      return;
    }
    const job = new CronJob(
      entry.def.cron,
      () => {
        void this.tick(entry);
      },
      null,
      false,
      entry.timeZone,
    );
    this.registry.addCronJob(entry.def.name, job);
    job.start();
  }

  private async tick(entry: JobEntry): Promise<void> {
    const name = entry.def.name;
    if (entry.running) {
      this.logger.warn(`[${name}] Bỏ qua chu kỳ: chu kỳ trước còn đang chạy.`);
      return;
    }
    entry.running = true;
    try {
      const outcome = await runSafeCronJob({
        jobName: name,
        logger: this.logger,
        execute: entry.def.execute,
      });
      entry.lastRunAt = new Date();
      entry.lastSuccess = outcome.success;
      entry.lastDurationMs = outcome.durationMs ?? null;
    } finally {
      entry.running = false;
    }
  }
}
