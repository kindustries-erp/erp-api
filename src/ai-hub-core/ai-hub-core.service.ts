import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErpAiConfig } from './entities/erp-ai-config.entity';
import { ErpAiLog } from './entities/erp-ai-log.entity';
import { ErpAiPromptTemplate } from './entities/erp-ai-prompt-template.entity';
import { NineRouterClient } from './clients/nine-router.client';
import { InvoiceAiHandler } from './handlers/invoice-ai.handler';
import { AccountingAiHandler } from './handlers/accounting-ai.handler';
import { PurchasingAiHandler } from './handlers/purchasing-ai.handler';
import { InventoryAiHandler } from './handlers/inventory-ai.handler';
import { CopilotAiHandler } from './handlers/copilot-ai.handler';
import { AiModuleInvokeDto } from './dto/ai-module-invoke.dto';
import { AiChatCompletionDto } from './dto/ai-chat-completion.dto';
import { UpdateAiConfigDto } from './dto/update-ai-config.dto';

@Injectable()
export class AiHubCoreService {
  private readonly logger = new Logger(AiHubCoreService.name);

  constructor(
    @InjectRepository(ErpAiConfig)
    private readonly configRepo: Repository<ErpAiConfig>,
    @InjectRepository(ErpAiLog)
    private readonly logRepo: Repository<ErpAiLog>,
    @InjectRepository(ErpAiPromptTemplate)
    private readonly promptTemplateRepo: Repository<ErpAiPromptTemplate>,
    private readonly nineRouterClient: NineRouterClient,
    public readonly invoiceHandler: InvoiceAiHandler,
    public readonly accountingHandler: AccountingAiHandler,
    public readonly purchasingHandler: PurchasingAiHandler,
    public readonly inventoryHandler: InventoryAiHandler,
    public readonly copilotHandler: CopilotAiHandler,
  ) {}

  /**
   * Invoke domain-specific AI handler
   */
  async invokeModule(
    dto: AiModuleInvokeDto,
    actor?: { userId?: string; email?: string },
  ): Promise<{ success: boolean; data: any; usage?: any; latencyMs: number }> {
    const start = Date.now();
    const config = await this.getConfig(dto.moduleCode);
    if (config && !config.isActive) {
      throw new BadRequestException(
        `Phân hệ AI '${dto.moduleCode}' hiện đang tạm tắt.`,
      );
    }

    const tier = config?.tierLevel || 'medium';
    const modelOverride = config?.modelOverride || undefined;
    let result: any;
    let errorMsg: string | null = null;
    let status = 'SUCCESS';

    try {
      switch (dto.moduleCode.toUpperCase()) {
        case 'INVOICE':
          result = await this.invoiceHandler.extractInvoiceData(
            dto.payload.invoiceText || dto.payload.text || '',
            tier,
            modelOverride,
          );
          break;

        case 'ACCOUNTING':
          result = await this.accountingHandler.suggestJournalEntry({
            description: dto.payload.description,
            amount: dto.payload.amount,
            partnerName: dto.payload.partnerName,
            expenseCategory: dto.payload.expenseCategory,
            tier,
            modelOverride,
          });
          break;

        case 'PURCHASING':
          result = await this.purchasingHandler.compareSupplierQuotes({
            quotes: dto.payload.quotes || [],
            purchaseRequirements: dto.payload.purchaseRequirements || '',
            tier,
            modelOverride,
          });
          break;

        case 'INVENTORY':
          result = await this.inventoryHandler.analyzeInventoryRisk({
            itemCode: dto.payload.itemCode,
            currentStock: dto.payload.currentStock || 0,
            safetyStock: dto.payload.safetyStock || 0,
            recentTransactions: dto.payload.recentTransactions || [],
            averageDailyUsage: dto.payload.averageDailyUsage || 0,
            tier,
            modelOverride,
          });
          break;

        case 'COPILOT':
          result = await this.copilotHandler.chat({
            messages: dto.payload.messages || [
              { role: 'user', content: dto.payload.message || '' },
            ],
            systemContext: dto.payload.systemContext,
            tier,
            modelOverride,
            temperature: config?.temperature,
          });
          break;

        default:
          throw new BadRequestException(
            `Module AI '${dto.moduleCode}' không được hỗ trợ.`,
          );
      }
    } catch (err: any) {
      status = 'ERROR';
      errorMsg = err.message;
      throw err;
    } finally {
      const latencyMs = Date.now() - start;
      // Record audit log asynchronously
      this.recordLog({
        requestId: dto.requestId,
        actorUserId: actor?.userId,
        actorEmail: actor?.email,
        moduleCode: dto.moduleCode,
        tierLevel: tier,
        modelName: modelOverride || tier,
        promptSnippet: JSON.stringify(dto.payload).slice(0, 500),
        promptTokens: result?.usage?.prompt_tokens || 0,
        completionTokens: result?.usage?.completion_tokens || 0,
        totalTokens: result?.usage?.total_tokens || 0,
        latencyMs,
        status,
        errorMessage: errorMsg,
      }).catch((e) =>
        this.logger.error(`Failed to record AI log: ${e.message}`),
      );
    }

    return {
      success: true,
      data: result,
      usage: result?.usage,
      latencyMs: Date.now() - start,
    };
  }

  /**
   * Generic chat completion through 9router
   */
  async chatCompletion(
    dto: AiChatCompletionDto,
    actor?: { userId?: string; email?: string },
  ): Promise<any> {
    const start = Date.now();
    const modelOrTier = dto.model || dto.tier || 'medium';
    let status = 'SUCCESS';
    let errorMsg: string | null = null;
    let res: any;

    try {
      res = await this.nineRouterClient.complete({
        model: modelOrTier,
        messages: dto.messages as any,
        temperature: dto.temperature,
        max_tokens: dto.max_tokens,
      });
      return res;
    } catch (err: any) {
      status = 'ERROR';
      errorMsg = err.message;
      throw err;
    } finally {
      const latencyMs = Date.now() - start;
      this.recordLog({
        actorUserId: actor?.userId,
        actorEmail: actor?.email,
        moduleCode: 'CHAT',
        tierLevel: dto.tier || 'custom',
        modelName: res?.model || modelOrTier,
        promptSnippet:
          dto.messages?.[dto.messages.length - 1]?.content?.slice(0, 500) || '',
        promptTokens: res?.usage?.prompt_tokens || 0,
        completionTokens: res?.usage?.completion_tokens || 0,
        totalTokens: res?.usage?.total_tokens || 0,
        latencyMs,
        status,
        errorMessage: errorMsg,
      }).catch((e) =>
        this.logger.error(`Failed to record AI log: ${e.message}`),
      );
    }
  }

  /**
   * Get all module configurations
   */
  async getConfigs(): Promise<ErpAiConfig[]> {
    return this.configRepo.find({ order: { moduleCode: 'ASC' } });
  }

  /**
   * Get single module configuration
   */
  async getConfig(moduleCode: string): Promise<ErpAiConfig | null> {
    return this.configRepo.findOne({
      where: { moduleCode: moduleCode.toUpperCase() },
    });
  }

  /**
   * Update module configuration
   */
  async updateConfig(
    moduleCode: string,
    dto: UpdateAiConfigDto,
  ): Promise<ErpAiConfig> {
    const config = await this.getConfig(moduleCode);
    if (!config) {
      throw new NotFoundException(
        `Không tìm thấy cấu hình cho phân hệ '${moduleCode}'`,
      );
    }

    if (dto.tierLevel !== undefined) config.tierLevel = dto.tierLevel;
    if (dto.modelOverride !== undefined)
      config.modelOverride = dto.modelOverride;
    if (dto.temperature !== undefined) config.temperature = dto.temperature;
    if (dto.maxTokens !== undefined) config.maxTokens = dto.maxTokens;
    if (dto.isActive !== undefined) config.isActive = dto.isActive;
    if (dto.description !== undefined) config.description = dto.description;

    return this.configRepo.save(config);
  }

  /**
   * Get recent AI logs
   */
  async getLogs(limit: number = 50): Promise<ErpAiLog[]> {
    return this.logRepo.find({
      order: { createdAt: 'DESC' },
      take: Math.min(limit, 200),
    });
  }

  /**
   * Check connection to 9router
   */
  async healthCheck(): Promise<any> {
    return this.nineRouterClient.healthCheck();
  }

  private async recordLog(data: Partial<ErpAiLog>): Promise<ErpAiLog> {
    const log = this.logRepo.create(data);
    return this.logRepo.save(log);
  }
}
