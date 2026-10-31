import { Module } from '@nestjs/common';
import { DashboardCoreModule } from '@/dashboard-core/dashboard-core.module';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardStatsService } from './services/admin-dashboard-stats.service';

@Module({
  imports: [DashboardCoreModule],
  controllers: [AdminDashboardController],
  providers: [AdminDashboardStatsService],
  exports: [AdminDashboardStatsService],
})
export class AdminDashboardModule {}
