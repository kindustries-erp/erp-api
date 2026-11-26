import type { CaseDashboardCaseItemDto } from '../dto/case-dashboard.types';
import { CaseStatus } from '../../cases-garage/entities/case-garage.enums';
import {
  groupCasesByVehicle,
  toVehicleItemDto,
} from './case-dashboard-vehicle.mapper';

const item = (
  over: Partial<CaseDashboardCaseItemDto>,
): CaseDashboardCaseItemDto => ({
  id: 'c1',
  caseCode: 'GN-PDV2611-0025',
  licensePlate: '51B-756.95',
  vehicleKey: '51B75695',
  customerName: 'TRƯƠNG XUÂN BỈNH',
  voucherCustomerName: null,
  status: CaseStatus.QUOTED,
  stage: 'quotation',
  classification: 'OJ_NGOAI',
  receivedAt: null,
  completedAt: null,
  amount: 100,
  ...over,
});

describe('case-dashboard-vehicle.mapper', () => {
  describe('toVehicleItemDto', () => {
    it('hai lệnh cùng xe thành một dòng: số lệnh, mã phiếu, tiền cộng theo lệnh', () => {
      const dto = toVehicleItemDto('51B75695', [
        item({ id: 'c1', caseCode: 'GN-PDV2611-0025', amount: 100 }),
        item({ id: 'c2', caseCode: 'GN-PDV2611-0024', amount: 250 }),
      ]);

      expect(dto.caseCount).toBe(2);
      expect(dto.caseCodes).toEqual(['GN-PDV2611-0025', 'GN-PDV2611-0024']);
      expect(dto.amount).toBe(350);
      expect(dto.cases).toHaveLength(2);
      expect(dto.vehicleKey).toBe('51B75695');
    });

    it('biển số và khách hàng lấy từ lệnh mới nhất có giá trị', () => {
      const dto = toVehicleItemDto('X', [
        item({ licensePlate: null, customerName: null }),
        item({ licensePlate: '51B-756.95', customerName: 'Khách A' }),
      ]);

      expect(dto.licensePlate).toBe('51B-756.95');
      expect(dto.customerName).toBe('Khách A');
    });

    it('latestAt là mốc lớn nhất của (hoàn thành, nếu không có thì tiếp nhận)', () => {
      const dto = toVehicleItemDto('X', [
        item({ receivedAt: '2026-11-03T00:00:00.000Z' }),
        item({
          receivedAt: '2026-11-01T00:00:00.000Z',
          completedAt: '2026-11-10T00:00:00.000Z',
        }),
      ]);

      expect(dto.latestAt).toBe('2026-11-10T00:00:00.000Z');
    });

    it('không có mốc nào thì latestAt là null', () => {
      expect(toVehicleItemDto('X', [item({})]).latestAt).toBeNull();
    });
  });

  describe('groupCasesByVehicle', () => {
    it('nhóm theo khóa xe và giữ thứ tự lệnh trong nhóm', () => {
      const grouped = groupCasesByVehicle([
        item({ id: 'a', vehicleKey: 'K1' }),
        item({ id: 'b', vehicleKey: 'K2' }),
        item({ id: 'c', vehicleKey: 'K1' }),
      ]);

      expect(grouped.get('K1')?.map((c) => c.id)).toEqual(['a', 'c']);
      expect(grouped.get('K2')?.map((c) => c.id)).toEqual(['b']);
    });
  });
});
