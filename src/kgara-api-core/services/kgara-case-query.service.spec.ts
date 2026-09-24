import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as ExcelJS from 'exceljs';
import { KgaraCaseQueryService } from './kgara-case-query.service';
import { KgaraCase } from '../entities/kgara_case.entity';
import { KgaraCaseSettlement } from '../entities/kgara_case_settlement.entity';
import { KgaraCaseService } from '../entities/kgara_case_service.entity';
import { KgaraBranch } from '../entities/kgara_branch.entity';
import { KgaraGrossProfit } from '../entities/kgara_gross_profit.entity';
import { KgaraCaseLinkedInvoice } from '../entities/kgara_case_linked_invoice.entity';

describe('KgaraCaseQueryService', () => {
  let service: KgaraCaseQueryService;

  const mockCaseQueryBuilder: any = {
    leftJoinAndMapOne: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([
      {
        id: 'case-uuid-1',
        hdPhieuDichVuId: 'hd-101',
        soChungTu: 'PDV-2026-001',
        bienSoXe: '51G-12345',
        khachHangCode: 'KH-001',
        khachHangName: 'Công ty Alpha',
        branchExternalId: 'CN-01',
        classification: 'SUA_CHUA_CHUNG',
        ngayTiepNhan: new Date('2026-03-01T08:00:00Z'),
        ngayHoanThanhCongViec: new Date('2026-03-05T17:00:00Z'),
        tienCoThue: 15000000,
        tienDaThanhToan: 10000000,
        tienConPhaiThanhToan: 5000000,
        tenTinhTrangDichVu: 'Hoàn tất',
        grossProfit: {
          doanhThu: 15000000,
          chiPhi: 9000000,
          loiNhuan: 6000000,
        },
      },
    ]),
  };

  const mockServiceQueryBuilder: any = {
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([
      {
        id: 'srv-1',
        hdPhieuDichVuId: 'hd-101',
        sanPhamCode: 'DAU_NHOT',
        sanPhamName: 'Thay dầu nhớt động cơ',
        noiDungChiTiet: 'Thay dầu Castrol 5W30',
        loaiSanPhamCode: 'PT',
        donViTinhText: 'Lít',
        soLuongHoaDon: 4,
        donGia: 250000,
        tienChuaThue: 1000000,
        thueSuat: 10,
        tienCoThue: 1100000,
        soGioCongLam: 0,
        tienDichVu: 0,
        tienPhuTung: 1100000,
        giaVonPhuTung: 700000,
        tienChietKhauCt: 0,
        khoCode: 'KHO_CHINH',
        tienPhuPhi: null,
      },
    ]),
  };

  const mockCaseRepo = {
    createQueryBuilder: jest.fn().mockReturnValue(mockCaseQueryBuilder),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockSettlementRepo = {
    find: jest.fn(),
  };

  const mockServiceRepo = {
    createQueryBuilder: jest.fn().mockReturnValue(mockServiceQueryBuilder),
  };

  const mockBranchRepo = {
    find: jest.fn().mockResolvedValue([
      {
        id: 'b-1',
        externalId: 'CN-01',
        name: 'Chi nhánh Quận 7',
        code: 'Q7',
      },
    ]),
  };

  const mockLinkedInvoiceRepo = {
    createQueryBuilder: jest.fn().mockReturnValue({
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest
        .fn()
        .mockResolvedValue([
          { caseDbId: 'case-uuid-1', invoiceNos: '0001234' },
        ]),
    }),
  };

  const mockGrossProfitRepo = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KgaraCaseQueryService,
        {
          provide: getRepositoryToken(KgaraCase),
          useValue: mockCaseRepo,
        },
        {
          provide: getRepositoryToken(KgaraCaseSettlement),
          useValue: mockSettlementRepo,
        },
        {
          provide: getRepositoryToken(KgaraCaseService),
          useValue: mockServiceRepo,
        },
        {
          provide: getRepositoryToken(KgaraBranch),
          useValue: mockBranchRepo,
        },
        {
          provide: getRepositoryToken(KgaraGrossProfit),
          useValue: mockGrossProfitRepo,
        },
        {
          provide: getRepositoryToken(KgaraCaseLinkedInvoice),
          useValue: mockLinkedInvoiceRepo,
        },
      ],
    }).compile();

    service = module.get<KgaraCaseQueryService>(KgaraCaseQueryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('exportCompletedCasesExcel', () => {
    it('should generate a valid XLSX buffer with 2 sheets', async () => {
      const buffer = await service.exportCompletedCasesExcel({
        date_from: '2026-03-01',
        date_to: '2026-03-31',
        date_type: 'completion_date',
        branchId: 'CN-01',
        classification: 'SUA_CHUA_CHUNG',
      });

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);

      // Read back with ExcelJS to verify sheets structure
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);

      const sheet1 = workbook.getWorksheet('Bảng kê phiếu kết thúc');
      expect(sheet1).toBeDefined();
      expect(sheet1?.rowCount).toBeGreaterThanOrEqual(2); // Header + 1 row + summary

      const sheet2 = workbook.getWorksheet('Chi tiết DV & Phụ tùng');
      expect(sheet2).toBeDefined();
      expect(sheet2?.rowCount).toBeGreaterThanOrEqual(2);

      // Verify row 2 data in Sheet 1
      const row2 = sheet1?.getRow(2);
      expect(row2?.getCell(2).value).toBe('PDV-2026-001'); // soChungTu
      expect(row2?.getCell(3).value).toBe('51G-12345'); // bienSoXe
      expect(row2?.getCell(6).value).toBe('Chi nhánh Quận 7'); // branchName
      expect(row2?.getCell(7).value).toBe('Sửa chữa chung'); // classification
      expect(row2?.getCell(11).value).toBe(15000000); // doanhThu
      expect(row2?.getCell(12).value).toBe(9000000); // chiPhi
      expect(row2?.getCell(13).value).toBe(6000000); // loiNhuan
    });
  });

  describe('findCaseServices', () => {
    it('should return paginated case services with grand totals', async () => {
      const mockResultRows = [
        {
          id: 'srv-1',
          hdPhieuDichVuChiTietId: 'ct-101',
          hdPhieuDichVuId: 'hd-101',
          sanPhamCode: 'DAU_NHOT',
          sanPhamName: 'Thay dầu nhớt động cơ',
          noiDungChiTiet: 'Thay dầu Castrol 5W30',
          loaiSanPhamCode: 'PT',
          donViTinhText: 'Lít',
          soLuongHoaDon: '4.0000',
          donGia: '250000.00',
          tienChuaThue: '1000000.00',
          thueSuat: '10.00',
          tienCoThue: '1100000.00',
          soGioCongLam: '0.00',
          tienDichVu: '0.00',
          tienPhuTung: '1100000.00',
          giaVonPhuTung: '700000.00',
          tyLeChietKhauCt: '0.00',
          tienChietKhauCt: '0.00',
          khoCode: 'KHO_CHINH',
          tienPhuPhi: '0.00',
          soChungTu: 'PDV-2026-001',
          bienSoXe: '51G-12345',
          khachHangCode: 'KH-001',
          khachHangName: 'Công ty Alpha',
          status: 3,
          statusName: 'Hoàn tất',
          classification: 'SUA_CHUA_CHUNG',
          branchExternalId: 'CN-01',
          branchName: 'Chi nhánh Quận 7',
          caseDate: '2026-03-01',
          completionDate: '2026-03-05',
        },
      ];

      const mockTotalsRow = {
        totalRows: '1',
        soLuongHoaDon: '4',
        tienChuaThue: '1000000',
        tienCoThue: '1100000',
        tienDichVu: '0',
        tienPhuTung: '1100000',
        giaVonPhuTung: '700000',
        tienChietKhauCt: '0',
        tienPhuPhi: '0',
      };

      const mockQb: any = {
        innerJoin: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        clone: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(mockTotalsRow),
        getRawMany: jest.fn().mockResolvedValue(mockResultRows),
      };

      mockServiceRepo.createQueryBuilder.mockReturnValue(mockQb);

      const res = await service.findCaseServices({
        branchId: 'CN-01',
        page: 1,
        pageSize: 20,
        serviceType: 'ALL',
      });

      expect(res.data).toHaveLength(1);
      expect(res.data[0].soChungTu).toBe('PDV-2026-001');
      expect(res.data[0].sanPhamCode).toBe('DAU_NHOT');
      expect(res.data[0].tienCoThue).toBe(1100000);
      expect(res.pagination.total).toBe(1);
      expect(res.totals.grandTotal.tienCoThue).toBe(1100000);
    });
  });

  describe('getCaseServiceColumnOptions', () => {
    it('should return distinct options for specified column', async () => {
      const mockQb: any = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        clone: jest.fn().mockReturnThis(),
        getRawMany: jest
          .fn()
          .mockResolvedValue([{ val: 'DAU_NHOT' }, { val: 'LOC_GIO' }]),
      };

      mockServiceRepo.createQueryBuilder.mockReturnValue(mockQb);

      const res = await service.getCaseServiceColumnOptions(
        'CN-01',
        'sanPhamCode',
        '',
        1,
        20,
      );

      expect(res.items).toEqual(['DAU_NHOT', 'LOC_GIO']);
      expect(res.total).toBe(2);
    });
  });

  describe('exportCaseServicesExcel', () => {
    it('should export formatted excel buffer for case services', async () => {
      const mockResultRows = [
        {
          id: 'srv-1',
          hdPhieuDichVuChiTietId: 'ct-101',
          hdPhieuDichVuId: 'hd-101',
          sanPhamCode: 'DAU_NHOT',
          sanPhamName: 'Thay dầu nhớt động cơ',
          noiDungChiTiet: 'Thay dầu Castrol 5W30',
          loaiSanPhamCode: 'PT',
          donViTinhText: 'Lít',
          soLuongHoaDon: '4.0000',
          donGia: '250000.00',
          tienChuaThue: '1000000.00',
          thueSuat: '10.00',
          tienCoThue: '1100000.00',
          soGioCongLam: '0.00',
          tienDichVu: '0.00',
          tienPhuTung: '1100000.00',
          giaVonPhuTung: '700000.00',
          tyLeChietKhauCt: '0.00',
          tienChietKhauCt: '0.00',
          khoCode: 'KHO_CHINH',
          tienPhuPhi: '0.00',
          soChungTu: 'PDV-2026-001',
          bienSoXe: '51G-12345',
          khachHangCode: 'KH-001',
          khachHangName: 'Công ty Alpha',
          status: 3,
          statusName: 'Hoàn tất',
          classification: 'SUA_CHUA_CHUNG',
          branchExternalId: 'CN-01',
          branchName: 'Chi nhánh Quận 7',
          caseDate: '2026-03-01',
          completionDate: '2026-03-05',
        },
      ];

      const mockTotalsRow = {
        totalRows: '1',
        soLuongHoaDon: '4',
        tienChuaThue: '1000000',
        tienCoThue: '1100000',
        tienDichVu: '0',
        tienPhuTung: '1100000',
        giaVonPhuTung: '700000',
        tienChietKhauCt: '0',
        tienPhuPhi: '0',
      };

      const mockQb: any = {
        innerJoin: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        clone: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(mockTotalsRow),
        getRawMany: jest.fn().mockResolvedValue(mockResultRows),
      };

      mockServiceRepo.createQueryBuilder.mockReturnValue(mockQb);

      const buffer = await service.exportCaseServicesExcel({
        branchId: 'CN-01',
        serviceType: 'ALL',
      });

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);

      const sheet = workbook.getWorksheet('Chi tiết DV & Phụ tùng');
      expect(sheet).toBeDefined();
      expect(sheet?.rowCount).toBeGreaterThanOrEqual(2);
    });
  });
});
