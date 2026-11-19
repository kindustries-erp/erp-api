import type { KgaraCase } from '@/kgara-api-core/entities/kgara_case.entity';
import {
  customerReceivable,
  insuranceReceivable,
  toCaseListItem,
} from './case-list.mapper';

const base = {
  id: 'c1',
  hdPhieuDichVuId: 'h1',
  soChungTu: 'PS1',
  bienSoXe: '51A',
  khachHangCode: 'KH1',
  khachHangName: 'An',
  branchExternalId: 'b1',
  tinhTrangDichVu: 3,
  tenTinhTrangDichVu: 'Kết thúc',
  classification: null,
  category: null,
  excludeFromReports: false,
  excludeFromDebt: false,
  ngayPhatSinh: new Date('2026-08-01T00:00:00Z'),
  ngayTiepNhan: null,
  ngayHoanThanhCongViec: null,
  doanhThu: null,
  chiPhi: null,
  loiNhuan: null,
  tienCoThue: '1000',
  tienDaThanhToan: '100',
  rawData: {},
} as unknown as KgaraCase;

describe('insuranceReceivable / customerReceivable', () => {
  it('ưu tiên TienThanhToanBH, rồi TienBaoHiemDuyet khi xe làm bảo hiểm', () => {
    expect(insuranceReceivable({ TienThanhToanBH: '300' })).toBe(300);
    expect(
      insuranceReceivable({ XeLamBaoHiem: true, TienBaoHiemDuyet: 200 }),
    ).toBe(200);
    expect(
      insuranceReceivable({ XeLamBaoHiem: false, TienBaoHiemDuyet: 200 }),
    ).toBe(0);
    expect(insuranceReceivable(null)).toBe(0);
  });

  it('phải thu khách hàng: TienThanhToanKH, xe thường thì cả khoản, xe bảo hiểm trừ phần BH', () => {
    expect(customerReceivable({ TienThanhToanKH: 50 }, 1000, 0)).toBe(50);
    expect(customerReceivable({}, 1000, 0)).toBe(1000);
    expect(customerReceivable({ XeLamBaoHiem: true }, 1000, 300)).toBe(700);
    expect(customerReceivable({ XeLamBaoHiem: true }, 100, 300)).toBe(0);
  });
});

describe('toCaseListItem', () => {
  it('chiết khấu: còn phải thu = net đã lưu − RECEIPT (raw thiếu field chiết khấu)', () => {
    const item = toCaseListItem(
      {
        ...base,
        tienCoThue: '5309550',
        tienDaThanhToan: '0',
        rawData: { TienCoThue: 5855800 },
      } as unknown as KgaraCase,
      { receipts: 4769550, payments: 0, hasReceipt: true } as never,
      undefined,
      null,
    );
    expect(item).toMatchObject({
      tienCoThue: 5309550,
      tienDaThanhToan: 4769550,
      tienConPhaiThanhToan: 540000,
    });
  });

  it('không có settlement thì dùng số đã thu trên vụ việc; còn lại kẹp ở 0', () => {
    const item = toCaseListItem(base, undefined, undefined, null);
    expect(item).toMatchObject({
      tienCoThue: 1000,
      tienDaThanhToan: 100,
      tienConPhaiThanhToan: 900,
      tienDaChi: 0,
      linkedInvoiceCount: 0,
    });
    expect(item).not.toHaveProperty('rawData');
  });

  it('có settlement thì lấy RECEIPT/PAYMENT; trả dư không tạo số dư âm', () => {
    const item = toCaseListItem(
      base,
      { receipts: 1500, payments: 400, hasReceipt: true },
      { total: 3, outCount: 2, inCount: 1 },
      null,
    );
    expect(item).toMatchObject({
      tienDaThanhToan: 1500,
      tienConPhaiThanhToan: 0,
      tienDaChi: 400,
      linkedInvoiceCount: 3,
      linkedInvoiceOutCount: 2,
      linkedInvoiceInCount: 1,
    });
  });

  it('chỉ có settlement PAYMENT thì giữ tien_da_thanh_toan đã lưu, không đặt đã thu = 0', () => {
    const item = toCaseListItem(
      base,
      { receipts: 0, payments: 400, hasReceipt: false },
      undefined,
      null,
    );
    expect(item).toMatchObject({
      tienDaThanhToan: 100,
      tienConPhaiThanhToan: 900,
      tienDaChi: 400,
    });
  });

  it('doanh thu, chi phí, lợi nhuận lấy lãi gộp khi vụ việc chưa có; chuỗi 0.00 thành số 0', () => {
    const fromGp = toCaseListItem(base, undefined, undefined, {
      doanhThu: '1000',
      chiPhi: '600',
      loiNhuan: '400',
    });
    expect(fromGp).toMatchObject({
      doanhThu: 1000,
      chiPhi: 600,
      loiNhuan: 400,
      margin: 40,
    });

    const zero = toCaseListItem(
      {
        ...base,
        doanhThu: '0.00',
        chiPhi: '0.00',
        loiNhuan: '0.00',
      } as unknown as KgaraCase,
      undefined,
      undefined,
      null,
    );
    expect(zero).toMatchObject({
      doanhThu: 0,
      chiPhi: 0,
      loiNhuan: 0,
      margin: null,
    });
  });
});
