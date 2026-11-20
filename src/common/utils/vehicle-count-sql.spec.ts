import {
  countDistinctVehicles,
  countVehiclesSql,
  vehicleKey,
  vehicleKeySql,
} from './vehicle-count-sql';

describe('vehicleKey (chuẩn hóa biển số)', () => {
  it('gộp các dạng ghi khác nhau của cùng một biển', () => {
    expect(vehicleKey('30G-258.46', 'id-1')).toBe('30G25846');
    expect(vehicleKey('30g25846', 'id-2')).toBe('30G25846');
    expect(vehicleKey(' 30G 258.46 ', 'id-3')).toBe('30G25846');
  });

  it('bỏ dấu tiếng Việt, Đ thành D', () => {
    expect(vehicleKey('29-MĐ1 123.45', 'id-4')).toBe('29MD112345');
    expect(vehicleKey('29-md1 123.45', 'id-5')).toBe('29MD112345');
  });

  it('phiếu không có biển (null, undefined, rỗng, chỉ ký tự rác) khóa theo id phiếu', () => {
    expect(vehicleKey(null, 'case-a')).toBe('case-a');
    expect(vehicleKey(undefined, 'case-b')).toBe('case-b');
    expect(vehicleKey('', 'case-c')).toBe('case-c');
    expect(vehicleKey('--- ..', 'case-d')).toBe('case-d');
  });
});

describe('countDistinctVehicles', () => {
  it('một xe có nhiều lệnh chỉ đếm một lần; phiếu thiếu biển là xe riêng', () => {
    const items = [
      { plate: '51A-123.45', id: 'c1' },
      { plate: '51a12345', id: 'c2' },
      { plate: '51A12345', id: 'c3' },
      { plate: null, id: 'c4' },
      { plate: '', id: 'c5' },
      { plate: '29B-999.99', id: 'c6' },
    ];
    expect(countDistinctVehicles(items)).toBe(4);
  });

  it('danh sách rỗng trả 0', () => {
    expect(countDistinctVehicles([])).toBe(0);
  });
});

describe('vehicleKeySql', () => {
  it('sinh biểu thức chuẩn hóa cho cột V1 và V2', () => {
    const v1 = vehicleKeySql('c', 'bien_so_xe');
    expect(v1).toContain('TRANSLATE(c.bien_so_xe,');
    expect(v1).toContain('REGEXP_REPLACE');
    expect(v1).toContain("'[^A-Z0-9]'");
    expect(v1).toContain('c.id::text');

    const v2 = vehicleKeySql('g', 'license_plate');
    expect(v2).toContain('TRANSLATE(g.license_plate,');
  });

  it('từ chối alias không an toàn', () => {
    expect(() => vehicleKeySql('c; DROP TABLE x', 'bien_so_xe')).toThrow(
      /alias không hợp lệ/,
    );
  });

  it('từ chối cột biển ngoài whitelist', () => {
    expect(() =>
      vehicleKeySql('c', 'bien_so_xe; DROP TABLE x' as 'bien_so_xe'),
    ).toThrow(/cột biển không được phép/);
  });
});

describe('countVehiclesSql', () => {
  const key = vehicleKeySql('c', 'bien_so_xe');

  it('không điều kiện: COUNT(DISTINCT khóa)', () => {
    expect(countVehiclesSql(key)).toBe(`COUNT(DISTINCT ${key})`);
  });

  it('có điều kiện: đếm distinct khóa của các phiếu thỏa điều kiện', () => {
    expect(countVehiclesSql(key, "c.status = 'COMPLETED'")).toBe(
      `COUNT(DISTINCT CASE WHEN c.status = 'COMPLETED' THEN ${key} END)`,
    );
  });
});
