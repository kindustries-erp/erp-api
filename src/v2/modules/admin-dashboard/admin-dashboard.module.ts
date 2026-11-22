import { Module } from '@nestjs/common';
import { DashboardCoreModule } from '@/dashboard-core/dashboard-core.module';
import { AdminDashboardController } from './controllers/admin-dashboard.controller';
import { AdminDashboardStatsService } from './services/admin-dashboard-stats.service';

/** Tổng quan điều hành Admin Portal (`api/v2/admin/dashboard/summary`). Số liệu lấy từ DashboardCoreModule (v1). */
@Module({
  imports: [DashboardCoreModule],
  controllers: [AdminDashboardController],
  providers: [AdminDashboardStatsService],
  exports: [AdminDashboardStatsService],
})
export class AdminDashboardModule {}
