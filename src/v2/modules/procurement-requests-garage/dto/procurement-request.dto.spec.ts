import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateProcurementRequestDto,
  UpdateProcurementRequestHeaderDto,
} from './procurement-request.dto';

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

describe('UpdateProcurementRequestHeaderDto - chi nhánh liên kết và tên sửa cục bộ', () => {
  const props = (dto: object, ...names: string[]) =>
    validate(dto).then((errors) =>
      errors.filter((e) => names.includes(e.property)),
    );

  it('hợp lệ khi gửi branchId UUID kèm branchName', async () => {
    const dto = plainToInstance(UpdateProcurementRequestHeaderDto, {
      branchId: '6d37f290-b465-4af1-91b6-265ced4b30bb',
      branchName: 'Tên riêng',
    });
    expect(await props(dto, 'branchId', 'branchName')).toHaveLength(0);
  });

  it('cho phép branchId null để bỏ liên kết, không gửi gì thì hợp lệ', async () => {
    const withNull = plainToInstance(UpdateProcurementRequestHeaderDto, {
      branchId: null,
      branchName: null,
    });
    expect(await props(withNull, 'branchId', 'branchName')).toHaveLength(0);
    const empty = plainToInstance(UpdateProcurementRequestHeaderDto, {});
    expect(await props(empty, 'branchId', 'branchName')).toHaveLength(0);
  });

  it('từ chối branchId không phải UUID và branchName quá 255 ký tự', async () => {
    const dto = plainToInstance(UpdateProcurementRequestHeaderDto, {
      branchId: 'abc',
      branchName: 'x'.repeat(256),
    });
    const errors = await props(dto, 'branchId', 'branchName');
    expect(errors.map((e) => e.property).sort()).toEqual([
      'branchId',
      'branchName',
    ]);
  });
});
