import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErpAiConfig } from './entities/erp-ai-config.entity';
import { ErpAiLog } from './entities/erp-ai-log.entity';
import { ErpAiPromptTemplate } from './entities/erp-ai-prompt-template.entity';
import { NineRouterClient } from './clients/nine-router.client';
import { AiHubCoreService } from './ai-hub-core.service';
import { AiHubCoreController } from './ai-hub-core.controller';
import { InvoiceAiHandler } from './handlers/invoice-ai.handler';
import { AccountingAiHandler } from './handlers/accounting-ai.handler';
import { PurchasingAiHandler } from './handlers/purchasing-ai.handler';
import { InventoryAiHandler } from './handlers/inventory-ai.handler';
import { CopilotAiHandler } from './handlers/copilot-ai.handler';

@Module({
  imports: [
    TypeOrmModule.forFeature([ErpAiConfig, ErpAiLog, ErpAiPromptTemplate]),
  ],
  controllers: [AiHubCoreController],
  providers: [
    NineRouterClient,
    AiHubCoreService,
    InvoiceAiHandler,
    AccountingAiHandler,
    PurchasingAiHandler,
    InventoryAiHandler,
    CopilotAiHandler,
  ],
  exports: [
    NineRouterClient,
    AiHubCoreService,
    InvoiceAiHandler,
    AccountingAiHandler,
    PurchasingAiHandler,
    InventoryAiHandler,
    CopilotAiHandler,
  ],
})
export class AiHubCoreModule {}
