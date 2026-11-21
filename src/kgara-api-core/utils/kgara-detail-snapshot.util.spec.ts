import {
  buildDetailSnapshot,
  isDetailStale,
} from './kgara-detail-snapshot.util';

describe('kgara-detail-snapshot.util', () => {
  const base = {
    tinhTrangDichVu: 3,
    tienCoThue: '1000000.00',
    ngayHoanThanhCongViec: new Date('2026-09-03T00:00:00.000Z'),
  };

  it('phiếu chưa có snapshot không bị coi là cũ', () => {
    expect(isDetailStale({ ...base, rawData: {} })).toBe(false);
  });

  it('không cũ khi list-level không đổi', () => {
    const rawData = { __detailSnapshot: buildDetailSnapshot(base) };
    expect(isDetailStale({ ...base, rawData })).toBe(false);
  });

  it('cũ khi đổi trạng thái, số tiền hoặc ngày hoàn thành (AC-9)', () => {
    const rawData = { __detailSnapshot: buildDetailSnapshot(base) };
    expect(isDetailStale({ ...base, tinhTrangDichVu: 4, rawData })).toBe(true);
    expect(isDetailStale({ ...base, tienCoThue: 2000000, rawData })).toBe(true);
    expect(
      isDetailStale({
        ...base,
        ngayHoanThanhCongViec: new Date('2026-09-05T00:00:00.000Z'),
        rawData,
      }),
    ).toBe(true);
  });
});
