import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateProcurementRequestDto } from './procurement-request.dto';

const line = {
  lineType: 'GOODS',
  itemName: 'Ốc vít',
  qtyRequested: 2,
};

function base(extra: Record<string, unknown> = {}) {
  return {
    requestDate: '2026-11-06',
    lines: [line],
    ...extra,
  };
}

describe('CreateProcurementRequestDto - chi nhánh tùy chọn', () => {
  it('hợp lệ khi không gửi branchId', async () => {
    const dto = plainToInstance(CreateProcurementRequestDto, base());
    const errors = await validate(dto);
    expect(errors.filter((e) => e.property === 'branchId')).toHaveLength(0);
  });

  it('hợp lệ khi branchId là UUID', async () => {
    const dto = plainToInstance(
      CreateProcurementRequestDto,
      base({ branchId: '6d37f290-b465-4af1-91b6-265ced4b30bb' }),
    );
    const errors = await validate(dto);
    expect(errors.filter((e) => e.property === 'branchId')).toHaveLength(0);
  });

  it('từ chối khi branchId không phải UUID', async () => {
    const dto = plainToInstance(
      CreateProcurementRequestDto,
      base({ branchId: 'không-phải-uuid' }),
    );
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'branchId')).toBe(true);
  });
});
