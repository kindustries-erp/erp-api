import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PurchaseOrdersCoreService } from './purchase-orders-core.service';
import { ErpPurchaseOrder } from './entities/erp_purchase_order.entity';
import { ErpPurchaseOrderLine } from './entities/erp_purchase_order_line.entity';
import { DocumentDependenciesCoreService } from '../document-dependencies-core/document-dependencies-core.service';
import { CompanyProfileService } from '../company-profile/company-profile.service';

describe('PurchaseOrdersCoreService - Items & Supplier Stats', () => {
  let service: PurchaseOrdersCoreService;

  const mockPoRepo = {
    find: jest.fn(),
    findOneByOrFail: jest.fn(),
  };

  const mockLineRepo = {
    createQueryBuilder: jest.fn(),
  };

  const mockDataSource = {
    getRepository: jest.fn(),
  };

  const mockDependencyService = {};
  const mockCompanyProfileService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrdersCoreService,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: getRepositoryToken(ErpPurchaseOrder),
          useValue: mockPoRepo,
        },
        {
          provide: getRepositoryToken(ErpPurchaseOrderLine),
          useValue: mockLineRepo,
        },
        {
          provide: DocumentDependenciesCoreService,
          useValue: mockDependencyService,
        },
        {
          provide: CompanyProfileService,
          useValue: mockCompanyProfileService,
        },
      ],
    }).compile();

    service = module.get<PurchaseOrdersCoreService>(PurchaseOrdersCoreService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSupplierStats', () => {
    it('should aggregate supplier statistics accurately', async () => {
      mockPoRepo.find.mockResolvedValue([
        {
          id: 'po-1',
          supplierId: 'sup-1',
          orderDate: '2026-09-01T00:00:00.000Z',
          lines: [
            {
              qtyOrdered: '10',
              qtyReceived: '10',
              unitPrice: '100000',
              amount: '1000000',
            },
            {
              qtyOrdered: '5',
              qtyReceived: '2',
              unitPrice: '200000',
              amount: '1000000',
            },
          ],
        },
        {
          id: 'po-2',
          supplierId: 'sup-1',
          orderDate: '2026-08-15T00:00:00.000Z',
          lines: [
            {
              qtyOrdered: '2',
              qtyReceived: '0',
              unitPrice: '500000',
              amount: '1000000',
            },
          ],
        },
      ]);

      const stats = await service.getSupplierStats('sup-1');
      expect(stats).toBeDefined();
      expect(stats.supplierId).toBe('sup-1');
      expect(stats.totalOrders).toBe(2);
      expect(stats.totalSpend).toBe(3000000); // 1M + 1M + 1M
      // totalReceived: (10 * 100k) + (2 * 200k) + (0 * 500k) = 1M + 400k = 1.4M
      expect(stats.totalReceivedAmount).toBe(1400000);
      expect(stats.pendingAmount).toBe(1600000);
      expect(stats.completionRate).toBe(46.7);
      expect(stats.lastOrderDate).toBe('2026-09-01T00:00:00.000Z');
    });

    it('should handle zero orders gracefully', async () => {
      mockPoRepo.find.mockResolvedValue([]);

      const stats = await service.getSupplierStats('sup-empty');
      expect(stats.totalOrders).toBe(0);
      expect(stats.totalSpend).toBe(0);
      expect(stats.completionRate).toBe(0);
      expect(stats.lastOrderDate).toBeNull();
    });
  });

  describe('getColumnOptions', () => {
    it('should return options for totalAmount via lines query', async () => {
      const mockQb = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        having: jest.fn().mockReturnThis(),
        andHaving: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest
          .fn()
          .mockResolvedValue([{ val: '1000000' }, { val: '5000000' }]),
      };
      (service as any).repository.createQueryBuilder = jest
        .fn()
        .mockReturnValue(mockQb);

      const result = await service.getColumnOptions('totalAmount');
      expect(result).toBeDefined();
      expect(result.items).toEqual(['1000000', '5000000']);
      expect(result.total).toBe(2);
    });
  });

  describe('getItemsColumnOptions', () => {
    it('should return options for itemCode via lineRepository query', async () => {
      const mockQb = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest
          .fn()
          .mockResolvedValue([{ val: 'ITEM-01' }, { val: 'ITEM-02' }]),
      };
      (service as any).lineRepository.createQueryBuilder = jest
        .fn()
        .mockReturnValue(mockQb);

      const result = await service.getItemsColumnOptions(
        'itemCode',
        undefined,
        1,
        20,
        undefined,
        'sup-1',
      );
      expect(result).toBeDefined();
      expect(result.items).toEqual(['ITEM-01', 'ITEM-02']);
      expect(result.total).toBe(2);
    });
  });
});
