import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErpInvoice } from '../../entities/erp_invoice.entity';
import { InvoiceDashboardStatsService } from './invoice-dashboard-stats.service';
import { normalizeEffectiveDateTo } from './invoice-dashboard-helpers';

export interface DebtsAnalyticsSummary {
  totalReceivable: number;
  paidReceivable: number;
  remainingReceivable: number;
  totalPayable: number;
  paidPayable: number;
  remainingPayable: number;
  netBalance: number;
  collectionRate: number;
  paymentRate: number;
}

export interface AgingComparisonItem {
  bracket: '0_30' | '31_60' | '61_90' | 'over_90';
  label: string;
  receivableAmount: number;
  payableAmount: number;
  netAmount: number;
}

export interface TimeHorizonBucket {
  receivable: number;
  payable: number;
  net: number;
}

export interface TimeHorizonsOverview {
  nextWeekDue: TimeHorizonBucket;
  nextMonthDue: TimeHorizonBucket;
  overdue30To90: TimeHorizonBucket;
  criticalOverdue90Plus: TimeHorizonBucket;
}

export interface ForecastHorizonsOverview {
  next7Days: TimeHorizonBucket;
  next30Days: TimeHorizonBucket;
  expectedCashflow: TimeHorizonBucket;
  defaultRiskProvision: {
    receivableRisk: number;
    payableRisk: number;
    netRisk: number;
  };
}

export interface TopDebtPartnerItem {
  taxCode: string;
  partnerName: string;
  totalAmount: number;
  balanceAmount: number;
  overdueAmount: number;
  maxAgingDays: number;
}

export interface DebtsAnalyticsResponse {
  summary: DebtsAnalyticsSummary;
  agingComparison: AgingComparisonItem[];
  timeHorizons: TimeHorizonsOverview;
  forecastHorizons: ForecastHorizonsOverview;
  cashTrend: Array<{
    label: string;
    cashIn: number;
    cashOut: number;
    netCash: number;
    vatIn?: number;
    vatOut?: number;
  }>;
  topReceivableCustomers: TopDebtPartnerItem[];
  topPayableSuppliers: TopDebtPartnerItem[];
}

@Injectable()
export class InvoiceDashboardAnalyticsService {
  private readonly logger = new Logger(InvoiceDashboardAnalyticsService.name);

  constructor(
    @InjectRepository(ErpInvoice)
    private readonly invoiceRepo: Repository<ErpInvoice>,
    private readonly statsService: InvoiceDashboardStatsService,
  ) {}

  /**
   * Tổng quan phân tích công nợ, phân tầng tuổi nợ và các chân trời dự báo dòng tiền IFRS 9 ECL
   */
  async getDebtsAnalytics(
    dateFrom?: string,
    dateTo?: string,
    branchId?: string,
  ): Promise<DebtsAnalyticsResponse> {
    let dateFilter = '';
    const params: any[] = [];
    let pIdx = 1;

    if (dateFrom) {
      dateFilter += ` AND inv.invoice_date >= $${pIdx++}`;
      params.push(dateFrom);
    }
    if (dateTo) {
      const effTo = normalizeEffectiveDateTo(dateTo);
      dateFilter += ` AND inv.invoice_date <= $${pIdx++}`;
      params.push(effTo);
    }
    if (branchId) {
      if (branchId === 'null') {
        dateFilter += ` AND inv.branch_id IS NULL`;
      } else {
        dateFilter += ` AND inv.branch_id = $${pIdx++}`;
        params.push(branchId);
      }
    }

    // 1. Overall Aggregation by Direction and Aging
    const summaryQuery = `
      SELECT 
        inv.direction,
        SUM(CAST(inv.total_amount AS NUMERIC)) as "totalAmount",
        SUM(COALESCE(netoff.net_off_amount, 0)) as "paidAmount",
        SUM(GREATEST(0, CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0))) as "remainingAmount",
        SUM(
          CASE 
            WHEN (CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0)) > 0 
                 AND (CURRENT_DATE - inv.invoice_date::date) <= 30
            THEN GREATEST(0, CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0))
            ELSE 0 
          END
        ) as "aging0To30",
        SUM(
          CASE 
            WHEN (CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0)) > 0 
                 AND (CURRENT_DATE - inv.invoice_date::date) > 30 
                 AND (CURRENT_DATE - inv.invoice_date::date) <= 60
            THEN GREATEST(0, CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0))
            ELSE 0 
          END
        ) as "aging31To60",
        SUM(
          CASE 
            WHEN (CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0)) > 0 
                 AND (CURRENT_DATE - inv.invoice_date::date) > 60 
                 AND (CURRENT_DATE - inv.invoice_date::date) <= 90
            THEN GREATEST(0, CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0))
            ELSE 0 
          END
        ) as "aging61To90",
        SUM(
          CASE 
            WHEN (CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0)) > 0 
                 AND (CURRENT_DATE - inv.invoice_date::date) > 90
            THEN GREATEST(0, CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0))
            ELSE 0 
          END
        ) as "agingOver90",
        SUM(
          CASE 
            WHEN (CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0)) > 0 
                 AND (CURRENT_DATE - inv.invoice_date::date) <= 7
            THEN GREATEST(0, CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0))
            ELSE 0 
          END
        ) as "dueNextWeek"
      FROM erp_invoices inv
      LEFT JOIN (
        SELECT invoice_id, SUM(net_off_amount) as net_off_amount
        FROM erp_invoice_voucher_netoff
        GROUP BY invoice_id
      ) netoff ON netoff.invoice_id = inv.id
      WHERE inv.is_deleted = false AND (inv.tax_invoice_status IS NULL OR inv.tax_invoice_status != 4)
      ${dateFilter}
      GROUP BY inv.direction
    `;

    const summaryRows = await this.invoiceRepo.query(summaryQuery, params);

    let outTotal = 0,
      outPaid = 0,
      outBal = 0,
      outA0_30 = 0,
      outA31_60 = 0,
      outA61_90 = 0,
      outAOver90 = 0,
      outNextWeek = 0;
    let inTotal = 0,
      inPaid = 0,
      inBal = 0,
      inA0_30 = 0,
      inA31_60 = 0,
      inA61_90 = 0,
      inAOver90 = 0,
      inNextWeek = 0;

    for (const r of summaryRows) {
      if (r.direction === 'OUT') {
        outTotal = Number(r.totalAmount) || 0;
        outPaid = Number(r.paidAmount) || 0;
        outBal = Number(r.remainingAmount) || 0;
        outA0_30 = Number(r.aging0To30) || 0;
        outA31_60 = Number(r.aging31To60) || 0;
        outA61_90 = Number(r.aging61To90) || 0;
        outAOver90 = Number(r.agingOver90) || 0;
        outNextWeek = Number(r.dueNextWeek) || 0;
      } else if (r.direction === 'IN') {
        inTotal = Number(r.totalAmount) || 0;
        inPaid = Number(r.paidAmount) || 0;
        inBal = Number(r.remainingAmount) || 0;
        inA0_30 = Number(r.aging0To30) || 0;
        inA31_60 = Number(r.aging31To60) || 0;
        inA61_90 = Number(r.aging61To90) || 0;
        inAOver90 = Number(r.agingOver90) || 0;
        inNextWeek = Number(r.dueNextWeek) || 0;
      }
    }

    const netBalance = outBal - inBal;
    const collectionRate = outTotal > 0 ? (outPaid / outTotal) * 100 : 0;
    const paymentRate = inTotal > 0 ? (inPaid / inTotal) * 100 : 0;

    // 2. Monthly Trend
    const trendStats = await this.statsService.getDashboardStats(
      dateFrom,
      dateTo,
      branchId,
    );
    const cashTrend = trendStats.cashTrend.map((t) => ({
      label: t.label,
      cashIn: t.cashIn,
      cashOut: t.cashOut,
      netCash: t.cashIn - t.cashOut,
      vatIn: t.vatIn,
      vatOut: t.vatOut,
    }));

    // 3. Top 5 Receivable Customers
    const topCustomersQuery = `
      SELECT 
        COALESCE(NULLIF(TRIM(inv.buyer_tax_code), ''), NULLIF(TRIM(inv.buyer_cccd), ''), 'KHONG_MST') as "taxCode",
        COALESCE(NULLIF(TRIM(inv.buyer_name), ''), NULLIF(TRIM(inv.buyer_personal_name), ''), 'Khách hàng lẻ') as "partnerName",
        SUM(CAST(inv.total_amount AS NUMERIC)) as "totalAmount",
        SUM(GREATEST(0, CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0))) as "balanceAmount",
        SUM(
          CASE 
            WHEN (CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0)) > 0 
                 AND (CURRENT_DATE - inv.invoice_date::date) > 30
            THEN GREATEST(0, CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0))
            ELSE 0 
          END
        ) as "overdueAmount",
        MAX(
          CASE 
            WHEN (CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0)) > 0 
            THEN GREATEST(0, (CURRENT_DATE - inv.invoice_date::date))
            ELSE 0 
          END
        ) as "maxAgingDays"
      FROM erp_invoices inv
      LEFT JOIN (
        SELECT invoice_id, SUM(net_off_amount) as net_off_amount
        FROM erp_invoice_voucher_netoff
        GROUP BY invoice_id
      ) netoff ON netoff.invoice_id = inv.id
      WHERE inv.is_deleted = false AND (inv.tax_invoice_status IS NULL OR inv.tax_invoice_status != 4)
        AND inv.direction = 'OUT'
        ${dateFilter}
      GROUP BY 
        COALESCE(NULLIF(TRIM(inv.buyer_tax_code), ''), NULLIF(TRIM(inv.buyer_cccd), ''), 'KHONG_MST'),
        COALESCE(NULLIF(TRIM(inv.buyer_name), ''), NULLIF(TRIM(inv.buyer_personal_name), ''), 'Khách hàng lẻ')
      HAVING SUM(GREATEST(0, CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0))) > 0
      ORDER BY "balanceAmount" DESC
      LIMIT 5
    `;

    const rawTopCustomers = await this.invoiceRepo.query(
      topCustomersQuery,
      params,
    );
    const topReceivableCustomers: TopDebtPartnerItem[] = rawTopCustomers.map(
      (r: any) => ({
        taxCode: r.taxCode,
        partnerName: r.partnerName,
        totalAmount: Number(r.totalAmount) || 0,
        balanceAmount: Number(r.balanceAmount) || 0,
        overdueAmount: Number(r.overdueAmount) || 0,
        maxAgingDays: Number(r.maxAgingDays) || 0,
      }),
    );

    // 4. Top 5 Payable Suppliers
    const topSuppliersQuery = `
      SELECT 
        COALESCE(NULLIF(TRIM(inv.seller_tax_code), ''), 'KHONG_MST') as "taxCode",
        COALESCE(NULLIF(TRIM(inv.seller_name), ''), 'Nhà cung cấp') as "partnerName",
        SUM(CAST(inv.total_amount AS NUMERIC)) as "totalAmount",
        SUM(GREATEST(0, CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0))) as "balanceAmount",
        SUM(
          CASE 
            WHEN (CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0)) > 0 
                 AND (CURRENT_DATE - inv.invoice_date::date) > 30
            THEN GREATEST(0, CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0))
            ELSE 0 
          END
        ) as "overdueAmount",
        MAX(
          CASE 
            WHEN (CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0)) > 0 
            THEN GREATEST(0, (CURRENT_DATE - inv.invoice_date::date))
            ELSE 0 
          END
        ) as "maxAgingDays"
      FROM erp_invoices inv
      LEFT JOIN (
        SELECT invoice_id, SUM(net_off_amount) as net_off_amount
        FROM erp_invoice_voucher_netoff
        GROUP BY invoice_id
      ) netoff ON netoff.invoice_id = inv.id
      WHERE inv.is_deleted = false AND (inv.tax_invoice_status IS NULL OR inv.tax_invoice_status != 4)
        AND inv.direction = 'IN'
        ${dateFilter}
      GROUP BY 
        COALESCE(NULLIF(TRIM(inv.seller_tax_code), ''), 'KHONG_MST'),
        COALESCE(NULLIF(TRIM(inv.seller_name), ''), 'Nhà cung cấp')
      HAVING SUM(GREATEST(0, CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0))) > 0
      ORDER BY "balanceAmount" DESC
      LIMIT 5
    `;

    const rawTopSuppliers = await this.invoiceRepo.query(
      topSuppliersQuery,
      params,
    );
    const topPayableSuppliers: TopDebtPartnerItem[] = rawTopSuppliers.map(
      (r: any) => ({
        taxCode: r.taxCode,
        partnerName: r.partnerName,
        totalAmount: Number(r.totalAmount) || 0,
        balanceAmount: Number(r.balanceAmount) || 0,
        overdueAmount: Number(r.overdueAmount) || 0,
        maxAgingDays: Number(r.maxAgingDays) || 0,
      }),
    );

    // 5. Compute Forecast Horizons (Cashflow Forecasting Algorithms)
    // 5.1 Partner Lag Forecast (DSO/DPO Lag Engine)
    const forecastLagQuery = `
      SELECT 
        inv.direction,
        SUM(
          CASE 
            WHEN (CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0)) > 0 
                 AND (inv.invoice_date::date + (COALESCE(pl.avg_lag_days, 30) || ' days')::interval)::date <= (CURRENT_DATE + INTERVAL '7 days')::date
            THEN GREATEST(0, CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0))
            ELSE 0 
          END
        ) as "forecastNext7Days",
        SUM(
          CASE 
            WHEN (CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0)) > 0 
                 AND (inv.invoice_date::date + (COALESCE(pl.avg_lag_days, 30) || ' days')::interval)::date <= (CURRENT_DATE + INTERVAL '30 days')::date
            THEN GREATEST(0, CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0))
            ELSE 0 
          END
        ) as "forecastNext30Days"
      FROM erp_invoices inv
      LEFT JOIN (
        SELECT invoice_id, SUM(net_off_amount) as net_off_amount
        FROM erp_invoice_voucher_netoff
        GROUP BY invoice_id
      ) netoff ON netoff.invoice_id = inv.id
      LEFT JOIN (
        SELECT 
          COALESCE(NULLIF(TRIM(i2.buyer_tax_code), ''), NULLIF(TRIM(i2.buyer_cccd), ''), NULLIF(TRIM(i2.seller_tax_code), ''), 'KHONG_MST') as tax_code,
          i2.direction,
          ROUND(AVG(GREATEST(1, bt2.trans_date::date - i2.invoice_date::date))) as avg_lag_days
        FROM erp_invoice_voucher_netoff no2
        JOIN erp_invoices i2 ON i2.id = no2.invoice_id
        JOIN erp_bank_transactions bt2 ON bt2.id = no2.bank_transaction_id
        WHERE i2.is_deleted = false
        GROUP BY 1, 2
      ) pl ON pl.tax_code = (
        CASE 
          WHEN inv.direction = 'OUT' THEN COALESCE(NULLIF(TRIM(inv.buyer_tax_code), ''), NULLIF(TRIM(inv.buyer_cccd), ''), 'KHONG_MST')
          ELSE COALESCE(NULLIF(TRIM(inv.seller_tax_code), ''), 'KHONG_MST')
        END
      ) AND pl.direction = inv.direction
      WHERE inv.is_deleted = false AND (inv.tax_invoice_status IS NULL OR inv.tax_invoice_status != 4)
      ${dateFilter}
      GROUP BY inv.direction
    `;

    const forecastLagRows = await this.invoiceRepo.query(
      forecastLagQuery,
      params,
    );
    let outF7 = 0,
      outF30 = 0,
      inF7 = 0,
      inF30 = 0;
    for (const r of forecastLagRows) {
      if (r.direction === 'OUT') {
        outF7 = Number(r.forecastNext7Days) || 0;
        outF30 = Number(r.forecastNext30Days) || 0;
      } else if (r.direction === 'IN') {
        inF7 = Number(r.forecastNext7Days) || 0;
        inF30 = Number(r.forecastNext30Days) || 0;
      }
    }

    // 5.2 IFRS 9 Expected Cashflow & Default Risk Provision
    const expRec = Math.round(
      outA0_30 * 0.85 + outA31_60 * 0.6 + outA61_90 * 0.3 + outAOver90 * 0.1,
    );
    const expPay = Math.round(
      inA0_30 * 0.95 + inA31_60 * 0.85 + inA61_90 * 0.7 + inAOver90 * 0.5,
    );
    const riskRec = Math.round(
      outA0_30 * 0.15 + outA31_60 * 0.4 + outA61_90 * 0.7 + outAOver90 * 0.9,
    );
    const riskPay = Math.round(
      inA0_30 * 0.05 + inA31_60 * 0.15 + inA61_90 * 0.3 + inAOver90 * 0.5,
    );

    const forecastHorizons: ForecastHorizonsOverview = {
      next7Days: {
        receivable: outF7,
        payable: inF7,
        net: outF7 - inF7,
      },
      next30Days: {
        receivable: outF30,
        payable: inF30,
        net: outF30 - inF30,
      },
      expectedCashflow: {
        receivable: expRec,
        payable: expPay,
        net: expRec - expPay,
      },
      defaultRiskProvision: {
        receivableRisk: riskRec,
        payableRisk: riskPay,
        netRisk: riskRec - riskPay,
      },
    };

    return {
      summary: {
        totalReceivable: outTotal,
        paidReceivable: outPaid,
        remainingReceivable: outBal,
        totalPayable: inTotal,
        paidPayable: inPaid,
        remainingPayable: inBal,
        netBalance,
        collectionRate,
        paymentRate,
      },
      agingComparison: [
        {
          bracket: '0_30' as const,
          label: '0-30 ngày',
          receivableAmount: outA0_30,
          payableAmount: inA0_30,
          netAmount: outA0_30 - inA0_30,
        },
        {
          bracket: '31_60' as const,
          label: '31-60 ngày',
          receivableAmount: outA31_60,
          payableAmount: inA31_60,
          netAmount: outA31_60 - inA31_60,
        },
        {
          bracket: '61_90' as const,
          label: '61-90 ngày',
          receivableAmount: outA61_90,
          payableAmount: inA61_90,
          netAmount: outA61_90 - inA61_90,
        },
        {
          bracket: 'over_90' as const,
          label: '>90 ngày',
          receivableAmount: outAOver90,
          payableAmount: inAOver90,
          netAmount: outAOver90 - inAOver90,
        },
      ],
      timeHorizons: {
        nextWeekDue: {
          receivable: outNextWeek,
          payable: inNextWeek,
          net: outNextWeek - inNextWeek,
        },
        nextMonthDue: {
          receivable: outA0_30,
          payable: inA0_30,
          net: outA0_30 - inA0_30,
        },
        overdue30To90: {
          receivable: outA31_60 + outA61_90,
          payable: inA31_60 + inA61_90,
          net: outA31_60 + outA61_90 - (inA31_60 + inA61_90),
        },
        criticalOverdue90Plus: {
          receivable: outAOver90,
          payable: inAOver90,
          net: outAOver90 - inAOver90,
        },
      },
      forecastHorizons,
      cashTrend,
      topReceivableCustomers,
      topPayableSuppliers,
    };
  }
}
