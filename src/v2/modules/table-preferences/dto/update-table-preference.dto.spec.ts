import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateTablePreferenceDto } from './update-table-preference.dto';
import { TABLE_PREFERENCE_LIMITS } from './table-preference-limits';

const check = async (body: unknown) =>
  validate(plainToInstance(UpdateTablePreferenceDto, body));

describe('UpdateTablePreferenceDto limits', () => {
  it('chấp nhận cấu hình hợp lệ', async () => {
    const errors = await check({
      columns: {
        visibility: { notes: false },
        order: ['a', 'b'],
        sizing: { a: 150 },
      },
      views: {
        activeKey: 'all',
        filterKey: 'deleted',
        customViews: [
          {
            key: 'k',
            label: 'L',
            baseKey: 'all',
            visibility: { a: true },
            order: ['a'],
          },
        ],
      },
    });
    expect(errors).toHaveLength(0);
  });

  it('từ chối order vượt số phần tử tối đa', async () => {
    const order = Array.from(
      { length: TABLE_PREFERENCE_LIMITS.orderMax + 1 },
      (_, i) => `c${i}`,
    );
    expect(await check({ columns: { order } })).not.toHaveLength(0);
  });

  it('từ chối record visibility vượt số khóa tối đa', async () => {
    const visibility = Object.fromEntries(
      Array.from(
        { length: TABLE_PREFERENCE_LIMITS.recordKeysMax + 1 },
        (_, i) => [`c${i}`, true],
      ),
    );
    expect(await check({ columns: { visibility } })).not.toHaveLength(0);
  });

  it('từ chối visibility có giá trị không phải boolean', async () => {
    expect(
      await check({ columns: { visibility: { a: 'yes' } } }),
    ).not.toHaveLength(0);
  });

  it('từ chối customViews vượt số lượng tối đa', async () => {
    const view = {
      key: 'k',
      label: 'L',
      baseKey: 'all',
      visibility: {},
      order: [],
    };
    const customViews = Array.from(
      { length: TABLE_PREFERENCE_LIMITS.customViewsMax + 1 },
      () => view,
    );
    expect(await check({ views: { customViews } })).not.toHaveLength(0);
  });
});
