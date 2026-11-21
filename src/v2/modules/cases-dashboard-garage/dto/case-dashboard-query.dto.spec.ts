import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CaseDashboardListQueryDto,
  CaseDashboardOverviewQueryDto,
} from './case-dashboard-query.dto';

async function errorsOf<T extends object>(
  cls: new () => T,
  input: Record<string, unknown>,
): Promise<string[]> {
  const dto = plainToInstance(cls, input);
  const errors = await validate(dto as object, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errors.map((e) => e.property);
}

describe('CaseDashboardOverviewQueryDto (GET /overview)', () => {
  it('không có tham số nào vẫn hợp lệ (mặc định hôm nay và tháng hiện tại)', async () => {
    expect(await errorsOf(CaseDashboardOverviewQueryDto, {})).toEqual([]);
  });

  it('nhận ngày gốc và khoảng ngày cho phễu', async () => {
    expect(
      await errorsOf(CaseDashboardOverviewQueryDto, {
        date: '2026-11-20',
        date_from: '2026-11-01',
        date_to: '2026-11-30',
      }),
    ).toEqual([]);
  });

  it('ngày sai định dạng bị từ chối đúng trường', async () => {
    const props = await errorsOf(CaseDashboardOverviewQueryDto, {
      date: '20/11/2026',
      date_from: '2026-11-1',
    });
    expect(props.sort()).toEqual(['date', 'date_from']);
  });

  it('không nhận tham số của danh sách (stage, page)', async () => {
    const props = await errorsOf(CaseDashboardOverviewQueryDto, {
      stage: 'quotation',
      page: '1',
    });
    expect(props.sort()).toEqual(['page', 'stage']);
  });
});

describe('CaseDashboardListQueryDto (GET /)', () => {
  it('chấp nhận bộ lọc và phân trang hợp lệ', async () => {
    expect(
      await errorsOf(CaseDashboardListQueryDto, {
        date_from: '2026-11-01',
        date_to: '2026-11-30',
        stage: 'quotation',
        classification: 'OJ_NGOAI',
        page: '2',
        pageSize: '100',
      }),
    ).toEqual([]);
  });

  it('pageSize tối đa 100', async () => {
    expect(
      await errorsOf(CaseDashboardListQueryDto, { pageSize: '101' }),
    ).toEqual(['pageSize']);
  });

  it('stage và classification ngoài danh sách bị từ chối', async () => {
    const props = await errorsOf(CaseDashboardListQueryDto, {
      stage: 'hack',
      classification: 'X',
    });
    expect(props.sort()).toEqual(['classification', 'stage']);
  });

  it('page không phải số nguyên dương bị từ chối', async () => {
    expect(await errorsOf(CaseDashboardListQueryDto, { page: '0' })).toEqual([
      'page',
    ]);
  });
});
