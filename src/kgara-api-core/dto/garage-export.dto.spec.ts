import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import {
  GarageCasesExportDto,
  GarageDebtsExportDto,
} from './garage-export.dto';

const check = async <T extends object>(cls: new () => T, plain: object) => {
  const instance = plainToInstance(cls, plain);
  const errors = await validate(instance as object);
  return { instance, errors };
};

describe('GarageDebtsExportDto', () => {
  it('chấp nhận payload hợp lệ và chuẩn hóa sorts thành mảng', async () => {
    const { instance, errors } = await check(GarageDebtsExportDto, {
      mode: 'by-current-filter',
      from: '2026-07-01',
      to: '2026-07-31T23:59:59',
      sorts: '-balanceAmount',
      filtersStr: '{"customer":["A"]}',
    });
    expect(errors).toHaveLength(0);
    expect(instance.sorts).toEqual(['-balanceAmount']);
  });

  it('chặn mode và ngày sai định dạng', async () => {
    const { errors } = await check(GarageDebtsExportDto, {
      mode: 'everything',
      from: '01/07/2026',
    });
    expect(errors.map((e) => e.property).sort()).toEqual(['from', 'mode']);
  });

  it('chặn SQL chèn qua trường ngày', async () => {
    const { errors } = await check(GarageDebtsExportDto, {
      to: "2026-07-01'; DROP TABLE kgara_cases;--",
    });
    expect(errors.map((e) => e.property)).toEqual(['to']);
  });
});

describe('GarageCasesExportDto', () => {
  it('chấp nhận payload hợp lệ', async () => {
    const { errors } = await check(GarageCasesExportDto, {
      mode: 'by-period',
      date_from: '2026-07-01',
      date_to: '2026-07-31',
      date_type: 'completion_date',
      status: 'completed',
    });
    expect(errors).toHaveLength(0);
  });

  it('chặn date_type không hỗ trợ', async () => {
    const { errors } = await check(GarageCasesExportDto, { date_type: 'foo' });
    expect(errors.map((e) => e.property)).toEqual(['date_type']);
  });
});
