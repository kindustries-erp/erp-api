import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import {
  GarageCasesExportDto,
  GarageDashboardExportDto,
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

describe('GarageDashboardExportDto', () => {
  it('chấp nhận khoảng ngày hợp lệ và payload rỗng', async () => {
    const ok = await check(GarageDashboardExportDto, {
      from: '2026-10-01',
      to: '2026-10-31',
    });
    expect(ok.errors).toHaveLength(0);
    const empty = await check(GarageDashboardExportDto, {});
    expect(empty.errors).toHaveLength(0);
  });

  it('chặn ngày sai định dạng và chuỗi chèn SQL', async () => {
    const { errors } = await check(GarageDashboardExportDto, {
      from: '01/10/2026',
      to: "2026-10-31'; DROP TABLE kgara_cases;--",
    });
    expect(errors.map((e) => e.property).sort()).toEqual(['from', 'to']);
  });

  it('chấp nhận các reportType hợp lệ', async () => {
    for (const reportType of ['all', 'business', 'cashflow-debts', 'overdue']) {
      const { errors } = await check(GarageDashboardExportDto, { reportType });
      expect(errors).toHaveLength(0);
    }
  });

  it('chặn reportType lạ', async () => {
    const { errors } = await check(GarageDashboardExportDto, {
      reportType: 'everything',
    });
    expect(errors.map((e) => e.property)).toEqual(['reportType']);
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

  it('chuẩn hóa selectedColumns thành mảng và nhận key hợp lệ', async () => {
    const { instance, errors } = await check(GarageCasesExportDto, {
      selectedColumns: 'soChungTu',
    });
    expect(errors).toHaveLength(0);
    expect(instance.selectedColumns).toEqual(['soChungTu']);
  });

  it('nhận các cột tùy chọn (thuế GTGT, ngày tạo, quy tắc loại trừ)', async () => {
    const { errors } = await check(GarageCasesExportDto, {
      selectedColumns: ['vatAmount', 'createdAt', 'exclusionRules'],
    });
    expect(errors).toHaveLength(0);
  });

  it('chặn key cột không nằm trong danh sách xuất', async () => {
    const { errors } = await check(GarageCasesExportDto, {
      selectedColumns: ['soChungTu', 'DROP TABLE'],
    });
    expect(errors.map((e) => e.property)).toEqual(['selectedColumns']);
  });
});
