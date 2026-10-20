import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BusinessPartnersCoreService } from './business-partners-core.service';
import { CreateErpBusinessPartnerDto } from './dto/create-erp-business-partner.dto';
import { ErpBusinessPartnerCommandService } from './services/erp-business-partner-command.service';
import { ErpBusinessPartnerQueryService } from './services/erp-business-partner-query.service';
import { toErpBusinessPartnerResponse } from './helpers/erp-business-partner.mapper';

describe('BusinessPartnersCoreService', () => {
  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  const row = {
    id: 'id-1',
    code: 'KH-001',
    name: 'Công ty ABC',
    displayName: null,
    partnerType: 'CUSTOMER',
    taxCode: null,
    phone: null,
    email: null,
    address: null,
    contactName: null,
    status: 'ACTIVE',
    notes: null,
    isDeleted: false,
    createdAt,
    updatedAt: createdAt,
  };

  let query: {
    findAll: jest.Mock;
    findById: jest.Mock;
    findCodesForNextCode: jest.Mock;
    findColumnOptions: jest.Mock;
  };
  let command: {
    create: jest.Mock;
    update: jest.Mock;
    softDelete: jest.Mock;
    assertCodeAvailable: jest.Mock;
  };
  let service: BusinessPartnersCoreService;

  beforeEach(() => {
    query = {
      findAll: jest.fn(),
      findById: jest.fn().mockResolvedValue(row),
      findCodesForNextCode: jest.fn().mockResolvedValue([]),
      findColumnOptions: jest.fn(),
    };
    command = {
      create: jest.fn(async (dto) => ({ ...row, ...dto, id: 'id-new' })),
      update: jest.fn(async (entity, dto) => ({ ...entity, ...dto })),
      softDelete: jest.fn(async (entity) => ({ ...entity, isDeleted: true })),
      assertCodeAvailable: jest.fn().mockResolvedValue(undefined),
    };
    service = new BusinessPartnersCoreService(
      query as unknown as ErpBusinessPartnerQueryService,
      command as unknown as ErpBusinessPartnerCommandService,
    );
  });

  describe('getNextCode', () => {
    it('returns NCC-001 for a vendor when no code exists yet', async () => {
      await expect(service.getNextCode('VENDOR')).resolves.toEqual({
        nextCode: 'NCC-001',
      });
      expect(query.findCodesForNextCode).toHaveBeenCalledWith('VENDOR');
    });

    it('continues from the highest trailing number of the customer prefix', async () => {
      query.findCodesForNextCode.mockResolvedValue([
        'KH-003',
        'KH-010',
        'OTHER',
      ]);

      await expect(service.getNextCode('CUSTOMER')).resolves.toEqual({
        nextCode: 'KH-011',
      });
    });
  });

  describe('create', () => {
    it('generates the next code for the partner type when code is blank', async () => {
      query.findCodesForNextCode.mockResolvedValue(['NCC-004']);

      const result = await service.create({
        code: '   ',
        name: 'NCC Mới',
        partnerType: 'VENDOR',
      } as CreateErpBusinessPartnerDto);

      expect(command.assertCodeAvailable).toHaveBeenCalledWith('NCC-005');
      expect(command.create).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'NCC-005' }),
      );
      expect(result.message).toEqual(expect.any(String));
      expect(result.data).not.toHaveProperty('isDeleted');
    });

    it('normalizes a typed code before checking it for duplicates', async () => {
      await service.create({
        code: '  kh-010 ',
        name: 'A',
        partnerType: 'CUSTOMER',
      } as CreateErpBusinessPartnerDto);

      expect(command.assertCodeAvailable).toHaveBeenCalledWith('KH-010');
      expect(command.create).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'KH-010' }),
      );
    });

    it('stops before saving when the code already exists', async () => {
      command.assertCodeAvailable.mockRejectedValue(
        new BadRequestException('trùng'),
      );

      await expect(
        service.create({
          code: 'KH-001',
          name: 'A',
          partnerType: 'CUSTOMER',
        } as CreateErpBusinessPartnerDto),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(command.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('keeps the existing code when the typed code is blank', async () => {
      await service.update('id-1', { code: '  ', name: 'Mới' });

      expect(command.assertCodeAvailable).not.toHaveBeenCalled();
      expect(command.update).toHaveBeenCalledWith(
        row,
        expect.objectContaining({ code: undefined }),
      );
    });

    it('checks a new code for duplicates while excluding the row being edited', async () => {
      await service.update('id-1', { code: 'kh-002' });

      expect(command.assertCodeAvailable).toHaveBeenCalledWith(
        'KH-002',
        'id-1',
      );
      expect(command.update).toHaveBeenCalledWith(
        row,
        expect.objectContaining({ code: 'KH-002' }),
      );
    });

    it('throws NotFound when the partner is missing or deleted', async () => {
      query.findById.mockResolvedValue(null);

      await expect(
        service.update('missing', { name: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findAll and findColumnOptions', () => {
    it('maps items to response DTOs with totalPages', async () => {
      query.findAll.mockResolvedValue({
        items: [row],
        total: 21,
        page: 1,
        pageSize: 20,
        summaries: {},
      });

      const result = await service.findAll({} as never);

      expect(result.totalPages).toBe(2);
      expect(result.items[0]).not.toHaveProperty('isDeleted');
    });

    it('forwards the partner type scope to column options', async () => {
      await service.findColumnOptions('name', 'ab', 2, 20, '{}', 'VENDOR');

      expect(query.findColumnOptions).toHaveBeenCalledWith(
        'name',
        'ab',
        2,
        20,
        '{}',
        'VENDOR',
      );
    });
  });

  describe('response contract', () => {
    it('keeps the V1 field set (isDeleted is internal and not returned)', async () => {
      const result = await service.findOne('id-1');

      expect(Object.keys(result.data).sort()).toEqual(
        [
          'address',
          'code',
          'contactName',
          'createdAt',
          'displayName',
          'email',
          'id',
          'name',
          'notes',
          'partnerType',
          'phone',
          'status',
          'taxCode',
          'updatedAt',
        ].sort(),
      );
      expect(toErpBusinessPartnerResponse(row)).not.toHaveProperty('isDeleted');
    });
  });

  describe('remove', () => {
    it('soft-deletes the partner and returns the envelope', async () => {
      const result = await service.remove('id-1');

      expect(command.softDelete).toHaveBeenCalledWith(row);
      expect(result.message).toEqual(expect.any(String));
      expect(result.data.id).toBe('id-1');
    });
  });
});
