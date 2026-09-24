import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErpInvoice } from '../../entities/erp_invoice.entity';
import { normalizeEffectiveDateTo } from './invoice-dashboard-helpers';

export interface MonthlyCashTrendItem {
  label: string;
  cashIn: number;
  cashOut: number;
  vatIn?: number;
  vatOut?: number;
}

export interface DashboardStatsResponse {
  cashTrend: MonthlyCashTrendItem[];
}

@Injectable()
export class InvoiceDashboardStatsService {
  private readonly logger = new Logger(InvoiceDashboardStatsService.name);

  constructor(
    @InjectRepository(ErpInvoice)
    private readonly invoiceRepo: Repository<ErpInvoice>,
  ) {}

  /**
   * Thống kê biểu đồ xu hướng dòng tiền & VAT theo tháng
   */
  async getDashboardStats(
    dateFrom?: string,
    dateTo?: string,
    branchId?: string,
  ): Promise<DashboardStatsResponse> {
    const qb = this.invoiceRepo
      .createQueryBuilder('inv')
      .select("TO_CHAR(inv.invoice_date, 'YYYY-MM')", 'month')
      .addSelect(
        "SUM(CASE WHEN inv.direction = 'IN' THEN CAST(inv.total_amount AS NUMERIC) ELSE 0 END)",
        'cashOut',
      )
      .addSelect(
        "SUM(CASE WHEN inv.direction = 'OUT' THEN CAST(inv.total_amount AS NUMERIC) ELSE 0 END)",
        'cashIn',
      )
      .addSelect(
        "SUM(CASE WHEN inv.direction = 'IN' THEN CAST(inv.vat_amount AS NUMERIC) ELSE 0 END)",
        'vatIn',
      )
      .addSelect(
        "SUM(CASE WHEN inv.direction = 'OUT' THEN CAST(inv.vat_amount AS NUMERIC) ELSE 0 END)",
        'vatOut',
      )
      .where('inv.is_deleted = false')
      .andWhere(
        '(inv.tax_invoice_status IS NULL OR inv.tax_invoice_status != 4)',
      );

    if (dateFrom) {
      qb.andWhere('inv.invoice_date >= :dateFrom', { dateFrom });
    }
    if (dateTo) {
      const effectiveDateTo = normalizeEffectiveDateTo(dateTo);
      qb.andWhere('inv.invoice_date <= :dateTo', { dateTo: effectiveDateTo });
    }
    if (branchId) {
      if (branchId === 'null') {
        qb.andWhere('inv.branch_id IS NULL');
      } else {
        qb.andWhere('inv.branch_id = :branchId', { branchId });
      }
    }

    qb.groupBy("TO_CHAR(inv.invoice_date, 'YYYY-MM')");
    qb.orderBy('month', 'ASC');

    const result = await qb.getRawMany();

    // Format to cashTrend structure
    const cashTrend = result.map((r) => ({
      label: r.month,
      cashIn: Number(r.cashIn) || 0,
      cashOut: Number(r.cashOut) || 0,
      vatIn: Number(r.vatIn) || 0,
      vatOut: Number(r.vatOut) || 0,
    }));

    return { cashTrend };
  }

  /**
   * Thống kê xu hướng thu / chi theo tháng của riêng một mã số thuế đối tác cụ thể
   */
  async getPartnerStats(
    taxCode: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<DashboardStatsResponse> {
    const qb = this.invoiceRepo
      .createQueryBuilder('inv')
      .select("TO_CHAR(inv.invoice_date, 'YYYY-MM')", 'month')
      .addSelect(
        "SUM(CASE WHEN inv.direction = 'IN' THEN CAST(inv.total_amount AS NUMERIC) ELSE 0 END)",
        'cashOut', // Input invoices mean we pay money (cashOut)
      )
      .addSelect(
        "SUM(CASE WHEN inv.direction = 'OUT' THEN CAST(inv.total_amount AS NUMERIC) ELSE 0 END)",
        'cashIn', // Output invoices mean we receive money (cashIn)
      )
      .where('inv.is_deleted = false')
      .andWhere(
        '(inv.tax_invoice_status IS NULL OR inv.tax_invoice_status != 4)',
      )
      .andWhere(
        '(inv.seller_tax_code = :taxCode OR inv.buyer_tax_code = :taxCode)',
        { taxCode },
      );

    if (dateFrom) {
      qb.andWhere('inv.invoice_date >= :dateFrom', { dateFrom });
    }
    if (dateTo) {
      const effectiveDateTo = normalizeEffectiveDateTo(dateTo);
      qb.andWhere('inv.invoice_date <= :dateTo', { dateTo: effectiveDateTo });
    }

    qb.groupBy("TO_CHAR(inv.invoice_date, 'YYYY-MM')");
    qb.orderBy('month', 'ASC');

    const result = await qb.getRawMany();

    const cashTrend = result.map((r) => ({
      label: r.month,
      cashIn: Number(r.cashIn) || 0,
      cashOut: Number(r.cashOut) || 0,
    }));

    return { cashTrend };
  }
}
