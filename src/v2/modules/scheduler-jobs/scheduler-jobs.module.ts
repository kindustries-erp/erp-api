import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { SchedulerJobsService } from './services/scheduler-jobs.service';

/**
 * Module điều phối job định kỳ v2. Import một lần trong `AppModule`.
 * `ScheduleModule.forRoot()` (global) cung cấp `SchedulerRegistry`.
 * Job nào kế thừa `ScheduledJob` (từ scheduler-core) sẽ được tự đăng ký.
 */
@Module({
  imports: [DiscoveryModule],
  providers: [SchedulerJobsService],
  exports: [SchedulerJobsService],
})
export class SchedulerJobsModule {}
