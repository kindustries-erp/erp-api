import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { KgaraCase } from '../entities/kgara_case.entity';
import { KgaraCaseSettlement } from '../entities/kgara_case_settlement.entity';
import { KgaraCaseService } from '../entities/kgara_case_service.entity';
import { KgaraBranch } from '../entities/kgara_branch.entity';
import { KgaraGrossProfit } from '../entities/kgara_gross_profit.entity';
import { KgaraCaseLinkedInvoice } from '../entities/kgara_case_linked_invoice.entity';
import { KgaraClientService } from '../kgara-client.service';
import { KgaraCaseServicesQueryService } from './kgara-case-services-query.service';
import {
  initSheetStructure,
  applyStandardExcelReportLayout,
  borderThin,
  COMPLETED_CASES_COLUMNS,
  COMPLETED_CASE_SERVICES_COLUMNS,
  CASE_SERVICES_EXPORT_COLUMNS,
} from '../helpers/kgara-excel-style.helper';

export interface CompletedCasesExportParams {
  branchId?: string;
  date_from?: string;
  date_to?: string;
  date_type?: 'completion_date' | 'case_date';
  classification?: string;
  status?: string;
  q?: string;
}

const CLASSIFICATION_LABELS: Record<string, string> = {
  KY_GUI_NOI_BO: 'Ký gửi nội bộ',
  SUA_CHUA_CHUNG: 'Sửa chữa chung',
  OJ: 'OJ',
  OJ_NGOAI: 'OJ ngoài',
  KHAC: 'Khác',
};

function formatDisplayDate(d?: Date | string | null): string {
  if (!d) return '—';
  try {
    const dt = typeof d === 'string' ? new Date(d) : d;
    if (isNaN(dt.getTime())) return String(d);
    const day = String(dt.getDate()).padStart(2, '0');
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const year = dt.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return String(d);
  }
}

@Injectable()
export class KgaraCaseExportService {
  private readonly logger = new Logger(KgaraCaseExportService.name);

  constructor(
    @InjectRepository(KgaraCase)
    private readonly caseRepo: Repository<KgaraCase>,
    @InjectRepository(KgaraCaseSettlement)
    private readonly settlementRepo: Repository<KgaraCaseSettlement>,
    private readonly caseServicesQueryService: KgaraCaseServicesQueryService,
    @Optional()
    @InjectRepository(KgaraCaseService)
    private readonly serviceRepo?: Repository<KgaraCaseService>,
    @Optional()
    @InjectRepository(KgaraBranch)
    private readonly branchRepo?: Repository<KgaraBranch>,
    @Optional()
    @InjectRepository(KgaraGrossProfit)
    private readonly grossProfitRepo?: Repository<KgaraGrossProfit>,
    @Optional()
    @InjectRepository(KgaraCaseLinkedInvoice)
    private readonly linkedInvoiceRepo?: Repository<KgaraCaseLinkedInvoice>,
    @Optional()
    private readonly client?: KgaraClientService,
  ) {}

  /**
   * Xuất danh sách Phiếu Dịch Vụ đã kết thúc theo kỳ ra file Excel (2 Sheets chuẩn hóa)
   */
  async exportCompletedCasesExcel(
    params: CompletedCasesExportParams,
  ): Promise<Buffer> {
    const qb = this.caseRepo
      .createQueryBuilder('case')
      .leftJoinAndMapOne(
        'case.grossProfit',
        KgaraGrossProfit,
        'gp',
        'gp.hdPhieuDichVuId = case.hdPhieuDichVuId OR gp.vuViecCode = case.soChungTu',
      )
      .where('case.kgaraDeletedAt IS NULL');

    // 1. Phân loại trạng thái
    if (!params.status || params.status.toLowerCase() !== 'all') {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('case.tinhTrangDichVu = 3')
            .orWhere('case.tenTinhTrangDichVu ILIKE :kwHoanTat', {
              kwHoanTat: '%hoàn tất%',
            })
            .orWhere('case.tenTinhTrangDichVu ILIKE :kwKetThuc', {
              kwKetThuc: '%kết thúc%',
            })
            .orWhere('case.ngayHoanThanhCongViec IS NOT NULL');
        }),
      ).andWhere('(case.tinhTrangDichVu IS NULL OR case.tinhTrangDichVu != 9)');
    }

    // 2. Lọc theo ngày
    const dateType = params.date_type || 'completion_date';
    const dateField =
      dateType === 'case_date'
        ? 'COALESCE(case.ngayTiepNhan, case.ngayPhatSinh)'
        : 'case.ngayHoanThanhCongViec';

    if (params.date_from) {
      const fromDate = params.date_from.includes('T')
        ? params.date_from
        : `${params.date_from} 00:00:00`;
      qb.andWhere(`${dateField} >= :fromDate`, { fromDate });
    }
    if (params.date_to) {
      const toDate = params.date_to.includes('T')
        ? params.date_to
        : `${params.date_to} 23:59:59.999`;
      qb.andWhere(`${dateField} <= :toDate`, { toDate });
    }

    // 3. Chi nhánh, phân loại, tìm kiếm
    if (params.branchId) {
      qb.andWhere('case.branchExternalId = :branchId', {
        branchId: params.branchId,
      });
    }
    if (params.classification) {
      qb.andWhere('case.classification = :classification', {
        classification: params.classification,
      });
    }
    if (params.q) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('case.soChungTu ILIKE :q', { q: `%${params.q}%` })
            .orWhere('case.bienSoXe ILIKE :q', { q: `%${params.q}%` })
            .orWhere('case.khachHangName ILIKE :q', { q: `%${params.q}%` })
            .orWhere('case.khachHangCode ILIKE :q', { q: `%${params.q}%` });
        }),
      );
    }

    qb.orderBy('case.ngayHoanThanhCongViec', 'DESC', 'NULLS LAST')
      .addOrderBy('case.ngayPhatSinh', 'DESC', 'NULLS LAST')
      .addOrderBy('case.soChungTu', 'DESC');

    const cases = await qb.getMany();

    // Map tên chi nhánh
    let branchNameMap: Record<string, string> = {};
    if (this.branchRepo) {
      const branches = await this.branchRepo.find();
      branchNameMap = branches.reduce(
        (acc, b) => {
          if (b.externalId) {
            acc[b.externalId] = b.name || b.code || b.externalId;
          }
          return acc;
        },
        {} as Record<string, string>,
      );
    }

    // Map hóa đơn VAT liên kết
    const caseDbIds = cases.map((c) => c.id).filter(Boolean);
    const linkedInvoiceSummaryMap: Record<string, string> = {};
    if (this.linkedInvoiceRepo && caseDbIds.length > 0) {
      try {
        const linkedRows = await this.linkedInvoiceRepo
          .createQueryBuilder('l')
          .leftJoin('erp_invoices', 'inv', 'inv.id = l.invoiceId')
          .select('l.caseDbId', 'caseDbId')
          .addSelect(
            "STRING_AGG(DISTINCT COALESCE(inv.invoice_no, CAST(l.invoiceId AS text)), ', ')",
            'invoiceNos',
          )
          .where('l.caseDbId IN (:...caseDbIds)', { caseDbIds })
          .groupBy('l.caseDbId')
          .getRawMany();

        for (const r of linkedRows) {
          if (r.caseDbId && r.invoiceNos) {
            linkedInvoiceSummaryMap[r.caseDbId] = r.invoiceNos;
          }
        }
      } catch (err) {
        this.logger.warn(`Failed to aggregate linked invoices: ${err}`);
      }
    }

    // Map service lines
    const hdIds = cases.map((c) => c.hdPhieuDichVuId).filter(Boolean);
    const serviceLinesMap = new Map<string, any[]>();
    if (this.serviceRepo && hdIds.length > 0) {
      try {
        const dbLines = await this.serviceRepo
          .createQueryBuilder('line')
          .where('line.hdPhieuDichVuId IN (:...hdIds)', { hdIds })
          .orderBy('line.hdPhieuDichVuId', 'ASC')
          .addOrderBy('line.createdAt', 'ASC')
          .getMany();

        for (const line of dbLines) {
          if (line.hdPhieuDichVuId) {
            const list = serviceLinesMap.get(line.hdPhieuDichVuId) || [];
            list.push(line);
            serviceLinesMap.set(line.hdPhieuDichVuId, list);
          }
        }
      } catch (err) {
        this.logger.warn(`Failed to query service lines: ${err}`);
      }
    }

    // Fetch fallback raw data if needed
    for (const c of cases) {
      if (!c.hdPhieuDichVuId || serviceLinesMap.has(c.hdPhieuDichVuId))
        continue;
      const rawList =
        c.rawData?.ListPhieuDichVuChiTiet ||
        c.rawData?.HoaDonChiTiet ||
        c.rawData?.PhieuDichVuChiTiet;
      if (Array.isArray(rawList) && rawList.length > 0) {
        serviceLinesMap.set(c.hdPhieuDichVuId, rawList);
      }
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Liouni ERP';
    workbook.lastModifiedBy = 'Liouni ERP';
    workbook.created = new Date();

    // ─────────────────────────────────────────────────────────────────────────
    // SHEET 1: BẢNG KÊ PHIẾU DỊCH VỤ ĐÃ KẾT THÚC
    // ─────────────────────────────────────────────────────────────────────────
    const sheet1 = workbook.addWorksheet('Bảng kê phiếu kết thúc');
    initSheetStructure(sheet1, COMPLETED_CASES_COLUMNS);

    const sheet1Sums = {
      tienCoThue: 0,
      doanhThu: 0,
      chiPhi: 0,
      loiNhuan: 0,
      tienDaThanhToan: 0,
      tienConPhaiThanhToan: 0,
    };

    cases.forEach((c: any, idx: number) => {
      const gp = c.grossProfit;
      const rev = Number(c.doanhThu ?? gp?.doanhThu ?? c.tienCoThue) || 0;
      const cost = Number(c.chiPhi ?? gp?.chiPhi) || 0;
      const profit = Number(c.loiNhuan ?? gp?.loiNhuan ?? rev - cost) || 0;
      const margin = rev > 0 ? (profit / rev) * 100 : 0;
      const totalAmount = Number(c.tienCoThue) || rev;
      const paid = Number(c.tienDaThanhToan) || 0;
      const balance =
        Number(c.tienConPhaiThanhToan) || Math.max(0, totalAmount - paid);

      sheet1Sums.tienCoThue += totalAmount;
      sheet1Sums.doanhThu += rev;
      sheet1Sums.chiPhi += cost;
      sheet1Sums.loiNhuan += profit;
      sheet1Sums.tienDaThanhToan += paid;
      sheet1Sums.tienConPhaiThanhToan += balance;

      const branchName =
        branchNameMap[c.branchExternalId] || c.branchExternalId || '—';
      const classLabel = c.classification
        ? CLASSIFICATION_LABELS[c.classification] || c.classification
        : 'Sửa chữa chung';

      const row = sheet1.addRow({
        index: idx + 1,
        soChungTu: c.soChungTu || '—',
        bienSoXe: c.bienSoXe || '—',
        khachHangCode: c.khachHangCode || '—',
        khachHangName: c.khachHangName || '—',
        branchName,
        classification: classLabel,
        ngayTiepNhan: formatDisplayDate(c.ngayTiepNhan || c.ngayPhatSinh),
        ngayHoanThanhCongViec: formatDisplayDate(c.ngayHoanThanhCongViec),
        tienCoThue: totalAmount,
        doanhThu: rev,
        chiPhi: cost,
        loiNhuan: profit,
        margin: margin / 100,
        tienDaThanhToan: paid,
        tienConPhaiThanhToan: balance,
        linkedInvoices: linkedInvoiceSummaryMap[c.id] || '—',
        tenTinhTrangDichVu: c.tenTinhTrangDichVu || 'Đã kết thúc',
      });

      row.height = 20;
      row.font = { name: 'Calibri', size: 10 };
      row.alignment = { vertical: 'middle' };

      row.getCell('index').alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      row.getCell('bienSoXe').alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      row.getCell('classification').alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      row.getCell('ngayTiepNhan').alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      row.getCell('ngayHoanThanhCongViec').alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      row.getCell('tenTinhTrangDichVu').alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };

      for (let col = 1; col <= COMPLETED_CASES_COLUMNS.length; col++) {
        row.getCell(col).border = borderThin;
      }
    });

    applyStandardExcelReportLayout(
      sheet1,
      COMPLETED_CASES_COLUMNS,
      5,
      sheet1Sums,
      {
        sumRow: { margin: 'IF(K1>0, (M1/K1), 0)' },
        subtotalRow: { margin: 'IF(K2>0, (M2/K2), 0)' },
      },
    );

    // ─────────────────────────────────────────────────────────────────────────
    // SHEET 2: CHI TIẾT DỊCH VỤ & PHỤ TÙNG
    // ─────────────────────────────────────────────────────────────────────────
    const sheet2 = workbook.addWorksheet('Chi tiết DV & Phụ tùng');
    initSheetStructure(sheet2, COMPLETED_CASE_SERVICES_COLUMNS);

    const sheet2Sums = {
      soLuongHoaDon: 0,
      tienChuaThue: 0,
      tienCoThue: 0,
      soGioCongLam: 0,
      tienDichVu: 0,
      tienPhuTung: 0,
      giaVonPhuTung: 0,
      tienChietKhauCt: 0,
    };

    let lineIdx = 0;
    for (const c of cases) {
      if (!c.hdPhieuDichVuId) continue;
      const lines = serviceLinesMap.get(c.hdPhieuDichVuId) || [];
      for (const line of lines) {
        lineIdx++;
        const loaiSanPhamCode =
          line.loaiSanPhamCode || line.LoaiSanPhamCode || '';
        const tienPhuTung = Number(line.tienPhuTung ?? line.TienPhuTung ?? 0);
        const loaiChiTiet = line.loaiChiTiet ?? line.LoaiChiTiet;
        const nhomInName = (
          line.nhomInName ||
          line.NhomInName ||
          ''
        ).toLowerCase();

        const isPt =
          loaiSanPhamCode === 'PT' ||
          loaiChiTiet === 1 ||
          loaiChiTiet === 4 ||
          nhomInName.includes('phụ tùng') ||
          nhomInName.includes('vật tư') ||
          tienPhuTung > 0;

        const loaiHienThi = isPt ? 'Phụ tùng' : 'Dịch vụ';
        const sanPhamCode = line.sanPhamCode || line.SanPhamCode || '—';
        const sanPhamName =
          line.sanPhamName ||
          line.SanPhamName ||
          line.noiDungChiTiet ||
          line.NoiDungChiTiet ||
          '—';
        const noiDungChiTiet =
          line.noiDungChiTiet || line.NoiDungChiTiet || '—';
        const donViTinhText = line.donViTinhText || line.DonViTinhText || '—';
        const soLuongHoaDon = Number(
          line.soLuongHoaDon ?? line.SoLuongHoaDon ?? 0,
        );
        const donGia = Number(line.donGia ?? line.DonGia ?? 0);
        const tienChuaThue = Number(
          line.tienChuaThue ?? line.TienChuaThue ?? 0,
        );
        const thueSuat =
          Number(line.thueSuat ?? line.ThueSuat ?? 0) > 1
            ? Number(line.thueSuat ?? line.ThueSuat ?? 0) / 100
            : Number(line.thueSuat ?? line.ThueSuat ?? 0);
        const tienCoThue = Number(line.tienCoThue ?? line.TienCoThue ?? 0);
        const soGioCongLam = Number(
          line.soGioCongLam ?? line.SoGioCongLam ?? 0,
        );
        const tienDichVu = Number(line.tienDichVu ?? line.TienDichVu ?? 0);
        const giaVonPhuTung = Number(
          line.giaVonPhuTung ?? line.GiaVonPhuTung ?? 0,
        );
        const tienChietKhauCt = Number(
          line.tienChietKhauCt ??
            line.TienChietKhauCT ??
            line.TienChietKhauCt ??
            0,
        );
        const khoCode = line.khoCode || line.KhoCode || line.KhoName || '—';
        const ghiChu =
          line.ghiChu ||
          line.GhiChuChiTiet ||
          (line.TienPhuPhi || line.tienPhuPhi
            ? `Phụ phí: ${line.TienPhuPhi || line.tienPhuPhi}`
            : '—');

        sheet2Sums.soLuongHoaDon += soLuongHoaDon;
        sheet2Sums.tienChuaThue += tienChuaThue;
        sheet2Sums.tienCoThue += tienCoThue;
        sheet2Sums.soGioCongLam += soGioCongLam;
        sheet2Sums.tienDichVu += tienDichVu;
        sheet2Sums.tienPhuTung += tienPhuTung;
        sheet2Sums.giaVonPhuTung += giaVonPhuTung;
        sheet2Sums.tienChietKhauCt += tienChietKhauCt;

        const row = sheet2.addRow({
          index: lineIdx,
          soChungTu: c.soChungTu || '—',
          bienSoXe: c.bienSoXe || '—',
          loaiHienThi,
          sanPhamCode,
          sanPhamName,
          noiDungChiTiet,
          donViTinhText,
          soLuongHoaDon,
          donGia,
          tienChuaThue,
          thueSuat,
          tienCoThue,
          soGioCongLam,
          tienDichVu,
          tienPhuTung,
          giaVonPhuTung,
          tienChietKhauCt,
          khoCode,
          ghiChu,
        });

        row.height = 20;
        row.font = { name: 'Calibri', size: 10 };
        row.alignment = { vertical: 'middle' };

        row.getCell('index').alignment = {
          horizontal: 'center',
          vertical: 'middle',
        };
        row.getCell('bienSoXe').alignment = {
          horizontal: 'center',
          vertical: 'middle',
        };
        row.getCell('loaiHienThi').alignment = {
          horizontal: 'center',
          vertical: 'middle',
        };
        row.getCell('donViTinhText').alignment = {
          horizontal: 'center',
          vertical: 'middle',
        };
        row.getCell('thueSuat').alignment = {
          horizontal: 'center',
          vertical: 'middle',
        };
        row.getCell('khoCode').alignment = {
          horizontal: 'center',
          vertical: 'middle',
        };

        for (
          let col = 1;
          col <= COMPLETED_CASE_SERVICES_COLUMNS.length;
          col++
        ) {
          row.getCell(col).border = borderThin;
        }
      }
    }

    applyStandardExcelReportLayout(
      sheet2,
      COMPLETED_CASE_SERVICES_COLUMNS,
      6,
      sheet2Sums,
    );

    const uint8Array = await workbook.xlsx.writeBuffer();
    return Buffer.from(uint8Array);
  }

  /**
   * Xuất danh sách chi tiết Hạng mục Dịch vụ & Phụ tùng ra file Excel (24 cột chuẩn hóa)
   */
  async exportCaseServicesExcel(params: {
    branchId?: string;
    q?: string;
    from?: string;
    to?: string;
    serviceType?: string;
    filtersStr?: string;
    sorts?: string | string[];
  }): Promise<Buffer> {
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

      row.getCell('index').alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      row.getCell('caseDate').alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      row.getCell('completionDate').alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      row.getCell('bienSoXe').alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      row.getCell('loaiHienThi').alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      row.getCell('donViTinhText').alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      row.getCell('thueSuat').alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      row.getCell('khoCode').alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      row.getCell('statusName').alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      row.getCell('classification').alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };

      for (let c = 1; c <= CASE_SERVICES_EXPORT_COLUMNS.length; c++) {
        row.getCell(c).border = borderThin;
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
