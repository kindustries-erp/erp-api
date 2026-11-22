import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiHubUsageLog } from './entities/ai-hub-usage-log.entity';
import { AiHubUsageLogController } from './controllers/ai-hub-usage-log.controller';
import { AiHubGatewayService } from './ai-hub-gateway.service';
import { AiGatewayClient } from './services/ai-gateway.client';
import { AiGatewayHealthService } from './services/ai-gateway-health.service';
import { AiHubUsageLogQueryService } from './services/ai-hub-usage-log-query.service';
import { AiUsageLogService } from './services/ai-usage-log.service';

@Module({
  imports: [TypeOrmModule.forFeature([AiHubUsageLog])],
  controllers: [AiHubUsageLogController],
  providers: [
    AiHubGatewayService,
    AiHubUsageLogQueryService,
    AiUsageLogService,
    AiGatewayHealthService,
    AiGatewayClient,
  ],
  exports: [AiGatewayClient],
})
export class AiHubGatewayModule {}
