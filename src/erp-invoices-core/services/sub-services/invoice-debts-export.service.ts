import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workbook } from 'exceljs';
import { ErpInvoice } from '../../entities/erp_invoice.entity';
import {
  GetInvoiceDebtsQueryDto,
  InvoicePartnerType,
} from '../../dto/get-invoice-debts.dto';
import { InvoiceDebtsQueryService } from './invoice-debts-query.service';

@Injectable()
export class InvoiceDebtsExportService {
  constructor(
    private readonly debtsQueryService: InvoiceDebtsQueryService,
    @InjectRepository(ErpInvoice)
    private readonly invoiceRepo: Repository<ErpInvoice>,
  ) {}

  /**
   * Xuất file Excel báo cáo tổng hợp và chi tiết công nợ
   */
  async exportDebtsExcel(
    queryDto: GetInvoiceDebtsQueryDto,
    options?: {
      onProgress?: (current: number, total: number, message: string) => void;
    },
  ): Promise<Buffer> {
    const workbook = new Workbook();
    workbook.creator = 'Liouni ERP';
    workbook.created = new Date();

    const partnerType = queryDto.partner_type || InvoicePartnerType.CUSTOMER;
    const isSupplier = partnerType === InvoicePartnerType.SUPPLIER;
    const direction = isSupplier ? 'IN' : 'OUT';

    options?.onProgress?.(10, 100, 'Đang truy vấn dữ liệu công nợ...');

    // 1. Truy vấn danh sách tổng hợp công nợ (lấy toàn bộ)
    const debtsResponse = await this.debtsQueryService.getDebts({
      ...queryDto,
      page: 1,
      pageSize: 100000,
    });
    const partners = debtsResponse.items || [];
    const summary = debtsResponse.summary;

    options?.onProgress?.(40, 100, 'Đang truy vấn chi tiết hóa đơn...');

    // 2. Truy vấn danh sách chi tiết hóa đơn theo bộ lọc
    let detailedInvoicesQuery = `
      SELECT 
        inv.id,
        inv.invoice_no as "invoiceNo",
        inv.serial_no as "serialNo",
        TO_CHAR(inv.invoice_date, 'YYYY-MM-DD') as "invoiceDate",
        inv.direction,
        COALESCE(NULLIF(TRIM(inv.seller_name), ''), 'Nhà cung cấp') as "sellerName",
        COALESCE(NULLIF(TRIM(inv.seller_tax_code), ''), 'KHONG_MST') as "sellerTaxCode",
        COALESCE(NULLIF(TRIM(inv.buyer_name), ''), NULLIF(TRIM(inv.buyer_personal_name), ''), 'Khách hàng lẻ') as "buyerName",
        COALESCE(NULLIF(TRIM(inv.buyer_tax_code), ''), NULLIF(TRIM(inv.buyer_cccd), ''), 'KHONG_MST') as "buyerTaxCode",
        inv.description,
        inv.status,
        inv.pre_vat_amount as "preVatAmount",
        inv.vat_amount as "vatAmount",
        inv.total_amount as "totalAmount",
        COALESCE(netoff.net_off_amount, 0) as "paidAmount",
        GREATEST(0, CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0)) as "balanceAmount",
        CASE 
          WHEN (CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0)) > 0 
          THEN GREATEST(0, (CURRENT_DATE - inv.invoice_date::date))
          ELSE 0 
        END as "agingDays"
      FROM erp_invoices inv
      LEFT JOIN (
        SELECT invoice_id, SUM(net_off_amount) as net_off_amount
        FROM erp_invoice_voucher_netoff
        GROUP BY invoice_id
      ) netoff ON netoff.invoice_id = inv.id
      WHERE inv.is_deleted = false 
        AND (inv.tax_invoice_status IS NULL OR inv.tax_invoice_status != 4)
        AND inv.direction = '${direction}'
    `;

    if (queryDto.date_from) {
      detailedInvoicesQuery += ` AND inv.invoice_date >= '${queryDto.date_from.replace(/'/g, "''")}'`;
    }
    if (queryDto.date_to) {
      const effTo =
        queryDto.date_to.length === 10
          ? `${queryDto.date_to} 23:59:59.999`
          : queryDto.date_to;
      detailedInvoicesQuery += ` AND inv.invoice_date <= '${effTo.replace(/'/g, "''")}'`;
    }
    if (queryDto.branch_id) {
      if (queryDto.branch_id === 'null') {
        detailedInvoicesQuery += ` AND inv.branch_id IS NULL`;
      } else {
        detailedInvoicesQuery += ` AND inv.branch_id = '${queryDto.branch_id.replace(/'/g, "''")}'`;
      }
    }

    detailedInvoicesQuery += ` ORDER BY inv.invoice_date DESC, inv.invoice_no DESC`;

    const detailedInvoices = await this.invoiceRepo.query(
      detailedInvoicesQuery,
    );

    options?.onProgress?.(65, 100, 'Đang khởi tạo các trang tính Excel...');

    // ── SHEET 1: TỔNG HỢP CÔNG NỢ & TUỔI NỢ ──────────────────────────────
    const sheet1Title = isSupplier
      ? 'Tổng hợp công nợ NCC'
      : 'Tổng hợp công nợ KH';
    const sheet1 = workbook.addWorksheet(sheet1Title);

    // Tiêu đề báo cáo
    sheet1.addRow([
      `BÁO CÁO TỔNG HỢP CÔNG NỢ & PHÂN TẦNG TUỔI NỢ ${isSupplier ? 'NHÀ CUNG CẤP (PHẢI TRẢ)' : 'KHÁCH HÀNG (PHẢI THU)'}`,
    ]);
    sheet1.addRow([
      `Khoảng thời gian: ${queryDto.date_from || 'Đầu kỳ'} - ${queryDto.date_to || 'Hiện tại'}`,
    ]);
    sheet1.addRow([
      `Ngày xuất: ${new Date().toLocaleString('vi-VN')} | Tổng số đối tác: ${partners.length}`,
    ]);
    sheet1.addRow([]); // Blank line

    const titleRow = sheet1.getRow(1);
    titleRow.font = {
      name: 'Calibri',
      size: 14,
      bold: true,
      color: { argb: 'FF1E293B' },
    };
    sheet1.getRow(2).font = {
      name: 'Calibri',
      size: 10,
      italic: true,
      color: { argb: 'FF475569' },
    };
    sheet1.getRow(3).font = {
      name: 'Calibri',
      size: 10,
      italic: true,
      color: { argb: 'FF64748B' },
    };

    // Cấu hình bảng dữ liệu
    const headerRowIndex = 5;
    const headers = [
      'STT',
      isSupplier ? 'Tên nhà cung cấp' : 'Tên khách hàng',
      'Mã số thuế / CCCD',
      'Địa chỉ',
      'SL Hóa đơn',
      isSupplier ? 'Tổng phải trả' : 'Tổng phải thu',
      isSupplier ? 'Đã trả' : 'Đã thu',
      isSupplier ? 'Còn phải trả' : 'Còn phải thu',
      'Nợ 0-30 ngày',
      'Nợ 31-60 ngày',
      'Nợ 61-90 ngày',
      'Nợ >90 ngày',
      'Tuổi nợ max (ngày)',
      'Tuổi nợ BQ (ngày)',
      'Đánh giá rủi ro',
      'Ngày HĐ gần nhất',
    ];

    sheet1.addRow(headers);
    const headerRow = sheet1.getRow(headerRowIndex);
    headerRow.height = 28;
    headerRow.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    headerRow.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
    };

    // Default header fill
    for (let c = 1; c <= 16; c++) {
      headerRow.getCell(c).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isSupplier ? 'FF334155' : 'FF1E3A8A' },
      };
    }

    // Specific aging header color accents
    headerRow.getCell(9).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF059669' }, // Emerald
    };
    headerRow.getCell(10).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD97706' }, // Amber
    };
    headerRow.getCell(11).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEA580C' }, // Orange
    };
    headerRow.getCell(12).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE11D48' }, // Rose/Red
    };

    // Độ rộng các cột
    sheet1.columns = [
      { key: 'stt', width: 8 },
      { key: 'partnerName', width: 36 },
      { key: 'taxCode', width: 18 },
      { key: 'address', width: 32 },
      { key: 'invoiceCount', width: 14 },
      { key: 'totalAmount', width: 22 },
      { key: 'paidAmount', width: 22 },
      { key: 'balanceAmount', width: 22 },
      { key: 'aging0To30', width: 22 },
      { key: 'aging31To60', width: 22 },
      { key: 'aging61To90', width: 22 },
      { key: 'agingOver90', width: 22 },
      { key: 'maxAgingDays', width: 16 },
      { key: 'weightedAgingDays', width: 16 },
      { key: 'agingCategory', width: 28 },
      { key: 'latestInvoiceDate', width: 16 },
    ];

    // Đổ dữ liệu
    partners.forEach((p, idx) => {
      const bal = Number(p.balanceAmount) || 0;
      const aging = Number(p.maxAgingDays) || 0;
      const weightedAging = Number(p.weightedAgingDays) || 0;
      const a0_30 = Number(p.aging0To30) || 0;
      const a31_60 = Number(p.aging31To60) || 0;
      const a61_90 = Number(p.aging61To90) || 0;
      const aOver90 = Number(p.agingOver90) || 0;

      let agingCategory = 'Đã tất toán (0% nợ)';
      if (bal > 0) {
        if (aOver90 > 0 && aOver90 >= bal * 0.99) {
          agingCategory = '>90 ngày (Nợ xấu / Nghiêm trọng)';
        } else if (aOver90 > 0) {
          agingCategory = 'Đa tầng (Có nợ quá hạn >90d)';
        } else if (a61_90 > 0) {
          agingCategory = '61-90 ngày (Quá hạn)';
        } else if (a31_60 > 0) {
          agingCategory = '31-60 ngày (Cần theo dõi)';
        } else {
          agingCategory = '0-30 ngày (Trong hạn 100%)';
        }
      }

      const row = sheet1.addRow([
        idx + 1,
        p.partnerName || '—',
        p.taxCode === 'KHONG_MST' ? '—' : p.taxCode,
        p.address || '—',
        Number(p.invoiceCount) || 0,
        Number(p.totalAmount) || 0,
        Number(p.paidAmount) || 0,
        bal,
        a0_30,
        a31_60,
        a61_90,
        aOver90,
        bal > 0 ? aging : 0,
        bal > 0 ? weightedAging : 0,
        agingCategory,
        p.latestInvoiceDate || '—',
      ]);

      row.height = 20;
      row.font = { name: 'Calibri', size: 10 };

      // Định dạng từng ô
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(4).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(5).numFmt = '#,##0';
      row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(6).numFmt = '#,##0.00';
      row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(7).numFmt = '#,##0.00';
      row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(8).numFmt = '#,##0.00';
      if (bal > 0) {
        row.getCell(8).font = {
          name: 'Calibri',
          size: 10,
          bold: true,
          color: { argb: 'FFDC2626' },
        };
      } else {
        row.getCell(8).font = {
          name: 'Calibri',
          size: 10,
          color: { argb: 'FF059669' },
        };
      }

      // Aging columns I, J, K, L with distinctive background colors
      row.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(9).numFmt = '#,##0.00';
      row.getCell(9).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF0FDF4' }, // Light emerald
      };
      row.getCell(9).font = {
        name: 'Calibri',
        size: 10,
        color: { argb: a0_30 > 0 ? 'FF065F46' : 'FF94A3B8' },
        bold: a0_30 > 0,
      };

      row.getCell(10).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(10).numFmt = '#,##0.00';
      row.getCell(10).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFFBEB' }, // Light amber
      };
      row.getCell(10).font = {
        name: 'Calibri',
        size: 10,
        color: { argb: a31_60 > 0 ? 'FF92400E' : 'FF94A3B8' },
        bold: a31_60 > 0,
      };

      row.getCell(11).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(11).numFmt = '#,##0.00';
      row.getCell(11).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFF7ED' }, // Light orange
      };
      row.getCell(11).font = {
        name: 'Calibri',
        size: 10,
        color: { argb: a61_90 > 0 ? 'FF9A3412' : 'FF94A3B8' },
        bold: a61_90 > 0,
      };

      row.getCell(12).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(12).numFmt = '#,##0.00';
      row.getCell(12).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFF1F2' }, // Light rose
      };
      row.getCell(12).font = {
        name: 'Calibri',
        size: 10,
        color: { argb: aOver90 > 0 ? 'FF9F1239' : 'FF94A3B8' },
        bold: aOver90 > 0,
      };

      row.getCell(13).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(13).numFmt = '#,##0';
      row.getCell(14).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(14).numFmt = '#,##0';
      row.getCell(15).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(16).alignment = { horizontal: 'center', vertical: 'middle' };

      // Border mỏng
      for (let c = 1; c <= 16; c++) {
        row.getCell(c).border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      }
    });

    // Dòng tổng cộng Footer Sheet 1
    const lastDataRowIndex = headerRowIndex + partners.length;
    const summaryRow = sheet1.addRow([
      '',
      'TỔNG CỘNG',
      '',
      '',
      summary.totalInvoiceCount || {
        formula: `SUM(E${headerRowIndex + 1}:E${lastDataRowIndex})`,
      },
      summary.grandTotalAmount || {
        formula: `SUM(F${headerRowIndex + 1}:F${lastDataRowIndex})`,
      },
      summary.grandTotalPaid || {
        formula: `SUM(G${headerRowIndex + 1}:G${lastDataRowIndex})`,
      },
      summary.grandTotalBalance || {
        formula: `SUM(H${headerRowIndex + 1}:H${lastDataRowIndex})`,
      },
      summary.grandTotalAging0To30 ?? {
        formula: `SUM(I${headerRowIndex + 1}:I${lastDataRowIndex})`,
      },
      summary.grandTotalAging31To60 ?? {
        formula: `SUM(J${headerRowIndex + 1}:J${lastDataRowIndex})`,
      },
      summary.grandTotalAging61To90 ?? {
        formula: `SUM(K${headerRowIndex + 1}:K${lastDataRowIndex})`,
      },
      summary.grandTotalAgingOver90 ?? {
        formula: `SUM(L${headerRowIndex + 1}:L${lastDataRowIndex})`,
      },
      '',
      '',
      '',
      '',
    ]);

    summaryRow.height = 24;
    summaryRow.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FF0F172A' },
    };
    for (let c = 1; c <= 16; c++) {
      summaryRow.getCell(c).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F5F9' },
      };
    }

    summaryRow.getCell(2).alignment = {
      horizontal: 'left',
      vertical: 'middle',
    };
    summaryRow.getCell(5).alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };
    summaryRow.getCell(5).numFmt = '#,##0';
    for (let colIdx = 6; colIdx <= 8; colIdx++) {
      summaryRow.getCell(colIdx).alignment = {
        horizontal: 'right',
        vertical: 'middle',
      };
      summaryRow.getCell(colIdx).numFmt = '#,##0.00';
    }

    // Summary aging columns styling with soft tinted background
    summaryRow.getCell(9).alignment = {
      horizontal: 'right',
      vertical: 'middle',
    };
    summaryRow.getCell(9).numFmt = '#,##0.00';
    summaryRow.getCell(9).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFDCFCE7' },
    };
    summaryRow.getCell(9).font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FF065F46' },
    };

    summaryRow.getCell(10).alignment = {
      horizontal: 'right',
      vertical: 'middle',
    };
    summaryRow.getCell(10).numFmt = '#,##0.00';
    summaryRow.getCell(10).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFEF3C7' },
    };
    summaryRow.getCell(10).font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FF92400E' },
    };

    summaryRow.getCell(11).alignment = {
      horizontal: 'right',
      vertical: 'middle',
    };
    summaryRow.getCell(11).numFmt = '#,##0.00';
    summaryRow.getCell(11).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFEDD5' },
    };
    summaryRow.getCell(11).font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FF9A3412' },
    };

    summaryRow.getCell(12).alignment = {
      horizontal: 'right',
      vertical: 'middle',
    };
    summaryRow.getCell(12).numFmt = '#,##0.00';
    summaryRow.getCell(12).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFE4E6' },
    };
    summaryRow.getCell(12).font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FF9F1239' },
    };

    for (let c = 1; c <= 16; c++) {
      summaryRow.getCell(c).border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'double', color: { argb: 'FF0F172A' } },
      };
    }

    sheet1.views = [{ state: 'frozen', ySplit: headerRowIndex }];
    sheet1.autoFilter = `A${headerRowIndex}:P${lastDataRowIndex}`;

    // ── SHEET 2: CHI TIẾT HÓA ĐƠN ĐỐI TÁC ─────────────────────────────────
    options?.onProgress?.(85, 100, 'Đang điền chi tiết hóa đơn...');

    const sheet2 = workbook.addWorksheet('Chi tiết hóa đơn đối tác');
    const sheet2Headers = [
      'STT',
      'Mã số thuế',
      'Tên đối tác',
      'Ngày hóa đơn',
      'Ký hiệu HĐ',
      'Số hóa đơn',
      'Diễn giải',
      'Tiền trước thuế',
      'Thuế VAT',
      'Tổng tiền HĐ',
      'Đã thanh toán',
      'Còn lại',
      '0-30 ngày',
      '31-60 ngày',
      '61-90 ngày',
      '>90 ngày',
      'Tuổi nợ (ngày)',
      'Trạng thái',
    ];

    sheet2.addRow(sheet2Headers);
    const s2HeaderRow = sheet2.getRow(1);
    s2HeaderRow.height = 26;
    s2HeaderRow.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    s2HeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };

    for (let c = 1; c <= 18; c++) {
      s2HeaderRow.getCell(c).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF334155' },
      };
    }

    // Specific aging header color accents for Sheet 2
    s2HeaderRow.getCell(13).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF059669' }, // Emerald
    };
    s2HeaderRow.getCell(14).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD97706' }, // Amber
    };
    s2HeaderRow.getCell(15).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEA580C' }, // Orange
    };
    s2HeaderRow.getCell(16).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE11D48' }, // Rose
    };

    sheet2.columns = [
      { key: 'stt', width: 8 },
      { key: 'taxCode', width: 18 },
      { key: 'partnerName', width: 35 },
      { key: 'invoiceDate', width: 15 },
      { key: 'serialNo', width: 14 },
      { key: 'invoiceNo', width: 16 },
      { key: 'description', width: 36 },
      { key: 'preVatAmount', width: 20 },
      { key: 'vatAmount', width: 18 },
      { key: 'totalAmount', width: 22 },
      { key: 'paidAmount', width: 20 },
      { key: 'balanceAmount', width: 20 },
      { key: 'aging0To30', width: 18 },
      { key: 'aging31To60', width: 18 },
      { key: 'aging61To90', width: 18 },
      { key: 'agingOver90', width: 18 },
      { key: 'agingDays', width: 14 },
      { key: 'status', width: 15 },
    ];

    detailedInvoices.forEach((inv: any, idx: number) => {
      const pName = isSupplier ? inv.sellerName : inv.buyerName;
      const tCode = isSupplier ? inv.sellerTaxCode : inv.buyerTaxCode;
      const bal = Number(inv.balanceAmount) || 0;
      const aging = Number(inv.agingDays) || 0;

      const a0_30 = bal > 0 && aging <= 30 ? bal : 0;
      const a31_60 = bal > 0 && aging > 30 && aging <= 60 ? bal : 0;
      const a61_90 = bal > 0 && aging > 60 && aging <= 90 ? bal : 0;
      const aOver90 = bal > 0 && aging > 90 ? bal : 0;

      const row = sheet2.addRow([
        idx + 1,
        tCode === 'KHONG_MST' ? '—' : tCode,
        pName || '—',
        inv.invoiceDate,
        inv.serialNo || '—',
        inv.invoiceNo || '—',
        inv.description || '—',
        Number(inv.preVatAmount) || 0,
        Number(inv.vatAmount) || 0,
        Number(inv.totalAmount) || 0,
        Number(inv.paidAmount) || 0,
        bal,
        a0_30,
        a31_60,
        a61_90,
        aOver90,
        bal > 0 ? aging : 0,
        inv.status || 'ACTIVE',
      ]);

      row.height = 20;
      row.font = { name: 'Calibri', size: 10 };

      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(7).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(8).numFmt = '#,##0.00';
      row.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(9).numFmt = '#,##0.00';
      row.getCell(10).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(10).numFmt = '#,##0.00';
      row.getCell(11).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(11).numFmt = '#,##0.00';
      row.getCell(12).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(12).numFmt = '#,##0.00';

      // Sheet 2 Aging Columns
      row.getCell(13).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(13).numFmt = '#,##0.00';
      row.getCell(13).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF0FDF4' },
      };
      row.getCell(13).font = {
        name: 'Calibri',
        size: 10,
        color: { argb: a0_30 > 0 ? 'FF065F46' : 'FF94A3B8' },
        bold: a0_30 > 0,
      };

      row.getCell(14).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(14).numFmt = '#,##0.00';
      row.getCell(14).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFFBEB' },
      };
      row.getCell(14).font = {
        name: 'Calibri',
        size: 10,
        color: { argb: a31_60 > 0 ? 'FF92400E' : 'FF94A3B8' },
        bold: a31_60 > 0,
      };

      row.getCell(15).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(15).numFmt = '#,##0.00';
      row.getCell(15).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFF7ED' },
      };
      row.getCell(15).font = {
        name: 'Calibri',
        size: 10,
        color: { argb: a61_90 > 0 ? 'FF9A3412' : 'FF94A3B8' },
        bold: a61_90 > 0,
      };

      row.getCell(16).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(16).numFmt = '#,##0.00';
      row.getCell(16).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFF1F2' },
      };
      row.getCell(16).font = {
        name: 'Calibri',
        size: 10,
        color: { argb: aOver90 > 0 ? 'FF9F1239' : 'FF94A3B8' },
        bold: aOver90 > 0,
      };

      row.getCell(17).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(17).numFmt = '#,##0';
      row.getCell(18).alignment = { horizontal: 'center', vertical: 'middle' };

      for (let c = 1; c <= 18; c++) {
        row.getCell(c).border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      }
    });

    sheet2.views = [{ state: 'frozen', ySplit: 1 }];
    sheet2.autoFilter = `A1:R${detailedInvoices.length + 1}`;

    options?.onProgress?.(100, 100, 'Đang xuất tệp Excel hoàn chỉnh...');
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }
}
