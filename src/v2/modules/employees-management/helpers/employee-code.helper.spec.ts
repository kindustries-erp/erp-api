import {
  nextEmployeeCode,
  normalizeEmployeeCode,
} from './employee-code.helper';

describe('employee-code.helper', () => {
  it('normalizeEmployeeCode bỏ khoảng trắng và viết hoa', () => {
    expect(normalizeEmployeeCode('  nv-007 ')).toBe('NV-007');
  });

  it('nextEmployeeCode bắt đầu từ NV-001 khi chưa có mã nào', () => {
    expect(nextEmployeeCode([])).toBe('NV-001');
  });

  it('nextEmployeeCode lấy số lớn nhất, bỏ qua mã không có số', () => {
    expect(nextEmployeeCode(['NV-001', 'NV-009', 'ABC', ''])).toBe('NV-010');
  });

  it('nextEmployeeCode vượt 999 vẫn tăng đúng', () => {
    expect(nextEmployeeCode(['NV-999'])).toBe('NV-1000');
  });
});
