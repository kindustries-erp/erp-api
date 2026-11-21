import { normalizePlate, normalizedPlateSql } from './license-plate';

describe('normalizePlate', () => {
  it.each([
    ['51a-123.45 ', '51A12345'],
    ['51A-123.45', '51A12345'],
    ['30G-258.46', '30G25846'],
    ['29-MĐ1 123.45', '29MD112345'],
    ['29-mđ1 123.45', '29MD112345'],
    ['  51B/756_95  ', '51B75695'],
    ['Ắ-Ế', 'AE'],
  ])('%j → %j', (input, expected) => {
    expect(normalizePlate(input)).toBe(expected);
  });

  it.each([[null], [undefined], [''], ['---'], [' . - ']])(
    '%j → chuỗi rỗng',
    (input) => {
      expect(normalizePlate(input)).toBe('');
    },
  );

  it('các cách viết cùng một biển cho cùng kết quả', () => {
    const variants = ['51D88801', '51D-888.01', '51d 888 01', '51D.888-01'];
    expect(new Set(variants.map((v) => normalizePlate(v))).size).toBe(1);
  });
});

describe('normalizedPlateSql', () => {
  it('bọc TRANSLATE → UPPER → REGEXP_REPLACE giữ A-Z0-9', () => {
    const sql = normalizedPlateSql('c.bien_so_xe');

    expect(sql).toContain('TRANSLATE(c.bien_so_xe,');
    expect(sql).toContain('REGEXP_REPLACE(UPPER(TRANSLATE(');
    expect(sql).toContain("'[^A-Z0-9]', '', 'g'");
  });

  it('không truyền cột nào thì báo lỗi', () => {
    expect(() => normalizedPlateSql()).toThrow('cần ít nhất một cột');
  });

  it('bảng ánh xạ có số chữ nguồn bằng số chữ đích (TRANSLATE theo vị trí)', () => {
    const [, from, to] = /TRANSLATE\([^,]+, '([^']+)', '([^']+)'\)/.exec(
      normalizedPlateSql('license_plate'),
    ) as RegExpExecArray;

    expect([...from]).toHaveLength([...to].length);
    expect(to).toMatch(/^[A-Za-z]+$/);
  });

  it('phủ cả chữ La-tinh có dấu ngoài tiếng Việt (É, Ñ, Ç, Ü) như bản TypeScript', () => {
    const [, from, to] = /TRANSLATE\([^,]+, '([^']+)', '([^']+)'\)/.exec(
      normalizedPlateSql('license_plate'),
    ) as RegExpExecArray;
    const map = new Map([...from].map((ch, i) => [ch, [...to][i]]));

    expect(map.get('É')).toBe('E');
    expect(map.get('Ñ')).toBe('N');
    expect(map.get('ç')).toBe('C');
    expect(map.get('Ü')).toBe('U');
    expect(normalizePlate('30É-Ñ12.34')).toBe('30EN1234');
    expect(from).not.toContain("'");
  });

  it('ánh xạ Đ/đ sang D và chữ có dấu sang chữ gốc, khớp bản TypeScript', () => {
    const [, from, to] = /TRANSLATE\([^,]+, '([^']+)', '([^']+)'\)/.exec(
      normalizedPlateSql('license_plate'),
    ) as RegExpExecArray;
    const map = new Map([...from].map((ch, i) => [ch, [...to][i]]));

    expect(map.get('Đ')).toBe('D');
    expect(map.get('đ')).toBe('D');
    for (const [ch, base] of map) {
      expect(normalizePlate(ch)).toBe(base);
    }
  });

  it('nhiều cột: lấy cột đầu có giá trị, nhận đường dẫn thuộc tính camelCase', () => {
    const sql = normalizedPlateSql('v.licensePlate', 'c.bienSoXe');

    expect(sql).toContain(
      "TRANSLATE(COALESCE(v.licensePlate, c.bienSoXe, ''),",
    );
  });

  it('nhận định danh có nháy kép (alias trùng từ khóa như "case")', () => {
    expect(normalizedPlateSql('"case"."bien_so_xe"')).toContain(
      'TRANSLATE("case"."bien_so_xe",',
    );
  });

  it.each(['c.bien_so_xe; DROP TABLE x', "a'b", 'c.a.b', '1abc', ''])(
    'từ chối cột không an toàn: %j',
    (col) => {
      expect(() => normalizedPlateSql(col)).toThrow('cột không hợp lệ');
    },
  );
});
