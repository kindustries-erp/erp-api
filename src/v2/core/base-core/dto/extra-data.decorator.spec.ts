import { validate } from 'class-validator';
import { ExtraDataField } from './extra-data.decorator';

class ProbeDto {
  @ExtraDataField()
  extraData?: Record<string, unknown>;
}

const check = async (value: unknown) => {
  const dto = new ProbeDto();
  if (value !== undefined) dto.extraData = value as Record<string, unknown>;
  return validate(dto);
};

describe('ExtraDataField', () => {
  it('bỏ qua khi client không gửi (tương thích client cũ)', async () => {
    expect(await check(undefined)).toHaveLength(0);
  });

  it('chấp nhận object hợp lệ', async () => {
    expect(await check({ note: 'x' })).toHaveLength(0);
  });

  it('từ chối mảng và chuỗi', async () => {
    expect(await check([1])).not.toHaveLength(0);
    expect(await check('x')).not.toHaveLength(0);
  });

  it('từ chối key bị cấm', async () => {
    expect(await check({ constructor: 1 })).not.toHaveLength(0);
  });
});
