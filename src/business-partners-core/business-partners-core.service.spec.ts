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
      orWhere: jest.fn().mockReturnThis(),
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
      getOne: jest.fn().mockResolvedValue(null),
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

  describe('generateNextCode and getNextCode', () => {
    it('should generate next vendor code formatted as NCC-XXX', async () => {
      qb.getRawMany.mockResolvedValueOnce([
        { code: 'NCC-001' },
        { code: 'NCC-005' },
        { code: 'NCC-013' },
      ]);

      const result = await service.getNextCode('VENDOR');
      expect(result).toEqual({ nextCode: 'NCC-014' });
    });

    it('should generate NCC-001 if no existing partners found', async () => {
      qb.getRawMany.mockResolvedValueOnce([]);

      const result = await service.getNextCode('VENDOR');
      expect(result).toEqual({ nextCode: 'NCC-001' });
    });

    it('should generate next customer code formatted as KH-XXX', async () => {
      qb.getRawMany.mockResolvedValueOnce([
        { code: 'KH-001' },
        { code: 'KH-006' },
      ]);

      const result = await service.getNextCode('CUSTOMER');
      expect(result).toEqual({ nextCode: 'KH-007' });
    });
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

    it('should apply V2 operators, date ranges and all-matching filters', async () => {
      await service.findAll({
        page: 1,
        pageSize: 20,
        column_filters: JSON.stringify({ code: ['__ALL_MATCHING__', 'KH'] }),
        column_operators: JSON.stringify({
          name: { operator: 'contains', value: 'Công ty' },
          email: { operator: 'is_not_empty', value: '' },
        }),
        date_ranges: JSON.stringify({
          createdAt: { from: '2026-01-01', to: '2026-12-31' },
        }),
      });

      const calls = qb.andWhere.mock.calls.map(([sql]: [string]) => sql);
      expect(calls).toEqual(
        expect.arrayContaining([
          expect.stringContaining('bp.name ILIKE'),
          expect.stringContaining('bp.email IS NOT NULL'),
          expect.stringContaining('bp.createdAt >='),
          expect.stringContaining('bp.createdAt <='),
        ]),
      );
    });

    it('should apply V2 date operators with whole-day boundaries', async () => {
      await service.findAll({
        column_operators: JSON.stringify({
          createdAt: {
            operator: 'between',
            value: '2026-01-01',
            valueTo: '2026-01-31',
          },
        }),
      });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'bp.createdAt BETWEEN :bp_operator_0_from AND :bp_operator_0_to',
        expect.objectContaining({
          bp_operator_0_from: expect.any(Date),
          bp_operator_0_to: expect.any(Date),
        }),
      );
    });

    it('should ignore unknown operator columns', async () => {
      await service.findAll({
        column_operators: JSON.stringify({
          unsafe: { operator: 'contains', value: 'x' },
        }),
      });

      expect(qb.andWhere).not.toHaveBeenCalledWith(
        expect.stringContaining('unsafe'),
        expect.anything(),
      );
    });

    it('should ignore date operators for non-date columns', async () => {
      await service.findAll({
        column_operators: JSON.stringify({
          name: { operator: 'before', value: '2026-01-01' },
        }),
      });

      expect(qb.andWhere).not.toHaveBeenCalledWith(
        expect.stringContaining('bp.name <'),
        expect.anything(),
      );
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

    it('should apply nested V2 cross-column filters', async () => {
      await service.getColumnOptions(
        'status',
        undefined,
        1,
        20,
        JSON.stringify({
          columnFilters: { code: ['KH-001'] },
          columnOperators: {
            name: { operator: 'starts_with', value: 'Công' },
          },
          dateRanges: { createdAt: { from: '2026-01-01' } },
        }),
        'CUSTOMER',
      );

      const calls = qb.andWhere.mock.calls.map(([sql]: [string]) => sql);
      expect(calls).toEqual(
        expect.arrayContaining([
          expect.stringContaining('bp.code IN'),
          expect.stringContaining('bp.name ILIKE'),
          expect.stringContaining('bp.createdAt >='),
        ]),
      );
    });
  });

  describe('create and update', () => {
    it('should create a business partner with provided code', async () => {
      qb.getOne.mockResolvedValueOnce(null); // no duplicate

      const result = await service.create({
        code: 'NCC-002',
        name: 'Công ty XYZ',
        partnerType: 'VENDOR',
      } as any);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'NCC-002',
          name: 'Công ty XYZ',
        }),
      );
      expect(repository.save).toHaveBeenCalled();
      expect(result.message).toBe('Tạo thành công');
    });

    it('should auto-generate code if code is omitted or empty', async () => {
      qb.getRawMany.mockResolvedValueOnce([{ code: 'NCC-013' }]);
      qb.getOne.mockResolvedValueOnce(null); // no duplicate

      const result = await service.create({
        code: '',
        name: 'Nhà cung cấp mới',
        partnerType: 'VENDOR',
      } as any);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'NCC-014',
          name: 'Nhà cung cấp mới',
        }),
      );
      expect(result.message).toBe('Tạo thành công');
    });

    it('should throw BadRequestException if duplicate code on create', async () => {
      qb.getOne.mockResolvedValueOnce({ id: 'uuid-existing', code: 'NCC-001' });

      await expect(
        service.create({
          code: 'NCC-001',
          name: 'Nhà cung cấp trùng',
          partnerType: 'VENDOR',
        } as any),
      ).rejects.toThrow('Mã đối tác "NCC-001" đã tồn tại trên hệ thống');
    });

    it('should update a business partner', async () => {
      qb.getOne.mockResolvedValueOnce(null); // no duplicate
      const result = await service.update('uuid-1', {
        name: 'Công ty ABC Cập nhật',
      } as any);

      expect(repository.update).toHaveBeenCalledWith(
        'uuid-1',
        expect.objectContaining({
          name: 'Công ty ABC Cập nhật',
        }),
      );
      expect(result.message).toBe('Cập nhật thành công');
    });
  });
});
