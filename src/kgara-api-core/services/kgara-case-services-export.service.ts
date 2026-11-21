import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { KgaraCaseServicesQueryService } from './kgara-case-services-query.service';
import { KgaraGrossProfit } from '../entities/kgara_gross_profit.entity';
import { KgaraCostEnricherHelper } from '../helpers/kgara-cost-enricher.helper';
import {
  ITEMIZED_SHEET_NAMES,
  itemizedSheetKeyOf,
  type ItemizedSheetKey,
} from '../helpers/kgara-itemized-sheets.builder';
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
  private readonly logger = new Logger(KgaraCaseServicesExportService.name);

  constructor(
    private readonly caseServicesQueryService: KgaraCaseServicesQueryService,
    @Optional()
    @InjectRepository(KgaraGrossProfit)
    private readonly grossProfitRepo?: Repository<KgaraGrossProfit>,
  ) {}

  /**
   * Làm giàu đơn giá vốn / tổng vốn theo từng phiếu từ journal đã lưu (kgara_gross_profit).
   * Chỉ tính trong bộ nhớ, không gọi KGara và không ghi DB.
   */
  private async enrichItemsWithJournal(items: any[]): Promise<any[]> {
    if (!this.grossProfitRepo || items.length === 0) return items;

    const indexesByCode = new Map<string, number[]>();
    items.forEach((item, idx) => {
      if (!item.soChungTu) return;
      const list = indexesByCode.get(item.soChungTu) || [];
      list.push(idx);
      indexesByCode.set(item.soChungTu, list);
    });
    const codes = [...indexesByCode.keys()];
    if (codes.length === 0) return items;

    try {
      const chunkSize = 2000;
      const rows: KgaraGrossProfit[] = [];
      for (let i = 0; i < codes.length; i += chunkSize) {
        const found = await this.grossProfitRepo
          .createQueryBuilder('gp')
          .select(['gp.vuViecCode', 'gp.rawData'])
          .where('gp.vuViecCode IN (:...codes)', {
            codes: codes.slice(i, i + chunkSize),
          })
          .getMany();
        rows.push(...found);
      }

      const index = KgaraCostEnricherHelper.buildJournalIndex(rows);
      const out = items.slice();
      for (const [code, idxs] of indexesByCode) {
        const journal = KgaraCostEnricherHelper.pickJournal(index, null, code);
        if (!journal) continue;
        const enriched = KgaraCostEnricherHelper.enrichCaseLines(
          idxs.map((i) => items[i]),
          journal,
        ).lines;
        idxs.forEach((itemIdx, k) => {
          out[itemIdx] = enriched[k];
        });
      }
      return out;
    } catch (err: any) {
      this.logger.warn(
        `Làm giàu giá vốn từ journal thất bại cho ${codes.length} phiếu, xuất giá vốn như đã lưu: ${err?.message || err}`,
      );
      return items;
    }
  }

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

    const items = await this.enrichItemsWithJournal(result.data || []);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ERP';
    workbook.created = new Date();

    // Tách công khỏi DV/PT (theo ĐVT) và OJ khỏi MAIN; mỗi dòng đúng một sheet.
    const groups = new Map<ItemizedSheetKey, any[]>();
    for (const item of items) {
      const key = itemizedSheetKeyOf({ accountKey: item.accountKey }, item);
      const list = groups.get(key) ?? [];
      list.push(item);
      groups.set(key, list);
    }
    (Object.keys(ITEMIZED_SHEET_NAMES) as ItemizedSheetKey[]).forEach((key) => {
      const list = groups.get(key) ?? [];
      if (key !== 'main' && list.length === 0) return;
      this.addServicesSheet(workbook, ITEMIZED_SHEET_NAMES[key], list);
    });

    const uint8Array = await workbook.xlsx.writeBuffer();
    return Buffer.from(uint8Array);
  }

  /** Một sheet chi tiết hạng mục (24 cột chuẩn hóa) cho một nhóm dòng, có tổng riêng. */
  private addServicesSheet(
    workbook: ExcelJS.Workbook,
    sheetName: string,
    items: any[],
  ): void {
    const sheet = workbook.addWorksheet(sheetName);
    initSheetStructure(sheet, CASE_SERVICES_EXPORT_COLUMNS);

    const sums = {
      soLuongHoaDon: 0,
      tienChuaThue: 0,
      tienCoThue: 0,
      tienDichVu: 0,
      tienPhuTung: 0,
      tongVon: 0,
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
      const { unit: giaVonDonVi, total: tongVon } =
        KgaraCostEnricherHelper.resolveLineCost(item);
      const tienChietKhauCt = Number(item.tienChietKhauCt || 0);

      sums.soLuongHoaDon += soLuongHoaDon;
      sums.tienChuaThue += tienChuaThue;
      sums.tienCoThue += tienCoThue;
      sums.tienDichVu += tienDichVu;
      sums.tienPhuTung += tienPhuTung;
      sums.tongVon += tongVon;
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
        giaVonPhuTung: giaVonDonVi,
        tongVon,
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
  }
}
