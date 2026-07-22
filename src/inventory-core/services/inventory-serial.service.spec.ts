import { NotFoundException } from '@nestjs/common';
import { InventorySerialService } from './inventory-serial.service';

describe('InventorySerialService invariants', () => {
  let service: InventorySerialService;
  let mockManager: any;
  let mockDataSource: any;

  let mockSerialRepo: any;
  let mockVehicleRepo: any;
  let mockLifecycleRepo: any;
  let mockSoRepo: any;
  let mockSoLineRepo: any;

  beforeEach(() => {
    mockSerialRepo = { findOne: jest.fn(), find: jest.fn(), save: jest.fn() };
    mockVehicleRepo = { findOne: jest.fn(), save: jest.fn() };
    mockLifecycleRepo = { findOne: jest.fn(), save: jest.fn() };
    mockSoRepo = { findOne: jest.fn(), save: jest.fn() };
    mockSoLineRepo = { findOne: jest.fn(), find: jest.fn() };

    mockManager = {
      getRepository: jest.fn((entity) => {
        switch (entity.name) {
          case 'ErpInventoryTrackingSerial':
            return mockSerialRepo;
          case 'ErpVehicle':
            return mockVehicleRepo;
          case 'ErpSerialLifecycle':
            return mockLifecycleRepo;
          case 'ErpSalesOrder':
            return mockSoRepo;
          case 'ErpSalesOrderLine':
            return mockSoLineRepo;
        }
      }),
    };

    mockDataSource = {
      transaction: jest.fn(async (cb) => {
        return await cb(mockManager);
      }),
    };

    service = new InventorySerialService(mockSerialRepo, mockDataSource);
  });

  describe('confirmDeliveries', () => {
    it('should confirm deliveries and update SO status to DELIVERED when no serials are delivering', async () => {
      const dto = { serialIds: ['s1', 's2'], deliveryDate: '2026-07-20' };
      const soId = 'so1';
      const lineId1 = 'l1';
      const lineId2 = 'l2';

      mockSerialRepo.findOne
        .mockResolvedValueOnce({
          id: 's1',
          status: 'DELIVERING',
          vinId: 'v1',
          salesOrderLineId: lineId1,
        })
        .mockResolvedValueOnce({
          id: 's2',
          status: 'DELIVERING',
          vinId: null,
          salesOrderLineId: lineId2,
        });

      mockLifecycleRepo.findOne
        .mockResolvedValueOnce({ serialId: 's1', deliveryDate: null })
        .mockResolvedValueOnce({ serialId: 's2', deliveryDate: null });

      mockVehicleRepo.findOne.mockResolvedValue({
        id: 'v1',
        status: 'DELIVERING',
      });

      mockSoLineRepo.findOne
        .mockResolvedValueOnce({ id: lineId1, salesOrderId: soId })
        .mockResolvedValueOnce({ id: lineId2, salesOrderId: soId });

      mockSoRepo.findOne.mockResolvedValue({ id: soId, status: 'DELIVERING' });
      mockSoLineRepo.find.mockResolvedValue([{ id: lineId1 }, { id: lineId2 }]);

      mockSerialRepo.find.mockResolvedValue([
        { id: 's1', status: 'SOLD' },
        { id: 's2', status: 'SOLD' },
      ]);

      await service.confirmDeliveries(dto as any);

      expect(mockLifecycleRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ deliveryDate: '2026-07-20' }),
      );
      expect(mockSerialRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 's1', status: 'SOLD' }),
      );
      expect(mockSerialRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 's2', status: 'SOLD' }),
      );
      expect(mockVehicleRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'v1', status: 'SOLD' }),
      );

      expect(mockSoRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: soId, status: 'DELIVERED' }),
      );
    });

    it('should confirm deliveries but keep SO status DELIVERING if there are other delivering serials', async () => {
      const dto = { serialIds: ['s1'], deliveryDate: '2026-07-20' };
      const soId = 'so1';
      const lineId1 = 'l1';

      mockSerialRepo.findOne.mockResolvedValue({
        id: 's1',
        status: 'DELIVERING',
        salesOrderLineId: lineId1,
      });
      mockLifecycleRepo.findOne.mockResolvedValue({
        serialId: 's1',
        deliveryDate: null,
      });
      mockSoLineRepo.findOne.mockResolvedValue({
        id: lineId1,
        salesOrderId: soId,
      });
      mockSoRepo.findOne.mockResolvedValue({ id: soId, status: 'DELIVERING' });
      mockSoLineRepo.find.mockResolvedValue([{ id: lineId1 }]);

      mockSerialRepo.find.mockResolvedValue([
        { id: 's1', status: 'SOLD' },
        { id: 's3', status: 'DELIVERING' },
      ]);

      await service.confirmDeliveries(dto as any);
      expect(mockSoRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: soId, status: 'DELIVERING' }),
      );
    });

    it('should throw NotFoundException if serial is not found', async () => {
      mockSerialRepo.findOne.mockResolvedValue(null);
      const dto = { serialIds: ['invalid'], deliveryDate: '2026-07-20' };
      await expect(service.confirmDeliveries(dto as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
