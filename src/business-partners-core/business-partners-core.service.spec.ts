import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BusinessPartnersCoreService } from './business-partners-core.service';
import { ErpBusinessPartner } from './entities/erp_business_partner.entity';

describe('BusinessPartnersCoreService', () => {
  let service: BusinessPartnersCoreService;
  let repository: any;
  let qb: any;

  beforeEach(async () => {
    qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      clone: jest.fn(),
      getManyAndCount: jest.fn().mockResolvedValue([
        [
          {
            id: 'uuid-1',
            code: 'KH-001',
            name: 'Công ty ABC',
            partnerType: 'CUSTOMER',
            status: 'ACTIVE',
          },
        ],
        1,
      ]),
      getRawMany: jest.fn().mockResolvedValue([
        { value: 'ACTIVE', count: '10' },
        { value: 'INACTIVE', count: '2' },
      ]),
    };
    qb.clone.mockReturnValue(qb);

    repository = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      create: jest.fn((dto) => dto),
      save: jest.fn((entity) => Promise.resolve({ id: 'uuid-1', ...entity })),
      findOneByOrFail: jest.fn().mockResolvedValue({
        id: 'uuid-1',
        code: 'KH-001',
        name: 'Công ty ABC',
        partnerType: 'CUSTOMER',
        status: 'ACTIVE',
      }),
      findOneBy: jest.fn().mockResolvedValue({
        id: 'uuid-1',
        code: 'KH-001',
        isDeleted: false,
      }),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessPartnersCoreService,
        {
          provide: getRepositoryToken(ErpBusinessPartner),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get<BusinessPartnersCoreService>(
      BusinessPartnersCoreService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should query with partnerType and pagination', async () => {
      const result = await service.findAll({
        page: 1,
        pageSize: 20,
        partnerType: 'CUSTOMER',
      });

      expect(repository.createQueryBuilder).toHaveBeenCalledWith('bp');
      expect(qb.where).toHaveBeenCalledWith('bp.isDeleted = false');
      expect(qb.andWhere).toHaveBeenCalledWith(
        'bp.partnerType = :partnerType',
        {
          partnerType: 'CUSTOMER',
        },
      );
      expect(result.items.length).toBe(1);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should apply column_filters and column_search', async () => {
      await service.findAll({
        page: 1,
        pageSize: 20,
        partnerType: 'VENDOR',
        column_filters: JSON.stringify({
          status: ['ACTIVE'],
        }),
        column_search: JSON.stringify({
          code: 'NCC-01',
        }),
      });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'bp.partnerType = :partnerType',
        {
          partnerType: 'VENDOR',
        },
      );
      expect(qb.andWhere).toHaveBeenCalled();
    });
  });

  describe('getColumnOptions', () => {
    it('should return distinct options for a valid column', async () => {
      const result = await service.getColumnOptions(
        'status',
        undefined,
        1,
        20,
        undefined,
        'CUSTOMER',
      );

      expect(repository.createQueryBuilder).toHaveBeenCalledWith('bp');
      expect(qb.select).toHaveBeenCalledWith('bp.status', 'value');
      expect(result.items).toEqual([
        { label: 'ACTIVE', value: 'ACTIVE' },
        { label: 'INACTIVE', value: 'INACTIVE' },
      ]);
    });

    it('should return empty for unknown column', async () => {
      const result = await service.getColumnOptions('unknown_col');
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.next).toBeNull();
    });
  });

  describe('create and update', () => {
    it('should create a business partner', async () => {
      const result = await service.create({
        code: 'KH-002',
        name: 'Công ty XYZ',
        partnerType: 'CUSTOMER',
      } as any);

      expect(repository.create).toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalled();
      expect(result.message).toBe('Tạo thành công');
    });

    it('should update a business partner', async () => {
      const result = await service.update('uuid-1', {
        name: 'Công ty ABC Cập nhật',
      } as any);

      expect(repository.update).toHaveBeenCalledWith('uuid-1', {
        name: 'Công ty ABC Cập nhật',
      });
      expect(result.message).toBe('Cập nhật thành công');
    });
  });
});
