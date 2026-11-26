import { NotFoundException } from '@nestjs/common';
import { KgaraCaseLookupService } from './kgara-case-lookup.service';
import { notifyCaseProjector } from '../hub/case-projector.port';
import { EntityCustomFieldsHelper } from '../../module-config/helpers/entity-custom-fields.helper';

jest.mock('../hub/case-projector.port', () => ({
  notifyCaseProjector: jest.fn().mockResolvedValue(undefined),
}));

describe('KgaraCaseLookupService', () => {
  let service: KgaraCaseLookupService;
  let caseRepoMock: any;
  let settlementRepoMock: any;
  let grossProfitRepoMock: any;
  let clientMock: any;
  let dataSourceMock: any;
  let caseServiceRepoMock: any;

  beforeEach(() => {
    (notifyCaseProjector as jest.Mock).mockClear();
    jest
      .spyOn(EntityCustomFieldsHelper, 'enrichOne')
      .mockResolvedValue(undefined as any);

    caseRepoMock = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    caseServiceRepoMock = {
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
      caseServiceRepoMock,
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

  describe('findCaseByExternalId', () => {
    it('chỉ đọc DB, không gọi KGara theo chi nhánh', async () => {
      const mockCase = { id: 'c1', hdPhieuDichVuId: 'ext-1', rawData: null };
      caseRepoMock.findOne.mockResolvedValue(mockCase);

      const result = await service.findCaseByExternalId('ext-1');

      expect(caseRepoMock.findOne).toHaveBeenCalledWith({
        where: [{ hdPhieuDichVuId: 'ext-1' }, { soChungTu: 'ext-1' }],
        relations: ['category'],
      });
      expect(clientMock.getCaseDetail).not.toHaveBeenCalled();
      expect(result).toBe(mockCase);
    });

    it('phiếu chưa có trong DB thì 404, không tạo phiếu mới', async () => {
      caseRepoMock.findOne.mockResolvedValue(null);

      await expect(service.findCaseByExternalId('ext-missing')).rejects.toThrow(
        NotFoundException,
      );
      expect(clientMock.getCaseDetail).not.toHaveBeenCalled();
      expect(caseRepoMock.save).not.toHaveBeenCalled();
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

    it('chiết khấu 521 là giảm trừ doanh thu: DoanhThu - discountCost - totalCost = LoiNhuan, biên theo doanh thu thuần', async () => {
      grossProfitRepoMock.findOne.mockResolvedValue({
        id: 'gp-2',
        doanhThu: '10000000',
        // KGara: ChiPhi thô = giá vốn trực tiếp (6.000.000) + 521 (1.000.000)
        chiPhi: '7000000',
        loiNhuan: '3000000',
        vuViecCode: 'GR-PDV2610-0001',
        hdPhieuDichVuId: 'ext-1',
        rawData: {
          journal_items: [
            { TaiKhoanNoCode: '1541', ChiPhi: 6000000, GiaTriTien: 6000000 },
            { TaiKhoanNoCode: '521', ChiPhi: 1000000, GiaTriTien: 1000000 },
            { TaiKhoanNoCode: '131', ChiPhi: 0, GiaTriTien: 10000000 },
          ],
        },
      });

      const result = await service.findGrossProfitByCodeOrId('GR-PDV2610-0001');
      const b = result.costBreakdown;

      expect(b.discountCost).toBe(1000000);
      expect(b.otherCost).toBe(0);
      expect(b.totalCost).toBe(6000000);
      expect(result.DoanhThu - b.discountCost - b.totalCost).toBe(
        result.LoiNhuan,
      );
      expect(result.DoanhThuThuan).toBe(9000000);
      expect(result.BienLoiNhuan).toBe(33.3);
      // Số thô KGara giữ nguyên
      expect(result.ChiPhi).toBe(7000000);
      expect(result.LoiNhuan).toBe(3000000);
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

    const makeCase = (rawExtra: Record<string, any> = {}) => ({
      id: 'case-9',
      soChungTu: 'GR-PDV2609-0009',
      hdPhieuDichVuId: 'ext-9',
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
        ...rawExtra,
      } as any,
    });
    const journal1541 = (amount: number) => ({
      rawData: {
        journal_items: [
          {
            TaiKhoanNoCode: '1541',
            GiaTriTien: amount,
            ChiPhi: amount,
            NoiDung: '[51M80574] - [Nhớt động cơ 5W-30]',
          },
        ],
      },
    });

    it('chiếu lại V2 sau khi làm giàu giá vốn (AC-5)', async () => {
      const mockCase = makeCase();
      grossProfitRepoMock.findOne.mockResolvedValue(journal1541(380000));

      const res = await service.enrichCostForCase(mockCase as any);

      expect(res).toBe(true);
      expect(notifyCaseProjector).toHaveBeenCalledWith(
        undefined,
        expect.anything(),
        'case-9',
      );
      expect(caseServiceRepoMock.update).toHaveBeenCalledWith(
        { hdPhieuDichVuChiTietId: 'line-1' },
        { giaVonPhuTung: 190000 },
      );
    });

    it('phiếu đã làm giàu và journal không đổi thì bỏ qua (AC-6)', async () => {
      const mockCase = makeCase({
        costEnriched: true,
        costBreakdown: { warehousePartsCost: 380000 },
      });
      grossProfitRepoMock.findOne.mockResolvedValue(journal1541(380000));

      const res = await service.enrichCostForCase(mockCase as any);

      expect(res).toBe(false);
      expect(caseRepoMock.save).not.toHaveBeenCalled();
      expect(notifyCaseProjector).not.toHaveBeenCalled();
    });

    it('phiếu đã làm giàu nhưng xuất kho hạch toán thêm thì làm mới (AC-6)', async () => {
      const mockCase = makeCase({
        costEnriched: true,
        costBreakdown: { warehousePartsCost: 0 },
      });
      grossProfitRepoMock.findOne.mockResolvedValue(journal1541(380000));

      const res = await service.enrichCostForCase(mockCase as any);

      expect(res).toBe(true);
      expect(mockCase.rawData.ListPhieuDichVuChiTiet[0].GiaVonPhuTung).toBe(
        190000,
      );
      expect(mockCase.rawData.costBreakdown.warehousePartsCost).toBe(380000);
    });

    it('skipRemote không gọi KGara khi chưa có journal đã lưu', async () => {
      const mockCase = makeCase();
      grossProfitRepoMock.findOne.mockResolvedValue({ rawData: {} });

      const res = await service.enrichCostForCase(mockCase as any, {
        skipRemote: true,
      });

      expect(res).toBe(false);
      expect(clientMock.getGrossProfitJournal).not.toHaveBeenCalled();
    });

    it('force làm lại dù đã làm giàu', async () => {
      const mockCase = makeCase({
        costEnriched: true,
        costBreakdown: { warehousePartsCost: 380000 },
      });
      grossProfitRepoMock.findOne.mockResolvedValue(journal1541(380000));

      const res = await service.enrichCostForCase(mockCase as any, {
        force: true,
        notifyProjector: false,
      });

      expect(res).toBe(true);
      expect(notifyCaseProjector).not.toHaveBeenCalled();
    });

    it('force ghi giá vốn 0 cho dòng lần trước gán nhầm, không đụng dòng chưa từng gán', async () => {
      const mockCase = {
        id: 'case-c',
        soChungTu: 'GR-PDV2607-0018-Copy2',
        hdPhieuDichVuId: 'ext-c',
        rawData: {
          costEnriched: true,
          costBreakdown: { warehousePartsCost: 648000 },
          ListPhieuDichVuChiTiet: [
            {
              HdPhieuDichVuChiTietID: 'loc',
              LoaiSanPhamCode: 'PT',
              SanPhamName: 'Lọc nhớt động cơ',
              SoLuongHoaDon: 1,
              GiaVonPhuTung: 648000,
              CostAllocationType: 'WAREHOUSE_ISSUE',
            },
            {
              HdPhieuDichVuChiTietID: 'nhot',
              LoaiSanPhamCode: 'PT',
              SanPhamName: 'Nhớt động cơ',
              SoLuongHoaDon: 4.8,
              GiaVonPhuTung: 0,
            },
            {
              HdPhieuDichVuChiTietID: 'khac',
              LoaiSanPhamCode: 'PT',
              SanPhamName: 'Mỡ tra ắc thắng',
              SoLuongHoaDon: 1,
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
              ChiPhi: 648000,
              NoiDung: '[61LD05581] - [Nhớt động cơ]',
            },
          ],
        },
      });

      const res = await service.enrichCostForCase(mockCase as any, {
        force: true,
        notifyProjector: false,
      });

      expect(res).toBe(true);
      expect(caseServiceRepoMock.update).toHaveBeenCalledWith(
        { hdPhieuDichVuChiTietId: 'loc' },
        { giaVonPhuTung: 0 },
      );
      expect(caseServiceRepoMock.update).toHaveBeenCalledWith(
        { hdPhieuDichVuChiTietId: 'nhot' },
        { giaVonPhuTung: 135000 },
      );
      expect(caseServiceRepoMock.update).not.toHaveBeenCalledWith(
        { hdPhieuDichVuChiTietId: 'khac' },
        expect.anything(),
      );
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
