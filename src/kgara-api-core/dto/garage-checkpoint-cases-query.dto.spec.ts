import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GarageCheckpointCasesQueryDto } from './garage-checkpoint-cases-query.dto';

const valid = {
  date_from: '2026-01-01',
  date_to: '2026-12-31',
};

async function errorsOf(input: Record<string, unknown>) {
  const dto = plainToInstance(GarageCheckpointCasesQueryDto, input);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errors.map((e) => e.property);
}

describe('GarageCheckpointCasesQueryDto', () => {
  it('chấp nhận tham số hợp lệ đúng như frontend gửi', async () => {
    expect(
      await errorsOf({
        ...valid,
        page: '2',
        pageSize: '20',
        payment_status: 'unpaid',
        sort_order: 'ASC',
      }),
    ).toEqual([]);
  });

  it('thiếu date_from hoặc date_to thì báo lỗi đúng trường', async () => {
    expect(await errorsOf({ date_to: '2026-12-31' })).toEqual(['date_from']);
    expect(await errorsOf({ date_from: '2026-01-01' })).toEqual(['date_to']);
  });

  it('ngày không hợp lệ bị từ chối', async () => {
    expect(await errorsOf({ ...valid, date_from: 'abc' })).toEqual([
      'date_from',
    ]);
  });

  it('payment_status và sort_order ngoài danh sách bị từ chối', async () => {
    const props = await errorsOf({
      ...valid,
      payment_status: 'hack',
      sort_order: 'DROP',
    });
    expect(props.sort()).toEqual(['payment_status', 'sort_order']);
  });

  it('page không phải số nguyên dương bị từ chối', async () => {
    expect(await errorsOf({ ...valid, page: '0' })).toEqual(['page']);
    expect(await errorsOf({ ...valid, pageSize: 'x' })).toEqual(['pageSize']);
  });

  it('tham số lạ bị từ chối (forbidNonWhitelisted)', async () => {
    expect(await errorsOf({ ...valid, foo: 'bar' })).toEqual(['foo']);
  });
});
