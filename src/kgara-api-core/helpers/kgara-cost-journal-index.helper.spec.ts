import { KgaraCostEnricherHelper } from './kgara-cost-enricher.helper';

describe('KgaraCostEnricherHelper – journal index & line cost', () => {
  const journal = [
    {
      TaiKhoanNoCode: '1541',
      ChiPhi: 893000,
      NoiDung: 'Nhớt động cơ 5W-30',
    },
    { TaiKhoanNoCode: '1541', ChiPhi: 65000, NoiDung: 'Chai vệ sinh dầu mỡ' },
  ];

  describe('buildJournalIndex / pickJournal', () => {
    it('ưu tiên khớp theo hdPhieuDichVuId rồi fallback theo số chứng từ', () => {
      const index = KgaraCostEnricherHelper.buildJournalIndex([
        {
          hdPhieuDichVuId: 'HD-1',
          vuViecCode: 'GR-1',
          rawData: { journal_items: journal },
        },
        { hdPhieuDichVuId: 'HD-2', vuViecCode: 'GR-2', rawData: {} },
      ]);

      expect(KgaraCostEnricherHelper.pickJournal(index, 'HD-1', null)).toBe(
        journal,
      );
      expect(KgaraCostEnricherHelper.pickJournal(index, 'HD-X', 'GR-1')).toBe(
        journal,
      );
      expect(
        KgaraCostEnricherHelper.pickJournal(index, 'HD-2', 'GR-2'),
      ).toBeNull();
    });

    it('bỏ qua bản ghi không có journal_items', () => {
      const index = KgaraCostEnricherHelper.buildJournalIndex([
        { hdPhieuDichVuId: 'HD-3', rawData: { journal_items: [] } },
        { hdPhieuDichVuId: 'HD-4', rawData: null },
      ]);
      expect(index.byHdId.size).toBe(0);
      expect(index.byCode.size).toBe(0);
    });
  });

  describe('resolveLineCost', () => {
    it('dùng tongVon đã khớp khi có', () => {
      expect(
        KgaraCostEnricherHelper.resolveLineCost({
          giaVonPhuTung: 190000,
          soLuongHoaDon: 4.7,
          tongVon: 893000,
        }),
      ).toEqual({ unit: 190000, total: 893000 });
    });

    it('fallback đơn giá vốn × số lượng khi chưa có tongVon', () => {
      expect(
        KgaraCostEnricherHelper.resolveLineCost({
          giaVonPhuTung: 65000,
          soLuongHoaDon: 1,
        }),
      ).toEqual({ unit: 65000, total: 65000 });
    });

    it('trả 0 khi dòng chưa có giá vốn', () => {
      expect(
        KgaraCostEnricherHelper.resolveLineCost({ soLuongHoaDon: 1 }),
      ).toEqual({ unit: 0, total: 0 });
    });
  });

  describe('enrichCaseLines + resolveLineCost (phiếu GR-PDV2609-0050)', () => {
    it('khớp journal vào dòng phụ tùng và cho tổng vốn đúng', () => {
      const lines = [
        {
          LoaiSanPhamCode: 'PT',
          SanPhamName: 'Nhớt động cơ 5W-30',
          SoLuongHoaDon: 4.7,
        },
        {
          LoaiSanPhamCode: 'PT',
          SanPhamName: 'Chai vệ sinh dầu mỡ',
          SoLuongHoaDon: 1,
        },
      ];

      const { lines: enriched } = KgaraCostEnricherHelper.enrichCaseLines(
        lines,
        journal,
      );

      const totals = enriched.map(
        (l) => KgaraCostEnricherHelper.resolveLineCost(l).total,
      );
      expect(totals).toEqual([893000, 65000]);
      expect(totals.reduce((a, b) => a + b, 0)).toBe(958000);
    });
  });
});
