import { Test, TestingModule } from '@nestjs/testing';
import { KgaraCaseExportService } from './kgara-case-export.service';
import { KgaraCompletedCasesExportService } from './kgara-completed-cases-export.service';
import { KgaraCaseServicesExportService } from './kgara-case-services-export.service';

describe('KgaraCaseExportService (Facade)', () => {
  let service: KgaraCaseExportService;
  let mockCompletedExport: Partial<KgaraCompletedCasesExportService>;
  let mockServicesExport: Partial<KgaraCaseServicesExportService>;

  beforeEach(async () => {
    mockCompletedExport = {
      exportCompletedCasesExcel: jest
        .fn()
        .mockResolvedValue(Buffer.from('mock-completed-cases')),
    };
    mockServicesExport = {
      exportCaseServicesExcel: jest
        .fn()
        .mockResolvedValue(Buffer.from('mock-case-services')),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KgaraCaseExportService,
        {
          provide: KgaraCompletedCasesExportService,
          useValue: mockCompletedExport,
        },
        {
          provide: KgaraCaseServicesExportService,
          useValue: mockServicesExport,
        },
      ],
    }).compile();

    service = module.get<KgaraCaseExportService>(KgaraCaseExportService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should delegate exportCompletedCasesExcel to KgaraCompletedCasesExportService', async () => {
    const params = { branchId: 'CN-01' };
    const res = await service.exportCompletedCasesExcel(params);
    expect(res.toString()).toBe('mock-completed-cases');
    expect(mockCompletedExport.exportCompletedCasesExcel).toHaveBeenCalledWith(
      params,
    );
  });

  it('should delegate exportCaseServicesExcel to KgaraCaseServicesExportService', async () => {
    const params = { branchId: 'CN-01' };
    const res = await service.exportCaseServicesExcel(params);
    expect(res.toString()).toBe('mock-case-services');
    expect(mockServicesExport.exportCaseServicesExcel).toHaveBeenCalledWith(
      params,
    );
  });
});
