import {
  buildCaseDebtOrigins,
  INSURER_UNKNOWN_CODE,
} from './garage-debt-origin.builder';

const base = (over: Record<string, unknown> = {}) =>
  ({
    id: 'c1',
    branchExternalId: 'B1',
    bienSoXe: ' 30A-123.45 ',
    khachHangCode: 'KH1',
    khachHangName: 'An',
    tinhTrangDichVu: 3,
    tenTinhTrangDichVu: 'Kết thúc',
    tienCoThue: 1000,
    chiPhi: 400,
    ngayHoanThanhCongViec: new Date('2026-08-10T03:00:00Z'),
    ngayPhatSinh: new Date('2026-08-01T00:00:00Z'),
    excludeFromReports: false,
    excludeFromDebt: false,
    kgaraDeletedAt: null,
    rawData: {},
    ...over,
  }) as never;

const find = (list: any[], partyType: string) =>
  list.find((o) => o.partyType === partyType);

describe('buildCaseDebtOrigins', () => {
  it('vụ thường: một dòng CUSTOMER bằng số ròng và một dòng SUPPLIER bằng chi phí', () => {
    const out = buildCaseDebtOrigins(base(), null);
    expect(out).toHaveLength(2);
    expect(find(out, 'CUSTOMER')).toMatchObject({
      direction: 'RECEIVABLE',
      originalAmount: 1000,
      partyCode: 'KH1',
      licensePlate: '30A-123.45',
      dueBaseDate: '2026-08-10',
      sourceType: 'CASE',
      sourceId: 'c1',
    });
    expect(find(out, 'SUPPLIER')).toMatchObject({
      direction: 'PAYABLE',
      originalAmount: 400,
    });
  });

  it('chi phí lãi gộp ưu tiên hơn chi phí vụ việc', () => {
    const out = buildCaseDebtOrigins(base(), '650.50');
    expect(find(out, 'SUPPLIER').originalAmount).toBe(650.5);
  });

  it('vụ bảo hiểm tách hai dòng, tổng bằng số phải thu', () => {
    const out = buildCaseDebtOrigins(
      base({ rawData: { XeLamBaoHiem: true, TienBaoHiemDuyet: 300 } }),
      null,
    );
    const ins = find(out, 'INSURER');
    const cus = find(out, 'CUSTOMER');
    expect(ins).toMatchObject({
      partyCode: INSURER_UNKNOWN_CODE,
      originalAmount: 300,
    });
    expect(cus.originalAmount).toBe(700);
    expect(ins.originalAmount + cus.originalAmount).toBe(1000);
  });

  it('phần bảo hiểm bị chặn trên bằng tổng phải thu', () => {
    const out = buildCaseDebtOrigins(
      base({ rawData: { TienThanhToanBH: 5000 } }),
      null,
    );
    expect(find(out, 'INSURER').originalAmount).toBe(1000);
    expect(find(out, 'CUSTOMER').originalAmount).toBe(0);
  });

  it('không đủ điều kiện thì rỗng: đã xóa, loại khỏi công nợ, chưa hoàn tất, trước mốc, thiếu chi nhánh', () => {
    const cases = [
      { kgaraDeletedAt: new Date() },
      { excludeFromDebt: true },
      { excludeFromReports: true },
      { tinhTrangDichVu: 2, tenTinhTrangDichVu: 'Đang sửa' },
      { ngayHoanThanhCongViec: null },
      { ngayHoanThanhCongViec: new Date('2026-06-30T00:00:00Z') },
      { branchExternalId: null },
    ];
    for (const c of cases) {
      expect(buildCaseDebtOrigins(base(c), null)).toEqual([]);
    }
  });

  it('không có chi phí thì không sinh dòng phải trả; tên "hoàn tất" vẫn tính là xong phải thu', () => {
    const out = buildCaseDebtOrigins(
      base({ chiPhi: 0, tinhTrangDichVu: 5, tenTinhTrangDichVu: 'Hoàn tất' }),
      null,
    );
    expect(out.map((o) => o.partyType)).toEqual(['CUSTOMER']);
  });
});
