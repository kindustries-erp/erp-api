import {
  CASE_SERVICE_SELECT,
  toCaseServiceRow,
} from './case-service-row.mapper';

describe('toCaseServiceRow', () => {
  it('chuỗi số thành number, null giữ null, thiếu số thành 0', () => {
    const row = toCaseServiceRow({
      id: 's1',
      hdPhieuDichVuId: 'h1',
      soChungTu: 'PS1',
      status: '3',
      soLuongHoaDon: '2.50',
      tienChuaThue: '1000000.00',
      sanPhamCode: null,
    });
    expect(row).toMatchObject({
      id: 's1',
      soChungTu: 'PS1',
      status: 3,
      soLuongHoaDon: 2.5,
      tienChuaThue: 1000000,
      tienDichVu: 0,
      sanPhamCode: null,
      bienSoXe: null,
    });
  });

  it('SELECT không lấy raw_data', () => {
    expect(CASE_SERVICE_SELECT.join(' ')).not.toContain('raw_data');
  });
});
