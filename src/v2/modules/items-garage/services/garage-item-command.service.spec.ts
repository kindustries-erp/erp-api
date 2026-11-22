import { BadRequestException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { GarageItem } from '../entities/garage-item.entity';
import { CreateGarageItemDto } from '../dto/create-garage-item.dto';
import { GarageItemCommandService } from './garage-item-command.service';

describe('GarageItemCommandService', () => {
  let repo: { create: jest.Mock; save: jest.Mock; findOne: jest.Mock };
  let service: GarageItemCommandService;
  const dto: CreateGarageItemDto = {
    itemCode: ' pt-90915 ',
    itemName: 'Lọc  dầu',
    unit: 'Cái',
    itemType: 'PT',
  };

  beforeEach(() => {
    repo = {
      create: jest.fn((value: object) => value),
      save: jest.fn((value: object) => Promise.resolve(value)),
      findOne: jest.fn().mockResolvedValue(null),
    };
    service = new GarageItemCommandService(
      repo as unknown as Repository<GarageItem>,
    );
  });

  it('tạo dòng với mã chuẩn hóa, tên không dấu và nguồn MANUAL', async () => {
    const saved = await service.create(dto);

    expect(saved).toMatchObject({
      itemCode: 'PT-90915',
      itemName: 'Lọc dầu',
      nameNormalized: 'loc dau',
      source: 'MANUAL',
      isActive: true,
      isDeleted: false,
    });
  });

  it('từ chối mã trùng và mã không còn ký tự hợp lệ', async () => {
    repo.findOne.mockResolvedValue({ id: 'other' });
    await expect(service.create(dto)).rejects.toBeInstanceOf(ConflictException);

    repo.findOne.mockResolvedValue(null);
    await expect(
      service.create({ ...dto, itemCode: '***' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('cập nhật rỗng thì giữ nguyên, không kiểm tra trùng mã', async () => {
    const entity = { id: 'id-1', isDeleted: false } as GarageItem;

    await service.update(entity, {});

    expect(Object.keys(entity)).toEqual(['id', 'isDeleted']);
    expect(repo.findOne).not.toHaveBeenCalled();
  });

  it('đổi mã thì kiểm tra trùng, đổi tên thì tính lại tên không dấu', async () => {
    const entity = { id: 'id-1', itemCode: 'PT-1' } as GarageItem;

    await service.update(entity, { itemCode: 'pt-2', itemName: 'Má phanh' });

    expect(repo.findOne).toHaveBeenCalledTimes(1);
    expect(entity).toMatchObject({
      itemCode: 'PT-2',
      nameNormalized: 'ma phanh',
    });
  });

  it('xóa mềm bằng cờ isDeleted', async () => {
    const entity = { id: 'id-1', isDeleted: false } as GarageItem;

    await service.softDelete(entity);

    expect(entity.isDeleted).toBe(true);
  });
});
