import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { format } from 'date-fns';
import { KgaraCase } from '../entities/kgara_case.entity';
import { KgaraGrossProfit } from '../entities/kgara_gross_profit.entity';
import { GarageDashboardStatsService } from './garage-dashboard-stats.service';

@Injectable()
export class GarageDashboardExportService {
  private readonly logger = new Logger(GarageDashboardExportService.name);

  constructor(
    @InjectRepository(KgaraCase)
    private readonly caseRepo: Repository<KgaraCase>,
    private readonly statsService: GarageDashboardStatsService,
  ) {}

  /**
   * 5. Xuất báo cáo Excel chuyên nghiệp đa bảng (Multi-sheet Export) theo Ngày hoàn thành
   */
  async exportExcel(dateFrom?: string, dateTo?: string): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();

    // Sheet 1: Tổng quan Xu hướng Tháng
    const stats = await this.statsService.getDashboardStats(dateFrom, dateTo);
    const sheet1 = workbook.addWorksheet('Tổng quan Tháng');
    sheet1.views = [{ state: 'frozen', ySplit: 1 }];
    sheet1.autoFilter = 'A1:L1';
    sheet1.columns = [
      { header: 'Tháng', key: 'month', width: 15 },
      {
        header: 'Doanh thu (VND)',
        key: 'revenue',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Giá vốn (VND)',
        key: 'cost',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Lợi nhuận gộp (VND)',
        key: 'profit',
        width: 22,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Biên LN (%)',
        key: 'margin',
        width: 15,
        style: { numFmt: '0.0"%"' },
      },
      {
        header: 'Đã thu (VND)',
        key: 'paid',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Còn phải thu (VND)',
        key: 'receivable',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Tỷ lệ thu (%)',
        key: 'collectionRate',
        width: 15,
        style: { numFmt: '0.0"%"' },
      },
      {
        header: 'Đã chi trả CP (VND)',
        key: 'paidCost',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Còn nợ NCC (VND)',
        key: 'payableCost',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Tỷ lệ chi (%)',
        key: 'costPaymentRate',
        width: 15,
        style: { numFmt: '0.0"%"' },
      },
      { header: 'Số vụ việc', key: 'caseCount', width: 15 },
    ];

    stats.trend.forEach((t) => {
      sheet1.addRow({
        month: t.label,
        revenue: t.revenue,
        cost: t.cost,
        profit: t.profit,
        margin: t.margin,
        paid: t.paid,
        receivable: t.receivable,
        collectionRate: t.collectionRate,
        paidCost: t.paidCost,
        payableCost: t.payableCost,
        costPaymentRate: t.costPaymentRate,
        caseCount: t.caseCount,
      });
    });

    // Sheet 2: Chi tiết Phiếu Dịch Vụ
    const casesQb = this.caseRepo
      .createQueryBuilder('c')
      .leftJoinAndMapOne(
        'c.grossProfit',
        KgaraGrossProfit,
        'gp',
        'gp.hd_phieu_dich_vu_id = c.hd_phieu_dich_vu_id OR gp.vu_viec_code = c.so_chung_tu',
      )
      .where('c.kgara_deleted_at IS NULL')
      .andWhere('(c.tinh_trang_dich_vu IS NULL OR c.tinh_trang_dich_vu != 9)')
      .andWhere('c.ngay_hoan_thanh_cong_viec IS NOT NULL');

    if (dateFrom) {
      casesQb.andWhere('c.ngay_hoan_thanh_cong_viec >= :dateFrom', {
        dateFrom,
      });
    }
    if (dateTo) {
      const effectiveDateTo =
        dateTo.length === 10 ? `${dateTo} 23:59:59.999` : dateTo;
      casesQb.andWhere('c.ngay_hoan_thanh_cong_viec <= :dateTo', {
        dateTo: effectiveDateTo,
      });
    }

    casesQb.orderBy('c.ngayHoanThanhCongViec', 'DESC');
    const cases = await casesQb.getMany();

    const sheet2 = workbook.addWorksheet('Chi tiết Phiếu dịch vụ');
    sheet2.views = [{ state: 'frozen', ySplit: 1 }];
    sheet2.autoFilter = 'A1:L1';
    sheet2.columns = [
      { header: 'Ngày hoàn thành', key: 'ngayHoanThanhCongViec', width: 18 },
      { header: 'Ngày phát sinh', key: 'ngayPhatSinh', width: 16 },
      { header: 'Số chứng từ', key: 'soChungTu', width: 18 },
      { header: 'Biển số xe', key: 'bienSoXe', width: 15 },
      { header: 'Mã khách hàng', key: 'khachHangCode', width: 18 },
      { header: 'Tên khách hàng', key: 'khachHangName', width: 30 },
      { header: 'Trạng thái dịch vụ', key: 'tenTinhTrangDichVu', width: 20 },
      {
        header: 'Doanh thu (VND)',
        key: 'doanhThu',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Giá vốn (VND)',
        key: 'chiPhi',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Lãi gộp (VND)',
        key: 'loiNhuan',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Đã trả (VND)',
        key: 'tienDaThanhToan',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Còn nợ (VND)',
        key: 'tienConPhaiThanhToan',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
    ];

    cases.forEach((c: any) => {
      const dtComplete = c.ngayHoanThanhCongViec;
      const dt = c.ngayPhatSinh || c.createdAt;
      const gp = c.grossProfit;
      const rev = Number(gp?.doanhThu ?? c.doanhThu ?? c.tienCoThue ?? 0);
      const cost = Number(gp?.chiPhi ?? c.chiPhi ?? 0);
      const profit = Number(gp?.loiNhuan ?? c.loiNhuan ?? rev - cost);

      sheet2.addRow({
        ngayHoanThanhCongViec: dtComplete
          ? format(new Date(dtComplete), 'yyyy-MM-dd')
          : '',
        ngayPhatSinh: dt ? format(new Date(dt), 'yyyy-MM-dd') : '',
        soChungTu: c.soChungTu || '',
        bienSoXe: c.bienSoXe || '',
        khachHangCode: c.khachHangCode || '',
        khachHangName: c.khachHangName || '',
        tenTinhTrangDichVu: c.tenTinhTrangDichVu || '',
        doanhThu: rev,
        chiPhi: cost,
        loiNhuan: profit,
        tienDaThanhToan: Number(c.tienDaThanhToan ?? 0),
        tienConPhaiThanhToan: Number(c.tienConPhaiThanhToan ?? 0),
      });
    });

    // Định dạng tiêu đề cho tất cả worksheet
    workbook.worksheets.forEach((s) => {
      s.getRow(1).font = { bold: true };
      s.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };
      s.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as unknown as Buffer;
  }
}
