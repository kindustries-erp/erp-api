import { NotFoundException } from '@nestjs/common';
import { KgaraCaseLookupService } from './kgara-case-lookup.service';
import { EntityCustomFieldsHelper } from '../../module-config/helpers/entity-custom-fields.helper';

describe('KgaraCaseLookupService', () => {
  let service: KgaraCaseLookupService;
  let caseRepoMock: any;
  let settlementRepoMock: any;
  let grossProfitRepoMock: any;
  let clientMock: any;
  let dataSourceMock: any;

  beforeEach(() => {
    jest
      .spyOn(EntityCustomFieldsHelper, 'enrichOne')
      .mockResolvedValue(undefined as any);

    caseRepoMock = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    settlementRepoMock = {
      find: jest.fn().mockResolvedValue([]),
    };
    grossProfitRepoMock = {
      findOne: jest.fn(),
    };
    clientMock = {
      getCaseDetail: jest.fn(),
    };
    dataSourceMock = {};

    service = new KgaraCaseLookupService(
      caseRepoMock,
      settlementRepoMock,
      grossProfitRepoMock,
      clientMock,
      dataSourceMock,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('findCaseByCodeOrId', () => {
    it('should find case by UUID using multi-condition where clause', async () => {
      const uuid = '4fab3f01-4fb6-4852-a891-d805d18675de';
      const mockCase = {
        id: uuid,
        soChungTu: 'GR-PDV2609-0076',
        hdPhieuDichVuId: 'ext-76',
        rawData: { ListPhieuDichVuChiTiet: [{ id: 1 }] },
      };
      caseRepoMock.findOne.mockResolvedValue(mockCase);

      const result = await service.findCaseByCodeOrId(uuid);

      expect(caseRepoMock.findOne).toHaveBeenCalledWith({
        where: [{ id: uuid }, { soChungTu: uuid }, { hdPhieuDichVuId: uuid }],
        relations: ['category'],
      });
      expect(result).toEqual(mockCase);
    });

    it('should find case by standard document code', async () => {
      const code = 'GR-PDV2609-0076';
      const mockCase = {
        id: '4fab3f01-4fb6-4852-a891-d805d18675de',
        soChungTu: code,
        hdPhieuDichVuId: 'ext-76',
        rawData: { ListPhieuDichVuChiTiet: [{ id: 1 }] },
      };
      caseRepoMock.findOne.mockResolvedValue(mockCase);

      const result = await service.findCaseByCodeOrId(code);

      expect(caseRepoMock.findOne).toHaveBeenCalledWith({
        where: [{ soChungTu: code }, { hdPhieuDichVuId: code }],
        relations: ['category'],
      });
      expect(result).toEqual(mockCase);
    });

    it('should throw NotFoundException when case does not exist', async () => {
      caseRepoMock.findOne.mockResolvedValue(null);

      await expect(
        service.findCaseByCodeOrId('non-existent-code'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findGrossProfitByCodeOrId', () => {
    it('should resolve gross profit using case when queried with UUID', async () => {
      const uuid = '4fab3f01-4fb6-4852-a891-d805d18675de';
      const mockCase = {
        id: uuid,
        soChungTu: 'GR-PDV2609-0076',
        hdPhieuDichVuId: 'ext-76',
      };
      const mockGrossProfit = {
        id: 'gp-1',
        doanhThu: '10000000',
        chiPhi: '6000000',
        loiNhuan: '4000000',
        vuViecCode: 'GR-PDV2609-0076',
        vuViecName: 'Bảo dưỡng xe',
        tenKhachHang: 'Công ty TEC',
        hdPhieuDichVuId: 'ext-76',
      };

      caseRepoMock.findOne.mockResolvedValue(mockCase);
      grossProfitRepoMock.findOne.mockResolvedValue(mockGrossProfit);

      const result = await service.findGrossProfitByCodeOrId(uuid);

      expect(result.DoanhThu).toBe(10000000);
      expect(result.ChiPhi).toBe(6000000);
      expect(result.LoiNhuan).toBe(4000000);
      expect(result.BienLoiNhuan).toBe(40);
      expect(result.VuViecCode).toBe('GR-PDV2609-0076');
    });

    it('should resolve gross profit when queried directly with document code', async () => {
      const code = 'GR-PDV2609-0076';
      const mockGrossProfit = {
        id: 'gp-1',
        doanhThu: '5000000',
        chiPhi: '3000000',
        loiNhuan: '2000000',
        vuViecCode: code,
        vuViecName: 'Sửa xe',
        tenKhachHang: 'Khách VIP',
        hdPhieuDichVuId: 'ext-76',
      };
      grossProfitRepoMock.findOne.mockResolvedValue(mockGrossProfit);

      const result = await service.findGrossProfitByCodeOrId(code);

      expect(result.DoanhThu).toBe(5000000);
      expect(result.ChiPhi).toBe(3000000);
      expect(result.LoiNhuan).toBe(2000000);
      expect(result.BienLoiNhuan).toBe(40);
    });
  });
});
