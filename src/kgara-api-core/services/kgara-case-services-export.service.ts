import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { KgaraCaseServicesQueryService } from './kgara-case-services-query.service';
import {
  initSheetStructure,
  applyStandardExcelReportLayout,
  borderThin,
  CASE_SERVICES_EXPORT_COLUMNS,
} from '../helpers/kgara-excel-style.helper';

export interface CaseServicesExportParams {
  branchId?: string;
  q?: string;
  from?: string;
  to?: string;
  serviceType?: string;
  filtersStr?: string;
  sorts?: string | string[];
}

@Injectable()
export class KgaraCaseServicesExportService {
  constructor(
    private readonly caseServicesQueryService: KgaraCaseServicesQueryService,
  ) {}

  /**
   * Xuất danh sách chi tiết Hạng mục Dịch vụ & Phụ tùng ra file Excel (24 cột chuẩn hóa)
   */
  async exportCaseServicesExcel(
    params: CaseServicesExportParams,
  ): Promise<Buffer> {
    const result = await this.caseServicesQueryService.findCaseServices({
      ...params,
      page: 1,
      pageSize: 50000,
    });

    const items = result.data || [];

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Liouni ERP';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Chi tiết DV & Phụ tùng');
    initSheetStructure(sheet, CASE_SERVICES_EXPORT_COLUMNS);

    const sums = {
      soLuongHoaDon: 0,
      tienChuaThue: 0,
      tienCoThue: 0,
      tienDichVu: 0,
      tienPhuTung: 0,
      giaVonPhuTung: 0,
      tienChietKhauCt: 0,
    };

    items.forEach((item, idx) => {
      const loaiHienThi =
        item.loaiSanPhamCode === 'PT'
          ? 'Phụ tùng'
          : item.loaiSanPhamCode === 'DV'
            ? 'Công dịch vụ'
            : item.loaiSanPhamCode || '—';

      const soLuongHoaDon = Number(item.soLuongHoaDon || 0);
      const donGia = Number(item.donGia || 0);
      const tienChuaThue = Number(item.tienChuaThue || 0);
      const thueSuat =
        Number(item.thueSuat || 0) > 1
          ? Number(item.thueSuat || 0) / 100
          : Number(item.thueSuat || 0);
      const tienCoThue = Number(item.tienCoThue || 0);
      const tienDichVu = Number(item.tienDichVu || 0);
      const tienPhuTung = Number(item.tienPhuTung || 0);
      const giaVonPhuTung = Number(item.giaVonPhuTung || 0);
      const tienChietKhauCt = Number(item.tienChietKhauCt || 0);

      sums.soLuongHoaDon += soLuongHoaDon;
      sums.tienChuaThue += tienChuaThue;
      sums.tienCoThue += tienCoThue;
      sums.tienDichVu += tienDichVu;
      sums.tienPhuTung += tienPhuTung;
      sums.giaVonPhuTung += giaVonPhuTung;
      sums.tienChietKhauCt += tienChietKhauCt;

      const row = sheet.addRow({
        index: idx + 1,
        caseDate: item.caseDate || '—',
        completionDate: item.completionDate || '—',
        soChungTu: item.soChungTu || '—',
        bienSoXe: item.bienSoXe || '—',
        khachHangName: item.khachHangName || '—',
        loaiHienThi,
        sanPhamCode: item.sanPhamCode || '—',
        sanPhamName: item.sanPhamName || '—',
        noiDungChiTiet: item.noiDungChiTiet || item.sanPhamName || '—',
        donViTinhText: item.donViTinhText || '—',
        soLuongHoaDon,
        donGia,
        tienChuaThue,
        thueSuat,
        tienCoThue,
        tienDichVu,
        tienPhuTung,
        giaVonPhuTung,
        tienChietKhauCt,
        khoCode: item.khoCode || '—',
        branchName: item.branchName || '—',
        statusName: item.statusName || '—',
        classification: item.classification || '—',
      });

      row.height = 20;
      row.font = { name: 'Calibri', size: 10 };
      row.alignment = { vertical: 'middle' };

      for (let c = 1; c <= CASE_SERVICES_EXPORT_COLUMNS.length; c++) {
        const colDef = CASE_SERVICES_EXPORT_COLUMNS[c - 1];
        const cell = row.getCell(c);
        cell.border = borderThin;
        if (colDef.style?.numFmt) {
          cell.numFmt = colDef.style.numFmt;
        }
        if (colDef.align) {
          cell.alignment = {
            horizontal: colDef.align,
            vertical: 'middle',
          };
        }
      }
    });

    applyStandardExcelReportLayout(
      sheet,
      CASE_SERVICES_EXPORT_COLUMNS,
      9,
      sums,
    );

    const uint8Array = await workbook.xlsx.writeBuffer();
    return Buffer.from(uint8Array);
  }
}
