import {
  applyDetailVehicle,
  applyListVehicle,
  KgaraCaseVehicleTarget,
} from './kgara-case-vehicle.helper';

const empty = (): KgaraCaseVehicleTarget => ({
  soKhung: null,
  hangXeCode: null,
  hangXeName: null,
  dongXeCode: null,
  dongXeName: null,
  namSanXuat: null,
});

describe('applyListVehicle', () => {
  it('ghi hãng/dòng từ list, bỏ qua chuỗi rỗng và khoảng trắng', () => {
    const t = { ...empty(), dongXeCode: 'C300', dongXeName: 'C300' };
    applyListVehicle(t, {
      MaHangSanXuat: 'Mercedes-Benz',
      TenHdHangSanXuat: ' Mercedes-Benz ',
      MaDongXe: '',
      TenHdDongXe: '  ',
    });
    expect(t).toMatchObject({
      hangXeCode: 'Mercedes-Benz',
      hangXeName: 'Mercedes-Benz',
      dongXeCode: 'C300',
      dongXeName: 'C300',
    });
  });
});

describe('applyDetailVehicle', () => {
  it('điền từ HoSoPhuongTien, số khung ưu tiên key gốc rồi HoSoPhuongTien', () => {
    const t = empty();
    applyDetailVehicle(t, {
      SoKhung: '',
      HoSoPhuongTien: {
        SoKhung: 'VIN-1',
        ThuongHieuName: 'TOYOTA',
        HdDongXeCode: 'Fortuner',
        HdDongXeName: 'Fortuner',
        NamSanXuat: 2019,
      },
    });
    expect(t).toEqual({
      soKhung: 'VIN-1',
      hangXeCode: null,
      hangXeName: 'TOYOTA',
      dongXeCode: 'Fortuner',
      dongXeName: 'Fortuner',
      namSanXuat: 2019,
    });
    applyDetailVehicle(t, {
      SoKhung: 'VIN-ROOT',
      HoSoPhuongTien: { SoKhung: 'VIN-2' },
    });
    expect(t.soKhung).toBe('VIN-ROOT');
  });

  it('hãng/dòng đã có từ list thì detail không ghi đè', () => {
    const t = { ...empty(), hangXeName: 'Toyota Việt Nam', dongXeCode: 'FOR' };
    applyDetailVehicle(t, {
      HoSoPhuongTien: { ThuongHieuName: 'TOYOTA', HdDongXeCode: 'Fortuner' },
    });
    expect(t.hangXeName).toBe('Toyota Việt Nam');
    expect(t.dongXeCode).toBe('FOR');
  });

  it('thiếu HoSoPhuongTien hoặc năm không hợp lệ thì giữ giá trị cũ', () => {
    const t = { ...empty(), hangXeName: 'Volvo', namSanXuat: 2021 };
    applyDetailVehicle(t, {});
    applyDetailVehicle(t, { HoSoPhuongTien: { NamSanXuat: 0 } });
    expect(t.hangXeName).toBe('Volvo');
    expect(t.namSanXuat).toBe(2021);
  });
});
