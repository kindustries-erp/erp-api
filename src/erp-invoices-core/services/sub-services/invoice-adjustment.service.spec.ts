import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { InvoiceAdjustmentService } from './invoice-adjustment.service';
import { ErpInvoice } from '../../entities/erp_invoice.entity';
import { ErpInvoiceItem } from '../../entities/erp_invoice_item.entity';
import { ErpInvoiceAdjustmentNetOff } from '../../entities/erp_invoice_adjustment_netoff.entity';

describe('InvoiceAdjustmentService', () => {
  let service: InvoiceAdjustmentService;

  const mockInvoiceRepo = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockInvoiceItemRepo = {
    find: jest.fn(),
  };

  const mockAdjustmentNetoffRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockDataSource = {
    query: jest.fn(),
    transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceAdjustmentService,
        {
          provide: getRepositoryToken(ErpInvoice),
          useValue: mockInvoiceRepo,
        },
        {
          provide: getRepositoryToken(ErpInvoiceItem),
          useValue: mockInvoiceItemRepo,
        },
        {
          provide: getRepositoryToken(ErpInvoiceAdjustmentNetOff),
          useValue: mockAdjustmentNetoffRepo,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<InvoiceAdjustmentService>(InvoiceAdjustmentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAdjustmentReconciliation - Adjusting Invoice', () => {
    it('should reconcile adjusting invoice debt to 0 and calculate net effective items', async () => {
      const mockAdjustingInvoice: Partial<ErpInvoice> = {
        id: 'adj-1',
        invoiceNo: '146',
        serialNo: 'C24TYY',
        direction: 'OUT',
        totalAmount: '-500000',
        taxInvoiceStatus: 3,
        relatedInvoiceNo: '142',
        relatedSerialNo: 'C24TYY',
        invoiceDate: '2024-05-10' as any,
        effectiveData: {
          isAdjusted: false,
          hasInfoAdjustment: true,
          infoDiffs: [
            {
              field: 'buyerTaxCode',
              fieldNameVi: 'Mã số thuế',
              oldValue: '0315000000',
              newValue: '0316999999',
            },
          ],
        },
        items: [
          {
            id: 'item-adj-1',
            invoiceId: 'adj-1',
            itemCode: 'VT01',
            description: 'Lọc gió điều hòa',
            unit: 'Cái',
            quantity: '-1',
            unitPrice: '500000',
            totalAmount: '-500000',
          } as ErpInvoiceItem,
        ],
      };

      const mockOriginalInvoice: Partial<ErpInvoice> = {
        id: 'orig-1',
        invoiceNo: '142',
        serialNo: 'C24TYY',
        direction: 'OUT',
        totalAmount: '2000000',
        taxInvoiceStatus: 5,
        invoiceDate: '2024-05-01' as any,
        items: [
          {
            id: 'item-orig-1',
            invoiceId: 'orig-1',
            itemCode: 'VT01',
            description: 'Lọc gió điều hòa',
            unit: 'Cái',
            quantity: '3',
            unitPrice: '500000',
            totalAmount: '1500000',
          } as ErpInvoiceItem,
        ],
      };

      mockInvoiceRepo.findOne.mockResolvedValue(mockAdjustingInvoice);

      const qbMock: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockOriginalInvoice),
      };
      mockInvoiceRepo.createQueryBuilder.mockReturnValue(qbMock);

      mockAdjustmentNetoffRepo.findOne.mockResolvedValue({
        id: 'netoff-1',
        originalInvoiceId: 'orig-1',
        adjustingInvoiceId: 'adj-1',
        offsetAmount: '500000',
      });

      mockDataSource.query
        .mockResolvedValueOnce([{ paid: 0 }]) // voucher paid
        .mockResolvedValueOnce([{ offset: 500000 }]); // adjustment offset

      const res = await service.getAdjustmentReconciliation('adj-1');

      expect(res.role).toBe('ADJUSTING');
      expect(res.financial.originalAmount).toBe(2000000);
      expect(res.financial.adjustedDeltaAmount).toBe(-500000);
      expect(res.financial.netoffOffsetAmount).toBe(500000);
      // Adjusting invoice debt must be 0 because it was offset against the original
      expect(res.financial.remainingDebt).toBe(0);

      // Item reconciliation: 3 + (-1) = 2
      expect(res.itemReconciliations).toHaveLength(1);
      expect(res.itemReconciliations[0].itemCode).toBe('VT01');
      expect(res.itemReconciliations[0].originalQty).toBe(3);
      expect(res.itemReconciliations[0].adjustedDeltaQty).toBe(-1);
      expect(res.itemReconciliations[0].netEffectiveQty).toBe(2);

      // Info diff check
      expect(res.infoDiff.hasInfoAdjustment).toBe(true);
      expect(res.infoDiff.diffs[0].field).toBe('buyerTaxCode');
    });
  });

  describe('executeAdjustmentNetoff', () => {
    it('should save netoff record inside transaction and update original effectiveData', async () => {
      const mockOrig = {
        id: 'orig-1',
        invoiceNo: '142',
        totalAmount: '2000000',
        effectiveData: null as any,
      };
      const mockAdj = {
        id: 'adj-1',
        invoiceNo: '146',
        totalAmount: '-500000',
        effectiveData: {
          infoDiffs: [
            {
              field: 'buyerTaxCode',
              fieldNameVi: 'Mã số thuế',
              oldValue: '0315',
              newValue: '0316',
            },
          ],
        },
      };

      const mockManager = {
        findOne: jest
          .fn()
          .mockResolvedValueOnce(mockOrig)
          .mockResolvedValueOnce(mockAdj)
          .mockResolvedValueOnce(null), // no existing netoff
        create: jest
          .fn()
          .mockImplementation((entity, data) => ({ id: 'new-id', ...data })),
        save: jest.fn().mockResolvedValue(true),
      };

      mockDataSource.transaction.mockImplementation(async (cb) =>
        cb(mockManager),
      );

      const res = await service.executeAdjustmentNetoff({
        originalInvoiceId: 'orig-1',
        adjustingInvoiceId: 'adj-1',
      });

      expect(res.success).toBe(true);
      expect(res.offsetAmount).toBe(500000);
      expect(mockManager.save).toHaveBeenCalledTimes(2); // netoff record + original invoice effectiveData
    });
  });
});
