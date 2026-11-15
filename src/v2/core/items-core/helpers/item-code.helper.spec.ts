import {
  codeCandidates,
  formatSequenceCode,
  itemTypeOfCode,
  normalizeItemCode,
  sequencePattern,
  toItemType,
  withTypePrefix,
} from './item-code.helper';

const TYPES = ['AA', 'BB'] as const;

describe('item-code.helper', () => {
  it('normalizeItemCode: chữ hoa, bỏ khoảng trắng và ký tự lạ, cắt 128 ký tự', () => {
    expect(normalizeItemCode('  pt 90915#a/b ')).toBe('PT90915A/B');
    expect(normalizeItemCode(null)).toBe('');
    expect(normalizeItemCode('x'.repeat(200))).toHaveLength(128);
  });

  it('toItemType: nhận nhóm hợp lệ không phân biệt hoa thường, còn lại về mặc định', () => {
    expect(toItemType(' bb ', TYPES, 'AA')).toBe('BB');
    expect(toItemType('zz', TYPES, 'AA')).toBe('AA');
    expect(toItemType(undefined, TYPES, 'AA')).toBe('AA');
  });

  it('itemTypeOfCode: suy nhóm từ tiền tố, mã không tiền tố trả null', () => {
    expect(itemTypeOfCode('bb-000001', TYPES)).toBe('BB');
    expect(itemTypeOfCode('90915', TYPES)).toBeNull();
  });

  it('withTypePrefix: gắn tiền tố cho mã gốc, giữ mã đã có tiền tố, mã rỗng trả rỗng', () => {
    expect(withTypePrefix('90915', 'AA', TYPES)).toBe('AA-90915');
    expect(withTypePrefix('bb-7', 'AA', TYPES)).toBe('BB-7');
    expect(withTypePrefix('  ', 'AA', TYPES)).toBe('');
  });

  it('codeCandidates: mã gốc kèm từng tiền tố, mã đã có tiền tố chỉ chính nó', () => {
    expect(codeCandidates('90915', TYPES)).toEqual([
      '90915',
      'AA-90915',
      'BB-90915',
    ]);
    expect(codeCandidates('AA-1', TYPES)).toEqual(['AA-1']);
    expect(codeCandidates(undefined, TYPES)).toEqual([]);
  });

  it('formatSequenceCode và sequencePattern dùng cùng số chữ số', () => {
    const code = formatSequenceCode('AA', 12);
    expect(code).toBe('AA-000012');
    expect(new RegExp(sequencePattern('AA')).exec(code)?.[1]).toBe('000012');
  });
});
