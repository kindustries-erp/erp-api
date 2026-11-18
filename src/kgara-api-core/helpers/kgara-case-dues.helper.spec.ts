import { getCaseReceivableDues } from './kgara-case-dues.helper';

describe('getCaseReceivableDues', () => {
  it('phiếu không bảo hiểm: KH = số ròng, BH = 0', () => {
    expect(getCaseReceivableDues({}, 1000)).toEqual({ dueKH: 1000, dueBH: 0 });
  });

  it('dùng TienThanhToanKH/BH khi có', () => {
    expect(
      getCaseReceivableDues(
        { XeLamBaoHiem: true, TienThanhToanKH: 200, TienThanhToanBH: 800 },
        1000,
      ),
    ).toEqual({ dueKH: 200, dueBH: 800 });
  });

  it('xe bảo hiểm thiếu TienThanhToanBH: lấy TienBaoHiemDuyet, KH = phần còn lại', () => {
    expect(
      getCaseReceivableDues(
        { XeLamBaoHiem: true, TienBaoHiemDuyet: 700 },
        1000,
      ),
    ).toEqual({ dueKH: 300, dueBH: 700 });
  });

  it('TienBaoHiemDuyet bị bỏ qua khi không phải xe bảo hiểm', () => {
    expect(getCaseReceivableDues({ TienBaoHiemDuyet: 700 }, 1000)).toEqual({
      dueKH: 1000,
      dueBH: 0,
    });
  });

  it('raw null và giá trị không hợp lệ', () => {
    expect(getCaseReceivableDues(null, null)).toEqual({ dueKH: 0, dueBH: 0 });
    expect(
      getCaseReceivableDues({ XeLamBaoHiem: true, TienThanhToanBH: 'x' }, 500),
    ).toEqual({ dueKH: 500, dueBH: 0 });
  });
});
