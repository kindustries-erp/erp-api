import {
  groupCheckpointCasesByVehicle,
  toCheckpointCaseItem,
  toCheckpointVehicleItem,
  type CheckpointCaseItem,
} from './garage-checkpoint-case-item.mapper';

const entity = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  soChungTu: 'GN-PDV2611-0025',
  bienSoXe: '51B-756.95',
  khachHangName: 'TRƯƠNG XUÂN BỈNH',
  tienCoThue: 1000,
  tienDaThanhToan: 400,
  tienConPhaiThanhToan: 600,
  doanhThu: 900,
  chiPhi: 300,
  loiNhuan: 600,
  classification: 'OJ_NGOAI',
  ngayPhatSinh: new Date('2026-11-05T00:00:00Z'),
  ngayHoanThanhCongViec: null,
  createdAt: new Date('2026-11-01T00:00:00Z'),
  rawData: {},
  ...over,
});

const item = (over: Partial<CheckpointCaseItem> = {}): CheckpointCaseItem => ({
  ...toCheckpointCaseItem(entity()),
  ...over,
});

describe('garage-checkpoint-case-item.mapper', () => {
  describe('toCheckpointCaseItem', () => {
    it('thêm khóa xe chuẩn hóa từ biển số (khác dấu vẫn cùng khóa)', () => {
      expect(toCheckpointCaseItem(entity()).vehicleKey).toBe('51B75695');
      expect(
        toCheckpointCaseItem(entity({ bienSoXe: '51b 756.95' })).vehicleKey,
      ).toBe('51B75695');
    });

    it('phiếu không biển thì khóa xe là id phiếu', () => {
      expect(
        toCheckpointCaseItem(entity({ id: 'solo', bienSoXe: null })).vehicleKey,
      ).toBe('solo');
    });

    it('tiền ưu tiên lãi gộp (grossProfit), rồi cột phiếu', () => {
      const withGp = toCheckpointCaseItem(
        entity({
          grossProfit: { doanhThu: 5000, chiPhi: 2000, loiNhuan: 3000 },
        }),
      );
      expect(withGp).toMatchObject({
        doanhThu: 5000,
        chiPhi: 2000,
        loiNhuan: 3000,
      });

      const withoutGp = toCheckpointCaseItem(entity());
      expect(withoutGp).toMatchObject({
        doanhThu: 900,
        chiPhi: 300,
        loiNhuan: 600,
      });
    });

    it('chuẩn hóa phân loại: mã GN- hoặc OJ thành OJ_NGOAI, mã lạ thành KHAC', () => {
      expect(
        toCheckpointCaseItem(entity({ classification: null })).classification,
      ).toBe('OJ_NGOAI'); // số chứng từ bắt đầu GN-
      expect(
        toCheckpointCaseItem(
          entity({ classification: 'LẠ', soChungTu: 'GR-1' }),
        ).classification,
      ).toBe('KHAC');
      expect(
        toCheckpointCaseItem(
          entity({ classification: 'KY_GUI', soChungTu: 'GR-1' }),
        ).classification,
      ).toBe('KY_GUI_NOI_BO');
    });

    it('hasInvoice theo TienThueKH trong rawData', () => {
      expect(
        toCheckpointCaseItem(entity({ rawData: { TienThueKH: 100 } }))
          .hasInvoice,
      ).toBe(true);
      expect(toCheckpointCaseItem(entity()).hasInvoice).toBe(false);
    });

    it('ngayPhatSinh rơi về createdAt khi thiếu', () => {
      const out = toCheckpointCaseItem(entity({ ngayPhatSinh: null }));
      expect(out.ngayPhatSinh).toEqual(new Date('2026-11-01T00:00:00Z'));
    });
  });

  describe('toCheckpointVehicleItem', () => {
    it('hai lệnh cùng xe: số lệnh, mã phiếu, tiền cộng theo lệnh', () => {
      const a = item({ id: 'a', soChungTu: 'GN-0025', tienCoThue: 100 });
      const b = item({ id: 'b', soChungTu: 'GN-0024', tienCoThue: 250 });

      const v = toCheckpointVehicleItem('51B75695', [a, b]);

      expect(v.caseCount).toBe(2);
      expect(v.soChungTus).toEqual(['GN-0025', 'GN-0024']);
      expect(v.tienCoThue).toBe(350);
      expect(v.tienDaThanhToan).toBe(800);
      expect(v.cases).toEqual([a, b]);
    });

    it('biển số, khách và phân loại lấy từ lệnh mới nhất; hasInvoice nếu có lệnh nào có hóa đơn', () => {
      const v = toCheckpointVehicleItem('K', [
        item({
          bienSoXe: null,
          khachHangName: null,
          classification: 'KHAC',
          hasInvoice: false,
        }),
        item({
          bienSoXe: '51B-756.95',
          khachHangName: 'Khách A',
          classification: 'OJ_NGOAI',
          hasInvoice: true,
        }),
      ]);

      expect(v.bienSoXe).toBe('51B-756.95');
      expect(v.khachHangName).toBe('Khách A');
      expect(v.classification).toBe('KHAC');
      expect(v.hasInvoice).toBe(true);
    });

    it('ngày lấy mốc mới nhất của các lệnh, bỏ qua null', () => {
      const v = toCheckpointVehicleItem('K', [
        item({
          ngayHoanThanhCongViec: null,
          ngayPhatSinh: new Date('2026-11-02T00:00:00Z'),
        }),
        item({
          ngayHoanThanhCongViec: new Date('2026-11-10T00:00:00Z'),
          ngayPhatSinh: new Date('2026-11-08T00:00:00Z'),
        }),
      ]);

      expect(v.ngayHoanThanhCongViec).toEqual(new Date('2026-11-10T00:00:00Z'));
      expect(v.ngayPhatSinh).toEqual(new Date('2026-11-08T00:00:00Z'));
    });
  });

  describe('groupCheckpointCasesByVehicle', () => {
    it('nhóm theo khóa xe và giữ thứ tự lệnh trong nhóm', () => {
      const grouped = groupCheckpointCasesByVehicle([
        item({ id: 'a', vehicleKey: 'K1' }),
        item({ id: 'b', vehicleKey: 'K2' }),
        item({ id: 'c', vehicleKey: 'K1' }),
      ]);

      expect(grouped.get('K1')?.map((c) => c.id)).toEqual(['a', 'c']);
      expect(grouped.get('K2')?.map((c) => c.id)).toEqual(['b']);
    });
  });
});
