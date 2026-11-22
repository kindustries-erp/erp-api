import { isLaborUnit } from './kgara-labor-unit.helper';

describe('isLaborUnit (ĐVT công)', () => {
  it.each([
    'Công',
    'công',
    'CÔNG',
    'cõng',
    'cong',
    'Cọng',
    'Công - 1',
    'Công sơn',
    'Công đồng',
    'giờ công',
    'Giờ Công',
    '  Công  ',
    'Công sơn',
    // Unicode dạng tổ hợp (NFD)
    'Công',
  ])('nhận "%s" là công', (unit) => {
    expect(isLaborUnit(unit)).toBe(true);
  });

  it.each([
    'Lần',
    'Xe',
    'Cái',
    'Lượt',
    'C',
    'Cá',
    'Bộ',
    'Lít',
    'Đồng',
    '',
    '   ',
    null,
    undefined,
  ])('không nhận "%s"', (unit) => {
    expect(isLaborUnit(unit as string | null | undefined)).toBe(false);
  });
});
