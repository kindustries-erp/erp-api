import { NotFoundException } from '@nestjs/common';
import { GarageItem } from './entities/garage-item.entity';
import { CreateGarageItemDto } from './dto/create-garage-item.dto';
import { QueryGarageItemDto } from './dto/query-garage-item.dto';
import { GarageItemCommandService } from './services/garage-item-command.service';
import { GarageItemQueryService } from './services/garage-item-query.service';
import { ItemsGarageService } from './items-garage.service';

describe('ItemsGarageService', () => {
  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  const row = {
    id: 'id-1',
    isDeleted: false,
    createdAt,
    updatedAt: createdAt,
  } as GarageItem;

  let query: {
    findAll: jest.Mock;
    findById: jest.Mock;
    findColumnOptions: jest.Mock;
  };
  let command: { create: jest.Mock; update: jest.Mock; softDelete: jest.Mock };
  let service: ItemsGarageService;

  beforeEach(() => {
    query = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findColumnOptions: jest.fn(),
    };
    command = { create: jest.fn(), update: jest.fn(), softDelete: jest.fn() };
    service = new ItemsGarageService(
      query as unknown as GarageItemQueryService,
      command as unknown as GarageItemCommandService,
    );
  });

  it('wraps a response DTO in the message/data envelope without isDeleted', async () => {
    query.findById.mockResolvedValue(row);

    const result = await service.findOne('id-1');

    expect(result.data.id).toBe('id-1');
    expect(result.message).toEqual(expect.any(String));
    expect(result.data).not.toHaveProperty('isDeleted');
  });

  it('throws NotFound when the row is missing or soft-deleted', async () => {
    query.findById.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('maps paginated items to response DTOs with totalPages', async () => {
    query.findAll.mockResolvedValue({
      items: [row],
      total: 41,
      page: 1,
      pageSize: 20,
    });

    const result = await service.findAll({} as QueryGarageItemDto);

    expect(result.pagination).toMatchObject({ total: 41, totalPages: 3 });
    expect(result.items[0]).not.toHaveProperty('isDeleted');
  });

  it('passes summaries through with the page', async () => {
    const metric = { total: 9, pageSubtotal: 9, cumulative: 9 };
    query.findAll.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      summaries: { amount: metric },
    });

    const result = await service.findAll({} as QueryGarageItemDto);

    expect(result.summaries).toEqual({ amount: metric });
  });

  it('delegates column options to the query service', async () => {
    query.findColumnOptions.mockResolvedValue({
      items: [],
      total: 0,
      next: null,
    });

    await service.findColumnOptions('code', undefined, 1, 20, undefined);

    expect(query.findColumnOptions).toHaveBeenCalledWith(
      'code',
      undefined,
      1,
      20,
      undefined,
    );
  });

  it('creates and returns the envelope with a response DTO', async () => {
    command.create.mockResolvedValue(row);

    const result = await service.create({} as CreateGarageItemDto);

    expect(result.data.id).toBe('id-1');
    expect(result.message).toEqual(expect.any(String));
  });

  it('soft-deletes an existing row and returns the envelope', async () => {
    query.findById.mockResolvedValue(row);
    command.softDelete.mockResolvedValue({ ...row, isDeleted: true });

    const result = await service.remove('id-1');

    expect(command.softDelete).toHaveBeenCalledWith(row);
    expect(result.data.id).toBe('id-1');
    expect(result.data).not.toHaveProperty('isDeleted');
  });
});
