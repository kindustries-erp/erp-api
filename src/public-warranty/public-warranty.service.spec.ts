import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { PublicWarrantyService } from './public-warranty.service';
import { ErpVehicle } from '../erp-mfg-core/entities/erp_vehicle.entity';
import { ErpInventoryTrackingSerial } from '../inventory-core/entities/erp_inventory_tracking_serial.entity';
import { ErpSerialLifecycle } from '../inventory-core/entities/erp_serial_lifecycle.entity';
import { ErpBusinessPartner } from '../business-partners-core/entities/erp_business_partner.entity';
import {
  findUnverifiedVehicle,
  getAllUnverifiedVehicles,
} from './data/unverified-vehicles';

describe('PublicWarrantyService - Whitelist 200 Batch 3 & UNVERIFIED Prefix', () => {
  let service: PublicWarrantyService;
  let vehicleRepo: any;
  let trackingSerialRepo: any;
  let lifecycleRepo: any;
  let businessPartnerRepo: any;

  beforeEach(async () => {
    vehicleRepo = {
      findOne: jest.fn(),
    };
    trackingSerialRepo = {
      findOne: jest.fn(),
    };
    lifecycleRepo = {
      findOne: jest.fn(),
      create: jest.fn((dto) => ({ ...dto })),
      save: jest.fn((entity) => Promise.resolve(entity)),
      createQueryBuilder: jest.fn(),
    };
    businessPartnerRepo = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicWarrantyService,
        {
          provide: getRepositoryToken(ErpVehicle),
          useValue: vehicleRepo,
        },
        {
          provide: getRepositoryToken(ErpInventoryTrackingSerial),
          useValue: trackingSerialRepo,
        },
        {
          provide: getRepositoryToken(ErpSerialLifecycle),
          useValue: lifecycleRepo,
        },
        {
          provide: getRepositoryToken(ErpBusinessPartner),
          useValue: businessPartnerRepo,
        },
      ],
    }).compile();

    service = module.get<PublicWarrantyService>(PublicWarrantyService);
  });

  describe('Unverified Batch 3 Dataset Verification', () => {
    it('should have exactly 200 vehicles in batch 3 dataset', () => {
      const allVehicles = getAllUnverifiedVehicles();
      expect(allVehicles.length).toBe(200);
      for (const v of allVehicles) {
        expect(v.vin_no).toBeTruthy();
        expect(v.engine_no).toBeTruthy();
        expect(v.serial_no).toMatch(/^XDA/);
      }
    });

    it('should find vehicle in batch 3 by normalized VIN and Engine', () => {
      const item = findUnverifiedVehicle(
        'rl9l3abkptafs0399',
        'vld60v800wn008371',
      );
      expect(item).toBeDefined();
      expect(item?.serial_no).toBe('XDA1754752');
      expect(item?.color).toBe('Đen');
    });

    it('should return undefined for vehicle not in batch 3', () => {
      const item = findUnverifiedVehicle('RANDOM_VIN_123', 'RANDOM_ENGINE_456');
      expect(item).toBeUndefined();
    });
  });

  describe('check()', () => {
    it('should reject vehicle not in erp_vehicles AND not in batch 3 whitelist', async () => {
      vehicleRepo.findOne.mockResolvedValue(null);

      const res = await service.check({
        vin_no: 'INVALID_VIN_9999',
        engine_no: 'INVALID_ENGINE_9999',
      });

      expect(res.found).toBe(false);
      expect(res.reason).toBe('NOT_IN_SYSTEM');
      expect(res.vehicle).toBeNull();
    });

    it('should allow vehicle in batch 3 whitelist when not in erp_vehicles', async () => {
      vehicleRepo.findOne.mockResolvedValue(null);
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      lifecycleRepo.createQueryBuilder.mockReturnValue(qb);

      const res = await service.check({
        vin_no: 'RL9L3ABKPTAFS0399',
        engine_no: 'VLD60V800WN008371',
      });

      expect(res.found).toBe(true);
      expect(res.eligible).toBe(true);
      expect(res.reason).toBe('UNVERIFIED_VEHICLE');
      expect(res.vehicle?.warranty_status).toBe('NOT_ACTIVATED');
    });

    it('should return active warranty if batch 3 vehicle was already activated', async () => {
      vehicleRepo.findOne.mockResolvedValue(null);
      const activatedDate = new Date('2026-08-01T00:00:00.000Z');
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          status: 'ACTIVE',
          warrantyActivatedAt: activatedDate,
          warrantyEndDate: '2029-08-01',
          customerName: 'Nguyễn Văn A',
          customerPhone: '0901234567',
          attributes: { dealer_name: 'Đại lý KL Lotus SG' },
        }),
      };
      lifecycleRepo.createQueryBuilder.mockReturnValue(qb);

      const res = await service.check({
        vin_no: 'RL9L3ABKPTAFS0399',
        engine_no: 'VLD60V800WN008371',
      });

      expect(res.found).toBe(true);
      expect(res.eligible).toBe(true);
      expect(res.vehicle?.warranty_status).toBe('ACTIVE');
      expect(res.active_warranty).toBeDefined();
      expect(res.active_warranty?.customer_name).toBe('Nguyễn Văn A');
    });
  });

  describe('activate()', () => {
    it('should reject activation for vehicle not in erp_vehicles AND not in batch 3', async () => {
      vehicleRepo.findOne.mockResolvedValue(null);

      await expect(
        service.activate({
          vin_no: 'UNKNOWN_VIN',
          engine_no: 'UNKNOWN_ENGINE',
          dealer_id: 'DEALER_01',
          dealer_name: 'Đại Lý ABC',
          customer_name: 'Test Customer',
          customer_phone: '0900000000',
          customer_address: '123 Đường ABC',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should activate vehicle in batch 3 and store UNVERIFIED_ prefix in ghost_serial', async () => {
      vehicleRepo.findOne.mockResolvedValue(null);
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      lifecycleRepo.createQueryBuilder.mockReturnValue(qb);

      businessPartnerRepo.findOne.mockResolvedValue({
        id: 'partner-uuid-1',
        code: 'DEALER_HN',
        name: 'Đại Lý Hà Nội',
      });

      const res = await service.activate({
        vin_no: 'RL9L3ABKPTAFS0399',
        engine_no: 'VLD60V800WN008371',
        dealer_id: 'DEALER_HN',
        dealer_name: 'Đại Lý Hà Nội',
        customer_name: 'Trần Thị B',
        customer_phone: '0912345678',
        customer_address: '123 Cầu Giấy, Hà Nội',
      });

      expect(res.message).toBe('Kích hoạt bảo hành thành công');
      expect(res.activation.warranty_code).toContain('WRN-');
      expect(res.activation.customer_name).toBe('Trần Thị B');

      expect(lifecycleRepo.save).toHaveBeenCalled();
      const savedLifecycle = lifecycleRepo.save.mock.calls[0][0];
      expect(savedLifecycle.attributes.is_ghost).toBe(true);
      expect(savedLifecycle.attributes.ghost_vin).toBe('RL9L3ABKPTAFS0399');
      expect(savedLifecycle.attributes.ghost_engine).toBe('VLD60V800WN008371');
      // Verify UNVERIFIED_ prefix
      expect(savedLifecycle.attributes.ghost_serial).toBe(
        'UNVERIFIED_XDA1754752',
      );
      expect(savedLifecycle.attributes.ghost_color).toBe('Đen');
    });

    it('should reject activation if batch 3 vehicle is already activated', async () => {
      vehicleRepo.findOne.mockResolvedValue(null);
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          status: 'ACTIVE',
          warrantyActivatedAt: new Date(),
        }),
      };
      lifecycleRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(
        service.activate({
          vin_no: 'RL9L3ABKPTAFS0399',
          engine_no: 'VLD60V800WN008371',
          dealer_id: 'DEALER_HN',
          dealer_name: 'Đại Lý Hà Nội',
          customer_name: 'Trần Thị B',
          customer_phone: '0912345678',
          customer_address: '123 Cầu Giấy, Hà Nội',
        }),
      ).rejects.toThrow('Xe này đã được kích hoạt bảo hành');
    });
  });
});
