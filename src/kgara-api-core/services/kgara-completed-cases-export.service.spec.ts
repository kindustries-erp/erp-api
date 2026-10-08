import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as ExcelJS from 'exceljs';
import { KgaraCompletedCasesExportService } from './kgara-completed-cases-export.service';
import { KgaraCase } from '../entities/kgara_case.entity';
import { KgaraCaseSettlement } from '../entities/kgara_case_settlement.entity';
import { KgaraCaseService } from '../entities/kgara_case_service.entity';
import { KgaraBranch } from '../entities/kgara_branch.entity';
import { KgaraGrossProfit } from '../entities/kgara_gross_profit.entity';
import { KgaraCaseLinkedInvoice } from '../entities/kgara_case_linked_invoice.entity';

describe('KgaraCompletedCasesExportService', () => {
  let service: KgaraCompletedCasesExportService;

  const mockCaseRepo = {
    createQueryBuilder: jest.fn().mockReturnValue({
      leftJoinAndMapOne: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'case-1',
          hdPhieuDichVuId: 'hd-1',
          soChungTu: 'PDV-001',
          bienSoXe: '51A-99999',
          khachHangCode: 'KH-1',
          khachHangName: 'Nguyễn Văn A',
          branchExternalId: 'CN-1',
          classification: 'SUA_CHUA_CHUNG',
          ngayTiepNhan: new Date('2026-03-01'),
          ngayHoanThanhCongViec: new Date('2026-03-05'),
          tienCoThue: 20000000,
          tienDaThanhToan: 15000000,
          tienConPhaiThanhToan: 5000000,
          doanhThu: 20000000,
          chiPhi: 12000000,
          loiNhuan: 8000000,
          tenTinhTrangDichVu: 'Hoàn tất',
        },
      ]),
    }),
  };

  const mockSettlementRepo = {
    createQueryBuilder: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        {
          caseId: 'case-1',
          settlementType: 'RECEIPT',
          totalAmount: '15000000',
        },
        {
          caseId: 'case-1',
          settlementType: 'PAYMENT',
          totalAmount: '10000000',
        },
      ]),
    }),
  };

  const mockServiceRepo = {
    createQueryBuilder: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'srv-1',
          hdPhieuDichVuId: 'hd-1',
          sanPhamCode: 'LOC_GIO',
          sanPhamName: 'Lọc gió động cơ',
          noiDungChiTiet: 'Thay lọc gió',
          loaiSanPhamCode: 'PT',
          donViTinhText: 'Cái',
          soLuongHoaDon: 1,
          donGia: 5000000,
          tienChuaThue: 5000000,
          thueSuat: 0.1,
          tienCoThue: 5500000,
          tienPhuTung: 5500000,
          giaVonPhuTung: 3000000,
        },
        {
          id: 'srv-2',
          hdPhieuDichVuId: 'hd-1',
          sanPhamCode: 'CONG_THAY',
          sanPhamName: 'Công bảo dưỡng',
          noiDungChiTiet: 'Tiền công',
          loaiSanPhamCode: 'DV',
          donViTinhText: 'Giờ',
          soLuongHoaDon: 2,
          donGia: 7250000,
          tienChuaThue: 14500000,
          thueSuat: 0,
          tienCoThue: 14500000,
          tienDichVu: 14500000,
          giaVonPhuTung: 0,
        },
      ]),
    }),
  };

  const mockBranchRepo = {
    find: jest
      .fn()
      .mockResolvedValue([{ externalId: 'CN-1', name: 'Chi nhánh Quận 1' }]),
  };

  const mockGrossProfitRepo = {};
  const mockLinkedInvoiceRepo = {
    createQueryBuilder: jest.fn().mockReturnValue({
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest
        .fn()
        .mockResolvedValue([{ caseDbId: 'case-1', invoiceNos: 'VAT-001' }]),
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KgaraCompletedCasesExportService,
        { provide: getRepositoryToken(KgaraCase), useValue: mockCaseRepo },
        {
          provide: getRepositoryToken(KgaraCaseSettlement),
          useValue: mockSettlementRepo,
        },
        {
          provide: getRepositoryToken(KgaraCaseService),
          useValue: mockServiceRepo,
        },
        { provide: getRepositoryToken(KgaraBranch), useValue: mockBranchRepo },
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

    service = module.get<KgaraCompletedCasesExportService>(
      KgaraCompletedCasesExportService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should export completed cases with 3 sheets and dynamic formulas', async () => {
    const buffer = await service.exportCompletedCasesExcel({
      date_from: '2026-03-01',
      date_to: '2026-03-31',
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    // 1. Kiểm tra Sheet 1: Bảng kê phiếu kết thúc
    const sheet1 = workbook.getWorksheet('Bảng kê phiếu kết thúc');
    expect(sheet1).toBeDefined();

    // Headers & Columns count (27 columns)
    expect(sheet1?.getRow(4).getCell(10).value).toBe('Phải thu BH (VNĐ)');
    expect(sheet1?.getRow(4).getCell(11).value).toBe('Phải thu KH (VNĐ)');
    expect(sheet1?.getRow(4).getCell(12).value).toBe('Phải thu (VNĐ)');
    expect(sheet1?.getRow(4).getCell(13).value).toBe('Đã thu (VNĐ)');
    expect(sheet1?.getRow(4).getCell(14).value).toBe('Còn lại phải thu (VNĐ)');
    expect(sheet1?.getRow(4).getCell(15).value).toBe('Ghi chú thu');
    expect(sheet1?.getRow(4).getCell(16).value).toBe('Chi phí nhân công (VNĐ)');
    expect(sheet1?.getRow(4).getCell(17).value).toBe('Chi phí phụ tùng (VNĐ)');
    expect(sheet1?.getRow(4).getCell(18).value).toBe('Phải trả (VNĐ)');
    expect(sheet1?.getRow(4).getCell(19).value).toBe('Đã trả (VNĐ)');
    expect(sheet1?.getRow(4).getCell(20).value).toBe('Còn lại phải trả (VNĐ)');
    expect(sheet1?.getRow(4).getCell(21).value).toBe('Ghi chú trả');
    expect(sheet1?.getRow(4).getCell(22).value).toBe('Doanh thu (VNĐ)');
    expect(sheet1?.getRow(4).getCell(23).value).toBe('Chi phí / Giá vốn (VNĐ)');
    expect(sheet1?.getRow(4).getCell(24).value).toBe('Lợi nhuận gộp (VNĐ)');
    expect(sheet1?.getRow(4).getCell(25).value).toBe('Biên LN (%)');

    // Row 5 Data & Formulas:
    const s1Row5 = sheet1?.getRow(5);
    expect(s1Row5?.getCell(10).value).toBe(0); // Phải thu BH
    expect(s1Row5?.getCell(11).value).toBe(20000000); // Phải thu KH
    expect(s1Row5?.getCell(12).value).toEqual(
      expect.objectContaining({ formula: 'SUM(J5:K5)', result: 20000000 }),
    ); // Phải thu
    expect(s1Row5?.getCell(13).value).toBe(15000000); // Đã thu (RECEIPT)
    expect(s1Row5?.getCell(14).value).toEqual(
      expect.objectContaining({ formula: 'L5-M5', result: 5000000 }),
    );
    // Ô Ghi chú thu có background màu pastel nhạt FFFFFBEB
    expect((s1Row5?.getCell(15).fill as any)?.fgColor?.argb).toBe('FFFFFBEB');

    expect(s1Row5?.getCell(16).value).toBe(9000000); // Chi phí nhân công (12M - 3M phụ tùng)
    expect(s1Row5?.getCell(17).value).toBe(3000000); // Chi phí phụ tùng (gvPt)
    expect(s1Row5?.getCell(18).value).toEqual(
      expect.objectContaining({ formula: 'SUM(P5:Q5)', result: 12000000 }),
    ); // Phải trả
    expect(s1Row5?.getCell(19).value).toBe(10000000); // Đã trả (PAYMENT)
    expect(s1Row5?.getCell(20).value).toEqual(
      expect.objectContaining({ formula: 'R5-S5', result: 2000000 }),
    );
    // Ô Ghi chú trả có background màu pastel nhạt FFFFFBEB
    expect((s1Row5?.getCell(21).fill as any)?.fgColor?.argb).toBe('FFFFFBEB');

    expect(s1Row5?.getCell(24).value).toEqual(
      expect.objectContaining({ formula: 'V5-W5', result: 8000000 }),
    );
    expect(s1Row5?.getCell(25).value).toEqual(
      expect.objectContaining({
        formula: 'IF(V5>0, X5/V5, 0)',
        result: 0.4,
      }),
    );
    // Sheet 1 Cột 25 (Biên LN): 40% thuộc Dải 4 (Khá / Tốt: 40% - 60%): màu xanh lá Green-200 FFBBF7D0
    expect((s1Row5?.getCell(25).fill as any)?.fgColor?.argb).toBe('FFBBF7D0');
    expect((s1Row5?.getCell(25).font as any)?.color?.argb).toBe('FF15803D');

    // 2. Kiểm tra Sheet 2: Theo dõi lãi lỗ (Rename từ Theo dõi PnL)
    const sheet2 = workbook.getWorksheet('Theo dõi lãi lỗ');
    expect(sheet2).toBeDefined();

    // Headers & Columns count (15 columns - Đã bỏ cột Đánh giá PnL)
    expect(sheet2?.getRow(4).getCell(7).value).toBe('Doanh thu Công DV (VNĐ)');
    expect(sheet2?.getRow(4).getCell(8).value).toBe('Doanh thu Phụ tùng (VNĐ)');
    expect(sheet2?.getRow(4).getCell(9).value).toBe('Tổng Doanh thu (VNĐ)');
    expect(sheet2?.getRow(4).getCell(10).value).toBe('Giá vốn Phụ tùng (VNĐ)');
    expect(sheet2?.getRow(4).getCell(11).value).toBe(
      'Chi phí thợ / Khác (VNĐ)',
    );
    expect(sheet2?.getRow(4).getCell(12).value).toBe('Tổng Chi phí (VNĐ)');
    expect(sheet2?.getRow(4).getCell(13).value).toBe('Lợi nhuận gộp (VNĐ)');
    expect(sheet2?.getRow(4).getCell(14).value).toBe('Biên LN (%)');
    expect(sheet2?.getRow(4).getCell(15).value).toBe('Chi nhánh'); // Cột 15 là Chi nhánh, không còn cột O Đánh giá PnL

    // Row 5 Data & Formulas:
    const s2Row5 = sheet2?.getRow(5);
    expect(s2Row5?.getCell(9).value).toEqual(
      expect.objectContaining({ formula: 'G5+H5', result: 20000000 }),
    );
    expect(s2Row5?.getCell(12).value).toEqual(
      expect.objectContaining({ formula: 'J5+K5', result: 12000000 }),
    );
    expect(s2Row5?.getCell(13).value).toEqual(
      expect.objectContaining({ formula: 'I5-L5', result: 8000000 }),
    );
    expect(s2Row5?.getCell(14).value).toEqual(
      expect.objectContaining({
        formula: 'IF(I5>0, M5/I5, 0)',
        result: 0.4,
      }),
    );
    // Biên LN 40% thuộc Dải 4 (Khá / Tốt: 40% - 60%): màu xanh lá Green-200 FFBBF7D0
    expect((s2Row5?.getCell(14).fill as any)?.fgColor?.argb).toBe('FFBBF7D0');
    expect((s2Row5?.getCell(14).font as any)?.color?.argb).toBe('FF15803D');

    // 3. Kiểm tra Sheet 3: Chi tiết DV & Phụ tùng
    const sheet3 = workbook.getWorksheet('Chi tiết DV & Phụ tùng');
    expect(sheet3).toBeDefined();
    expect(sheet3?.rowCount).toBeGreaterThanOrEqual(6);
  });

  it('should correctly evaluate PnL as "Lãi" with formula and 5-range margin highlight in Theo dõi lãi lỗ', async () => {
    // Giả lập case giống dòng 9 trong ảnh của user: Doanh thu 115M, Chi phí 0, loiNhuan trong DB = 0
    mockCaseRepo.createQueryBuilder.mockReturnValueOnce({
      leftJoinAndMapOne: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'case-row-9',
          hdPhieuDichVuId: 'hd-9',
          soChungTu: 'PDV-ROW-9',
          bienSoXe: '51B-12345',
          khachHangCode: 'KH-9',
          khachHangName: 'Công ty ABC',
          branchExternalId: 'CN-1',
          classification: 'SUA_CHUA_CHUNG',
          ngayTiepNhan: new Date('2026-09-30'),
          ngayHoanThanhCongViec: new Date('2026-09-30'),
          tienCoThue: 115000000,
          tienDaThanhToan: 115000000,
          tienConPhaiThanhToan: 0,
          doanhThu: '0.00', // Mô phỏng đúng bug KGara lưu '0.00' khi chưa chốt giá vốn
          chiPhi: '0.00',
          loiNhuan: '0.00',
          tenTinhTrangDichVu: 'Hoàn tất',
        },
      ]),
    });

    const buffer = await service.exportCompletedCasesExcel({});
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const sheet2 = workbook.getWorksheet('Theo dõi lãi lỗ');
    const row5 = sheet2?.getRow(5);

    // Lợi nhuận gộp phải là 115M
    expect(row5?.getCell(13).value).toEqual(
      expect.objectContaining({ formula: 'I5-L5', result: 115000000 }),
    );
    // Biên LN phải là 100% (1.0)
    expect(row5?.getCell(14).value).toEqual(
      expect.objectContaining({ formula: 'IF(I5>0, M5/I5, 0)', result: 1 }),
    );
    // Biên LN 100% thuộc Dải 6 (Xuất sắc / Siêu LN: >= 80%): màu tím phong lan FFE9D5FF, chữ tím FF6B21A8
    expect((row5?.getCell(14).fill as any)?.fgColor?.argb).toBe('FFE9D5FF');
    expect((row5?.getCell(14).font as any)?.color?.argb).toBe('FF6B21A8');
    // Cột 15 là Chi nhánh
    expect(sheet2?.getRow(4).getCell(15).value).toBe('Chi nhánh');
  });

  it('should verify all 6 margin color tiers for styleMarginCell directly', () => {
    const { styleMarginCell } = require('../helpers/kgara-excel-style.helper');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Test');
    const row = sheet.addRow(['margin']);

    // Dải 1: Âm / Lỗ (< 0%)
    styleMarginCell(row.getCell(1), -5);
    expect((row.getCell(1).fill as any)?.fgColor?.argb).toBe('FFFECACA');
    expect((row.getCell(1).font as any)?.color?.argb).toBe('FF991B1B');

    // Dải 2: Hòa vốn / Biên rất thấp (0% - < 20%)
    styleMarginCell(row.getCell(1), 10);
    expect((row.getCell(1).fill as any)?.fgColor?.argb).toBe('FFFED7AA');
    expect((row.getCell(1).font as any)?.color?.argb).toBe('FF9A3412');

    // Dải 3: Trung bình (20% - < 40%)
    styleMarginCell(row.getCell(1), 30.8);
    expect((row.getCell(1).fill as any)?.fgColor?.argb).toBe('FFBAE6FD');
    expect((row.getCell(1).font as any)?.color?.argb).toBe('FF0369A1');

    // Dải 4: Khá / Lãi tốt (40% - < 60%)
    styleMarginCell(row.getCell(1), 58);
    expect((row.getCell(1).fill as any)?.fgColor?.argb).toBe('FFBBF7D0');
    expect((row.getCell(1).font as any)?.color?.argb).toBe('FF15803D');

    // Dải 5: Rất cao (60% - < 80%)
    styleMarginCell(row.getCell(1), 79.1);
    expect((row.getCell(1).fill as any)?.fgColor?.argb).toBe('FF99F6E4');
    expect((row.getCell(1).font as any)?.color?.argb).toBe('FF0F766E');

    // Dải 6: Xuất sắc / Siêu LN (>= 80%)
    styleMarginCell(row.getCell(1), 100);
    expect((row.getCell(1).fill as any)?.fgColor?.argb).toBe('FFE9D5FF');
    expect((row.getCell(1).font as any)?.color?.argb).toBe('FF6B21A8');
  });
});
