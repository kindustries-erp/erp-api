import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CashflowForecast } from '../entities/cashflow-forecast.entity';
import { AbstractCashflowForecastQueryService } from './abstract-cashflow-forecast-query.service';

class TestForecastQuery extends AbstractCashflowForecastQueryService<CashflowForecast> {
  protected readonly headerEntity = CashflowForecast;
}

function buildService(opts: {
  findOne?: CashflowForecast | null;
  findAndCount?: [CashflowForecast[], number];
}) {
  const repo = {
    findOne: jest.fn().mockResolvedValue(opts.findOne ?? null),
    findAndCount: jest.fn().mockResolvedValue(opts.findAndCount ?? [[], 0]),
  };
  const dataSource = {
    getRepository: jest.fn(() => repo),
  } as unknown as DataSource;
  return { service: new TestForecastQuery(dataSource), repo };
}

describe('AbstractCashflowForecastQueryService', () => {
  describe('findOne', () => {
    it('chỉ lấy bản ghi chưa xóa mềm', async () => {
      const { service, repo } = buildService({
        findOne: Object.assign(new CashflowForecast(), { id: 'f-1' }),
      });
      const found = await service.findOne('f-1');
      expect(found.id).toBe('f-1');
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 'f-1', isDeleted: false },
      });
    });

    it('không có bản ghi thì ném 404', async () => {
      const { service } = buildService({ findOne: null });
      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('list', () => {
    it('luôn loại bản ghi đã xóa và áp bộ lọc có giá trị', async () => {
      const { service, repo } = buildService({ findAndCount: [[], 0] });
      await service.list({ direction: 'OUT', status: 'OPEN' });
      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isDeleted: false, direction: 'OUT', status: 'OPEN' },
        }),
      );
    });

    it('phân trang: trang 2, limit 10 thì skip 10 take 10', async () => {
      const { service, repo } = buildService({ findAndCount: [[], 0] });
      const result = await service.list({ page: 2, limit: 10 });
      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
      expect(result).toEqual({ items: [], total: 0, page: 2, limit: 10 });
    });

    it('giới hạn limit tối đa 200 và tối thiểu 1', async () => {
      const { service, repo } = buildService({ findAndCount: [[], 0] });
      await service.list({ limit: 9999, page: 0 });
      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ take: 200, skip: 0 }),
      );
    });
  });
});
