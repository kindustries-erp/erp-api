import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { KgaraSuppliersService } from './kgara-suppliers.service';
import { KgaraCase } from '../entities/kgara_case.entity';
import { KgaraSuppliersDebtQueryEngine } from './engines/kgara-suppliers-debt-query.engine';

describe('KgaraSuppliersService', () => {
  let service: KgaraSuppliersService;
  let caseRepo: any;
  let mockEngine: any;

  beforeEach(async () => {
    const mockRepo = () => ({
      find: jest.fn(),
      findOne: jest.fn(),
      getMany: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      }),
    });

    caseRepo = mockRepo();
    mockEngine = {
      getSuppliersDebt: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      getSuppliersDebtColumnOptions: jest
        .fn()
        .mockResolvedValue({ items: [], total: 0 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KgaraSuppliersService,
        { provide: KgaraSuppliersDebtQueryEngine, useValue: mockEngine },
        { provide: getRepositoryToken(KgaraCase), useValue: caseRepo },
      ],
    }).compile();

    service = module.get<KgaraSuppliersService>(KgaraSuppliersService);
  });

  describe('getSuppliersDebt', () => {
    it('should delegate getSuppliersDebt to KgaraSuppliersDebtQueryEngine', async () => {
      const params = { branchId: 'BR-01', page: 1, pageSize: 20 };
      await service.getSuppliersDebt(params);
      expect(mockEngine.getSuppliersDebt).toHaveBeenCalledWith(params);
    });
  });

  describe('getSuppliersDebtColumnOptions', () => {
    it('should delegate getSuppliersDebtColumnOptions to KgaraSuppliersDebtQueryEngine', async () => {
      await service.getSuppliersDebtColumnOptions(
        'BR-01',
        'licensePlate',
        '51',
      );
      expect(mockEngine.getSuppliersDebtColumnOptions).toHaveBeenCalledWith(
        'BR-01',
        'licensePlate',
        '51',
        1,
        20,
        undefined,
      );
    });
  });

  describe('getCasesBySupplier', () => {
    it('should query linked cases for supplier', async () => {
      const res = await service.getCasesBySupplier('BR-01', 'SUPP-01');
      expect(res.payables).toEqual([]);
      expect(Array.isArray(res.linkedCases)).toBe(true);
    });
  });
});
