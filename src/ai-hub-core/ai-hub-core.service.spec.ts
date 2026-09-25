import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AiHubCoreService } from './ai-hub-core.service';
import { ErpAiConfig } from './entities/erp-ai-config.entity';
import { ErpAiLog } from './entities/erp-ai-log.entity';
import { ErpAiPromptTemplate } from './entities/erp-ai-prompt-template.entity';
import { NineRouterClient } from './clients/nine-router.client';
import { InvoiceAiHandler } from './handlers/invoice-ai.handler';
import { AccountingAiHandler } from './handlers/accounting-ai.handler';
import { PurchasingAiHandler } from './handlers/purchasing-ai.handler';
import { InventoryAiHandler } from './handlers/inventory-ai.handler';
import { CopilotAiHandler } from './handlers/copilot-ai.handler';

describe('AiHubCoreService', () => {
  let service: AiHubCoreService;

  const mockConfigRepo = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue({
      moduleCode: 'ACCOUNTING',
      tierLevel: 'medium',
      isActive: true,
    }),
    save: jest.fn().mockImplementation((config) => Promise.resolve(config)),
  };

  const mockLogRepo = {
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockImplementation((dto) => dto),
    save: jest.fn().mockImplementation((log) => Promise.resolve(log)),
  };

  const mockPromptRepo = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
  };

  const mockNineRouterClient = {
    complete: jest.fn().mockResolvedValue({
      id: 'test-123',
      model: 'ag/gemini-3.7-flash-medium',
      choices: [{ message: { content: 'test response' } }],
    }),
    healthCheck: jest
      .fn()
      .mockResolvedValue({ ok: true, latencyMs: 50, modelsCount: 20 }),
  };

  const mockInvoiceHandler = {
    extractInvoiceData: jest.fn().mockResolvedValue({ items: [] }),
  };

  const mockAccountingHandler = {
    suggestJournalEntry: jest.fn().mockResolvedValue({
      debitAccount: '642',
      creditAccount: '1111',
      confidence: 0.9,
      explanation: 'Chi phí quản lý',
    }),
  };

  const mockPurchasingHandler = {
    compareSupplierQuotes: jest
      .fn()
      .mockResolvedValue({ recommendedSupplier: 'NCC A' }),
  };

  const mockInventoryHandler = {
    analyzeInventoryRisk: jest.fn().mockResolvedValue({ riskLevel: 'LOW' }),
  };

  const mockCopilotHandler = {
    chat: jest.fn().mockResolvedValue({
      content: 'Copilot response',
      model: 'ag/gemini-3.7-flash-high',
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiHubCoreService,
        { provide: getRepositoryToken(ErpAiConfig), useValue: mockConfigRepo },
        { provide: getRepositoryToken(ErpAiLog), useValue: mockLogRepo },
        {
          provide: getRepositoryToken(ErpAiPromptTemplate),
          useValue: mockPromptRepo,
        },
        { provide: NineRouterClient, useValue: mockNineRouterClient },
        { provide: InvoiceAiHandler, useValue: mockInvoiceHandler },
        { provide: AccountingAiHandler, useValue: mockAccountingHandler },
        { provide: PurchasingAiHandler, useValue: mockPurchasingHandler },
        { provide: InventoryAiHandler, useValue: mockInventoryHandler },
        { provide: CopilotAiHandler, useValue: mockCopilotHandler },
      ],
    }).compile();

    service = module.get<AiHubCoreService>(AiHubCoreService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should invoke ACCOUNTING module and return journal suggestions', async () => {
    const result = await service.invokeModule({
      moduleCode: 'ACCOUNTING',
      payload: {
        description: 'Tiếp khách ăn trưa',
        amount: 500000,
      },
    });

    expect(result.success).toBe(true);
    expect(result.data.debitAccount).toBe('642');
    expect(mockAccountingHandler.suggestJournalEntry).toHaveBeenCalled();
  });

  it('should check health of 9router', async () => {
    const health = await service.healthCheck();
    expect(health.ok).toBe(true);
    expect(health.modelsCount).toBe(20);
  });
});
