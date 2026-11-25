import { BadRequestException } from '@nestjs/common';
import { parseErpBranchHeader } from './erp-branch-id.decorator';

describe('parseErpBranchHeader', () => {
  const id = '3f1c2a4b-5d6e-4f70-8a9b-0c1d2e3f4a5b';

  it('trả undefined khi không gửi hoặc chuỗi rỗng', () => {
    expect(parseErpBranchHeader(undefined)).toBeUndefined();
    expect(parseErpBranchHeader('')).toBeUndefined();
    expect(parseErpBranchHeader('   ')).toBeUndefined();
  });

  it('trả UUID hợp lệ (cắt khoảng trắng, lấy phần tử đầu nếu mảng)', () => {
    expect(parseErpBranchHeader(` ${id} `)).toBe(id);
    expect(parseErpBranchHeader([id, 'x'])).toBe(id);
  });

  it('ném 400 khi không phải UUID (ví dụ mã KGara cũ)', () => {
    expect(() => parseErpBranchHeader('CN-01')).toThrow(BadRequestException);
  });
});
