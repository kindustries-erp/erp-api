import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ErpBusinessPartner } from '../entities/erp_business_partner.entity';
import { ErpBusinessPartnerCommandService } from './erp-business-partner-command.service';

describe('ErpBusinessPartnerCommandService', () => {
  let qb: Record<string, jest.Mock>;
  let repo: {
    createQueryBuilder: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let service: ErpBusinessPartnerCommandService;

  beforeEach(() => {
    qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };
    repo = {
      createQueryBuilder: jest.fn(() => qb),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    };
    service = new ErpBusinessPartnerCommandService(
      repo as unknown as Repository<ErpBusinessPartner>,
    );
  });

  it('checks the code case-insensitively and ignores soft-deleted rows', async () => {
    await service.assertCodeAvailable('KH-001');

    expect(qb.where).toHaveBeenCalledWith('LOWER(e.code) = LOWER(:code)', {
      code: 'KH-001',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('e.isDeleted = :isDeleted', {
      isDeleted: false,
    });
    expect(qb.andWhere).not.toHaveBeenCalledWith(
      'e.id != :excludeId',
      expect.anything(),
    );
  });

  it('excludes the edited row when checking an update', async () => {
    await service.assertCodeAvailable('KH-001', 'id-1');

    expect(qb.andWhere).toHaveBeenCalledWith('e.id != :excludeId', {
      excludeId: 'id-1',
    });
  });

  it('throws a BadRequest that names the duplicated code', async () => {
    qb.getOne.mockResolvedValue({ id: 'other' });

    await expect(service.assertCodeAvailable('KH-001')).rejects.toThrow(
      'Mã đối tác "KH-001" đã tồn tại trên hệ thống',
    );
    await expect(service.assertCodeAvailable('KH-001')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('soft-deletes by setting the isDeleted flag', async () => {
    const entity = { id: 'id-1', isDeleted: false } as ErpBusinessPartner;

    await service.softDelete(entity);

    expect(entity.isDeleted).toBe(true);
    expect(repo.save).toHaveBeenCalledWith(entity);
  });

  it('extraData khi sửa đối tác: merge cấp 1, null xóa key, thiếu field thì giữ nguyên', async () => {
    const entity = {
      id: 'p1',
      code: 'KH-1',
      name: 'A',
      extraData: { a: 1, b: 2 },
    } as unknown as ErpBusinessPartner;

    const merged = await service.update(entity, {
      extraData: { b: 3, a: null },
    });
    expect(merged.extraData).toEqual({ b: 3 });

    const kept = await service.update(
      { ...entity, extraData: { a: 1 } } as ErpBusinessPartner,
      { name: 'B' },
    );
    expect(kept.extraData).toEqual({ a: 1 });
  });

  it('từ chối extraData sai định dạng khi tạo đối tác', async () => {
    await expect(
      service.create({
        name: 'A',
        partnerType: 'CUSTOMER',
        extraData: 'x',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.save).not.toHaveBeenCalled();
  });
});
