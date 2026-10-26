import { buildUniqueSheetName } from './sheet-name.util';

describe('buildUniqueSheetName', () => {
  it('bỏ ký tự cấm của Excel', () => {
    const used = new Set<string>();
    expect(buildUniqueSheetName('VCB - [0123]:*?/\\', used)).toBe('VCB - 0123');
  });

  it('cắt tối đa 31 ký tự', () => {
    const used = new Set<string>();
    const name = buildUniqueSheetName('A'.repeat(40), used);
    expect(name).toHaveLength(31);
  });

  it('thêm hậu tố khi trùng tên (không phân biệt hoa thường)', () => {
    const used = new Set<string>();
    expect(buildUniqueSheetName('Techcombank', used)).toBe('Techcombank');
    expect(buildUniqueSheetName('techcombank', used)).toBe('techcombank (2)');
    expect(buildUniqueSheetName('Techcombank', used)).toBe('Techcombank (3)');
  });

  it('khi trùng và tên dài, vẫn giữ tổng độ dài ≤ 31', () => {
    const used = new Set<string>();
    const long = 'B'.repeat(31);
    buildUniqueSheetName(long, used);
    const second = buildUniqueSheetName(long, used);
    expect(second.length).toBeLessThanOrEqual(31);
    expect(second.endsWith(' (2)')).toBe(true);
  });

  it('tên rỗng sau khi làm sạch dùng "Sheet"', () => {
    const used = new Set<string>();
    expect(buildUniqueSheetName('[]:', used)).toBe('Sheet');
  });
});
