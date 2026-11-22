import { CaseStatus } from '../../cases-garage/entities/case-garage.enums';
import {
  classOfCase,
  percentOf,
  stageOfStatus,
  toCaseDashboardItemDto,
  toFunnelBucketDto,
  toPeriodKpiDto,
  toFunnelDto,
  toProjectedDto,
} from './case-dashboard.mapper';

describe('case-dashboard.mapper', () => {
  describe('stageOfStatus / classOfCase', () => {
    it('ánh xạ đủ 5 trạng thái sang giai đoạn checkpoint', () => {
      expect(stageOfStatus(CaseStatus.INTAKE)).toBe('intake');
      expect(stageOfStatus(CaseStatus.QUOTED)).toBe('quotation');
      expect(stageOfStatus(CaseStatus.IN_PROGRESS)).toBe('inProgress');
      expect(stageOfStatus(CaseStatus.COMPLETED)).toBe('completed');
      expect(stageOfStatus(CaseStatus.CANCELLED)).toBe('cancelled');
    });

    it('gộp mã phân loại như V1 (KY_GUI/NOI_BO, OJ/OJ_NGOAI; còn lại KHAC)', () => {
      expect(classOfCase('SUA_CHUA_CHUNG')).toBe('SUA_CHUA_CHUNG');
      expect(classOfCase('ky_gui')).toBe('KY_GUI_NOI_BO');
      expect(classOfCase('NOI_BO')).toBe('KY_GUI_NOI_BO');
      expect(classOfCase('OJ')).toBe('OJ_NGOAI');
      expect(classOfCase(null)).toBe('KHAC');
      expect(classOfCase('KHAC_LA')).toBe('KHAC');
    });
  });

  describe('percentOf', () => {
    it('làm tròn một chữ số, mẫu 0 trả 0', () => {
      expect(percentOf(1, 3)).toBe(33.3);
      expect(percentOf(5, 0)).toBe(0);
    });
  });

  describe('toPeriodKpiDto', () => {
    it('chuyển chuỗi pg sang số, tính tỷ lệ thu và điền đủ giai đoạn/phân loại', () => {
      const dto = toPeriodKpiDto({
        totalVehicles: '4',
        totalCases: '5',
        revenue: '1000',
        cost: '600',
        profit: '400',
        totalAmountWithTax: '1000',
        paidAmount: '250',
        outstandingAmount: '750',
        stages: {
          intake: { vehicles: '1', cases: '1', amount: '100' },
          completed: { vehicles: '2', cases: '3', amount: '900' },
        },
        classifications: {
          SUA_CHUA_CHUNG: { vehicles: '3', cases: '4', amount: '900' },
        },
      });

      expect(dto.totalVehicles).toBe(4);
      expect(dto.totalCases).toBe(5);
      expect(dto.collectionRate).toBe(25);
      expect(dto.stages.intake).toEqual({ vehicles: 1, cases: 1, amount: 100 });
      expect(dto.stages.quotation).toEqual({
        vehicles: 0,
        cases: 0,
        amount: 0,
      });
      expect(dto.stages.completed.vehicles).toBe(2);
      expect(dto.classifications.SUA_CHUA_CHUNG.vehicles).toBe(3);
      expect(dto.classifications.KHAC).toEqual({
        vehicles: 0,
        cases: 0,
        amount: 0,
      });
    });

    it('không có dữ liệu thì mọi số 0 và tỷ lệ thu 0', () => {
      const dto = toPeriodKpiDto({});
      expect(dto.totalVehicles).toBe(0);
      expect(dto.collectionRate).toBe(0);
      expect(dto.stages.cancelled.vehicles).toBe(0);
    });
  });

  describe('toFunnelBucketDto', () => {
    it('tỷ lệ từng giai đoạn tính trên tổng xe của nhóm', () => {
      const bucket = toFunnelBucketDto({
        totalVehicles: 10,
        totalCases: 12,
        totalAmount: 500,
        stages: {
          quotation: { vehicles: 2, amount: 100 },
          completed: { vehicles: 5, amount: 300 },
        },
      });
      expect(bucket.totalVehicles).toBe(10);
      expect(bucket.totalCases).toBe(12);
      expect(bucket.stages.quotation).toEqual({
        vehicles: 2,
        amount: 100,
        rate: 20,
      });
      expect(bucket.stages.completed.rate).toBe(50);
      expect(bucket.stages.cancelled).toEqual({
        vehicles: 0,
        amount: 0,
        rate: 0,
      });
    });
  });

  describe('toFunnelDto', () => {
    it('giữ tổng toàn kỳ tách khỏi các tháng và phân loại', () => {
      const dto = toFunnelDto({
        overall: { totalVehicles: 3, totalCases: 4, totalAmount: 400 },
        byMonth: {
          '2026-01': { totalVehicles: 2, totalCases: 2, totalAmount: 200 },
          '2026-02': { totalVehicles: 2, totalCases: 2, totalAmount: 200 },
        },
        byClassification: {
          SUA_CHUA_CHUNG: { totalVehicles: 2, totalCases: 3, totalAmount: 300 },
        },
      });
      expect(dto.overall.totalVehicles).toBe(3);
      expect(dto.byMonth['2026-01'].totalVehicles).toBe(2);
      expect(dto.byClassification.SUA_CHUA_CHUNG.totalVehicles).toBe(2);
      expect(dto.byClassification.KHAC.totalVehicles).toBe(0);
    });
  });

  describe('toCaseDashboardItemDto', () => {
    it('gắn khóa xe chuẩn hóa biển, giai đoạn và phân loại', () => {
      const item = toCaseDashboardItemDto({
        id: 'case-1',
        caseCode: 'HS-001',
        licensePlate: '51a-123.45',
        customerName: 'Khách A',
        status: CaseStatus.COMPLETED,
        classification: 'OJ',
        receivedAt: new Date('2026-11-01T00:00:00.000Z'),
        completedAt: null,
        totalAmountWithTax: '1500000',
      });
      expect(item.vehicleKey).toBe('51A12345');
      expect(item.stage).toBe('completed');
      expect(item.classification).toBe('OJ_NGOAI');
      expect(item.receivedAt).toBe('2026-11-01T00:00:00.000Z');
      expect(item.completedAt).toBeNull();
      expect(item.amount).toBe(1500000);
    });

    it('phiếu không biển khóa theo id phiếu', () => {
      const item = toCaseDashboardItemDto({
        id: 'case-2',
        caseCode: 'HS-002',
        licensePlate: null,
        customerName: null,
        status: CaseStatus.INTAKE,
        classification: null,
        receivedAt: null,
        completedAt: null,
        totalAmountWithTax: null,
      });
      expect(item.vehicleKey).toBe('case-2');
      expect(item.stage).toBe('intake');
      expect(item.classification).toBe('KHAC');
      expect(item.amount).toBe(0);
    });
  });

  describe('toProjectedDto', () => {
    it('chuyển số dự thu theo phân loại; thiếu thì 0', () => {
      const dto = toProjectedDto({
        totalVehicles: '5',
        totalAmount: '900',
        classifications: {
          OJ_NGOAI: { vehicles: '2', amount: '400' },
        },
      });
      expect(dto.totalVehicles).toBe(5);
      expect(dto.totalAmount).toBe(900);
      expect(dto.classifications.OJ_NGOAI).toEqual({
        vehicles: 2,
        amount: 400,
      });
      expect(dto.classifications.KHAC).toEqual({ vehicles: 0, amount: 0 });
    });
  });
});
