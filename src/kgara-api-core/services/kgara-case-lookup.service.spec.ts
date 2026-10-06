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
    const caseServiceRepoMock = {
      update: jest.fn().mockResolvedValue(undefined),
    };
    settlementRepoMock = {
      find: jest.fn().mockResolvedValue([]),
    };
    grossProfitRepoMock = {
      findOne: jest.fn(),
    };
    clientMock = {
      getCaseDetail: jest.fn(),
      getGrossProfitJournal: jest.fn(),
    };
    dataSourceMock = {};

    service = new KgaraCaseLookupService(
      caseRepoMock,
      caseServiceRepoMock as any,
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

  describe('enrichCostForCase and updateCaseLinesCost', () => {
    it('should enrich line cost when journal items are retrieved', async () => {
      const mockCase = {
        id: 'case-1',
        soChungTu: 'GR-PDV2609-0056',
        hdPhieuDichVuId: 'ext-56',
        branchExternalId: 'branch-1',
        rawData: {
          ListPhieuDichVuChiTiet: [
            {
              HdPhieuDichVuChiTietID: 'line-1',
              LoaiSanPhamCode: 'PT',
              SanPhamName: 'Nhớt động cơ 5W-30',
              SoLuongHoaDon: 2,
              GiaVonPhuTung: 0,
            },
          ],
        } as any,
      };

      grossProfitRepoMock.findOne.mockResolvedValue({
        rawData: {
          journal_items: [
            {
              TaiKhoanNoCode: '1541',
              GiaTriTien: 380000,
              ChiPhi: 380000,
              NoiDung: '[51M80574] - [Nhớt động cơ 5W-30]',
            },
          ],
        },
      });

      await service.enrichCostForCase(mockCase as any);

      expect(mockCase.rawData.ListPhieuDichVuChiTiet[0].GiaVonPhuTung).toBe(
        190000,
      );
      expect(mockCase.rawData.ListPhieuDichVuChiTiet[0].TongVon).toBe(380000);
      expect(mockCase.rawData.costEnriched).toBe(true);
      expect(caseRepoMock.save).toHaveBeenCalledWith(mockCase);
    });

    it('should allow manual updating of line costs on ERP', async () => {
      const mockCase = {
        id: 'case-1',
        soChungTu: 'GR-PDV2609-0074',
        hdPhieuDichVuId: 'ext-74',
        rawData: {
          ListPhieuDichVuChiTiet: [
            {
              HdPhieuDichVuChiTietID: 'line-piston',
              LoaiSanPhamCode: 'PT',
              SanPhamName: 'PISTON',
              SoLuongHoaDon: 4,
              GiaVonPhuTung: 0,
            },
          ],
        } as any,
      };

      caseRepoMock.findOne.mockResolvedValue(mockCase);

      const updated = await service.updateCaseLinesCost('case-1', [
        { detailId: 'line-piston', giaVonPhuTung: 1500000 },
      ]);

      expect(updated.rawData.ListPhieuDichVuChiTiet[0].GiaVonPhuTung).toBe(
        1500000,
      );
      expect(updated.rawData.ListPhieuDichVuChiTiet[0].TongVon).toBe(6000000);
      expect(caseRepoMock.save).toHaveBeenCalled();
    });
  });
});
