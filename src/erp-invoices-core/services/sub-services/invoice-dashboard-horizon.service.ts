import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErpInvoice } from '../../entities/erp_invoice.entity';
import { buildKeywordSqlClause } from './invoice-dashboard-helpers';

export interface GetTimeHorizonInvoicesQuery {
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
  direction?: 'ALL' | 'IN' | 'OUT';
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  columnSearch?: string;
  columnFilters?: string;
}

export interface TimeHorizonInvoiceItem {
  id: string;
  invoiceNo: string;
  serialNo: string;
  invoiceDate: string;
  direction: 'IN' | 'OUT';
  sellerName: string;
  sellerTaxCode: string;
  sellerAddress?: string;
  buyerName: string;
  buyerTaxCode: string;
  buyerAddress?: string;
  partnerName: string;
  taxCode: string;
  preVatAmount: number;
  vatAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  agingDays: number;
  partnerAvgLagDays: number;
  estimatedSettlementDate: string | null;
  recoveryProbability: number;
  riskProbability: number;
  expectedAmount: number;
  riskAmount: number;
  status: string;
  taxInvoiceStatus?: number;
  description?: string;
}

export interface TimeHorizonInvoicesResponse {
  summary: {
    horizon: string;
    horizonLabel: string;
    receivableAmount: number;
    payableAmount: number;
    receivableTotalAmount: number;
    payableTotalAmount: number;
    receivedAmount: number;
    paidAmount: number;
    receivableExpectedAmount: number;
    payableExpectedAmount: number;
    receivableRiskAmount: number;
    payableRiskAmount: number;
    netAmount: number;
    receivableCount: number;
    payableCount: number;
    topReceivablePartners: any[];
    topPayablePartners: any[];
    monthlyTrend: any[];
    agingBreakdown: any;
    maturityBreakdown: any;
    dailyForecastTimeline: any[];
    ticketSizeBuckets: any;
    branchBreakdown: any[];
  };
  items: TimeHorizonInvoiceItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

@Injectable()
export class InvoiceDashboardHorizonService {
  private readonly logger = new Logger(InvoiceDashboardHorizonService.name);

  constructor(
    @InjectRepository(ErpInvoice)
    private readonly invoiceRepo: Repository<ErpInvoice>,
  ) {}

  /**
   * Lấy danh sách chi tiết hóa đơn theo từng Mốc thời gian (Time Horizon & Forecast Horizon)
   */
  async getTimeHorizonInvoices(
    horizon: string,
    query: GetTimeHorizonInvoicesQuery,
  ): Promise<TimeHorizonInvoicesResponse> {
    const {
      dateFrom,
      dateTo,
      branchId,
      direction = 'ALL',
      search,
      page = 1,
      pageSize = 20,
      sortBy,
      sortOrder = 'DESC',
      columnSearch,
      columnFilters,
    } = query;

    // Horizon condition
    let horizonSql = '';
    let horizonLabel = '';
    switch (horizon) {
      case 'nextWeekDue':
        horizonSql = `(CURRENT_DATE - inv.invoice_date::date) <= 7`;
        horizonLabel = 'Mới phát sinh (≤ 7 ngày)';
        break;
      case 'nextMonthDue':
        horizonSql = `(CURRENT_DATE - inv.invoice_date::date) <= 30`;
        horizonLabel = 'Trong hạn chuẩn (≤ 30 ngày)';
        break;
      case 'overdue30To90':
        horizonSql = `(CURRENT_DATE - inv.invoice_date::date) > 30 AND (CURRENT_DATE - inv.invoice_date::date) <= 90`;
        horizonLabel = 'Quá hạn 31-90 ngày';
        break;
      case 'criticalOverdue90Plus':
        horizonSql = `(CURRENT_DATE - inv.invoice_date::date) > 90`;
        horizonLabel = 'Quá hạn >90 ngày';
        break;
      case 'forecastNext7Days':
      case 'forecastNextWeek':
        horizonSql = `(inv.invoice_date::date + (COALESCE(pl.avg_lag_days, 30) || ' days')::interval)::date <= (CURRENT_DATE + INTERVAL '7 days')::date`;
        horizonLabel = 'Dự báo 7 ngày tới (T+7)';
        break;
      case 'forecastNext30Days':
      case 'forecastNextMonth':
        horizonSql = `(inv.invoice_date::date + (COALESCE(pl.avg_lag_days, 30) || ' days')::interval)::date <= (CURRENT_DATE + INTERVAL '30 days')::date`;
        horizonLabel = 'Kế hoạch 30 ngày tới (T+30)';
        break;
      case 'expectedCashflow':
        horizonSql = `1=1`;
        horizonLabel = 'Dòng tiền kỳ vọng (IFRS 9)';
        break;
      case 'defaultRiskProvision':
        horizonSql = `1=1`;
        horizonLabel = 'Dự phòng rủi ro nợ (IFRS 9)';
        break;
      default:
        horizonSql = `1=1`;
        horizonLabel = 'Mốc thời gian';
    }

    // Base query for invoices within this horizon with remaining balance > 0
    let baseQuery = `
      SELECT 
        inv.id,
        inv.invoice_no as "invoiceNo",
        inv.serial_no as "serialNo",
        TO_CHAR(inv.invoice_date, 'YYYY-MM-DD') as "invoiceDate",
        inv.direction,
        inv.seller_name as "sellerName",
        inv.seller_tax_code as "sellerTaxCode",
        inv.seller_address as "sellerAddress",
        inv.buyer_name as "buyerName",
        inv.buyer_tax_code as "buyerTaxCode",
        inv.buyer_personal_name as "buyerPersonalName",
        inv.buyer_cccd as "buyerCccd",
        inv.buyer_address as "buyerAddress",
        CASE 
          WHEN inv.direction = 'OUT' THEN COALESCE(NULLIF(TRIM(inv.buyer_name), ''), NULLIF(TRIM(inv.buyer_personal_name), ''), 'Khách hàng lẻ')
          ELSE COALESCE(NULLIF(TRIM(inv.seller_name), ''), 'Nhà cung cấp')
        END as "partnerName",
        CASE 
          WHEN inv.direction = 'OUT' THEN COALESCE(NULLIF(TRIM(inv.buyer_tax_code), ''), NULLIF(TRIM(inv.buyer_cccd), ''), 'KHONG_MST')
          ELSE COALESCE(NULLIF(TRIM(inv.seller_tax_code), ''), 'KHONG_MST')
        END as "taxCode",
        CAST(inv.pre_vat_amount AS NUMERIC) as "preVatAmount",
        CAST(inv.vat_amount AS NUMERIC) as "vatAmount",
        CAST(inv.total_amount AS NUMERIC) as "totalAmount",
        COALESCE(netoff.net_off_amount, 0) as "paidAmount",
        GREATEST(0, CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0)) as "balanceAmount",
        GREATEST(0, (CURRENT_DATE - inv.invoice_date::date)) as "agingDays",
        COALESCE(pl.avg_lag_days, 30) as "partnerAvgLagDays",
        TO_CHAR(inv.invoice_date + (COALESCE(pl.avg_lag_days, 30) || ' days')::interval, 'YYYY-MM-DD') as "estimatedSettlementDate",
        CASE 
          WHEN inv.direction = 'OUT' THEN
            CASE 
              WHEN (CURRENT_DATE - inv.invoice_date::date) <= 30 THEN 85
              WHEN (CURRENT_DATE - inv.invoice_date::date) <= 60 THEN 60
              WHEN (CURRENT_DATE - inv.invoice_date::date) <= 90 THEN 30
              ELSE 10
            END
          ELSE
            CASE 
              WHEN (CURRENT_DATE - inv.invoice_date::date) <= 30 THEN 95
              WHEN (CURRENT_DATE - inv.invoice_date::date) <= 60 THEN 85
              WHEN (CURRENT_DATE - inv.invoice_date::date) <= 90 THEN 70
              ELSE 50
            END
        END as "recoveryProbability",
        CASE 
          WHEN inv.direction = 'OUT' THEN
            CASE 
              WHEN (CURRENT_DATE - inv.invoice_date::date) <= 30 THEN 15
              WHEN (CURRENT_DATE - inv.invoice_date::date) <= 60 THEN 40
              WHEN (CURRENT_DATE - inv.invoice_date::date) <= 90 THEN 70
              ELSE 90
            END
          ELSE
            CASE 
              WHEN (CURRENT_DATE - inv.invoice_date::date) <= 30 THEN 5
              WHEN (CURRENT_DATE - inv.invoice_date::date) <= 60 THEN 15
              WHEN (CURRENT_DATE - inv.invoice_date::date) <= 90 THEN 30
              ELSE 50
            END
        END as "riskProbability",
        ROUND(
          GREATEST(0, CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0)) * (
            CASE 
              WHEN inv.direction = 'OUT' THEN
                CASE 
                  WHEN (CURRENT_DATE - inv.invoice_date::date) <= 30 THEN 85
                  WHEN (CURRENT_DATE - inv.invoice_date::date) <= 60 THEN 60
                  WHEN (CURRENT_DATE - inv.invoice_date::date) <= 90 THEN 30
                  ELSE 10
                END
              ELSE
                CASE 
                  WHEN (CURRENT_DATE - inv.invoice_date::date) <= 30 THEN 95
                  WHEN (CURRENT_DATE - inv.invoice_date::date) <= 60 THEN 85
                  WHEN (CURRENT_DATE - inv.invoice_date::date) <= 90 THEN 70
                  ELSE 50
                END
            END
          ) / 100.0
        ) as "expectedAmount",
        ROUND(
          GREATEST(0, CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0)) * (
            CASE 
              WHEN inv.direction = 'OUT' THEN
                CASE 
                  WHEN (CURRENT_DATE - inv.invoice_date::date) <= 30 THEN 15
                  WHEN (CURRENT_DATE - inv.invoice_date::date) <= 60 THEN 40
                  WHEN (CURRENT_DATE - inv.invoice_date::date) <= 90 THEN 70
                  ELSE 90
                END
              ELSE
                CASE 
                  WHEN (CURRENT_DATE - inv.invoice_date::date) <= 30 THEN 5
                  WHEN (CURRENT_DATE - inv.invoice_date::date) <= 60 THEN 15
                  WHEN (CURRENT_DATE - inv.invoice_date::date) <= 90 THEN 30
                  ELSE 50
                END
            END
          ) / 100.0
        ) as "riskAmount",
        inv.status,
        inv.tax_invoice_status as "taxInvoiceStatus",
        inv.description,
        inv.branch_id as "branchId"
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
      WHERE inv.is_deleted = false 
        AND (inv.tax_invoice_status IS NULL OR inv.tax_invoice_status != 4)
        AND (CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0)) > 0
        AND ${horizonSql}
    `;

    if (dateFrom) {
      baseQuery += ` AND inv.invoice_date >= '${dateFrom.replace(/'/g, "''")}'`;
    }
    if (dateTo) {
      const effTo = dateTo.length === 10 ? dateTo + ' 23:59:59.999' : dateTo;
      baseQuery += ` AND inv.invoice_date <= '${effTo.replace(/'/g, "''")}'`;
    }
    if (branchId) {
      if (branchId === 'null') {
        baseQuery += ` AND inv.branch_id IS NULL`;
      } else {
        baseQuery += ` AND inv.branch_id = '${branchId.replace(/'/g, "''")}'`;
      }
    }

    // 1. Calculate Summary across ALL directions for this horizon
    let metricField = `"balanceAmount"`;
    if (horizon === 'expectedCashflow') {
      metricField = `"expectedAmount"`;
    } else if (horizon === 'defaultRiskProvision') {
      metricField = `"riskAmount"`;
    }

    const summarySql = `
      SELECT 
        SUM(CASE WHEN q.direction = 'OUT' THEN q.${metricField} ELSE 0 END) as "receivableAmount",
        SUM(CASE WHEN q.direction = 'IN' THEN q.${metricField} ELSE 0 END) as "payableAmount",
        SUM(CASE WHEN q.direction = 'OUT' THEN q."totalAmount" ELSE 0 END) as "receivableTotalAmount",
        SUM(CASE WHEN q.direction = 'IN' THEN q."totalAmount" ELSE 0 END) as "payableTotalAmount",
        SUM(CASE WHEN q.direction = 'OUT' THEN q."paidAmount" ELSE 0 END) as "receivedAmount",
        SUM(CASE WHEN q.direction = 'IN' THEN q."paidAmount" ELSE 0 END) as "paidAmount",
        SUM(CASE WHEN q.direction = 'OUT' THEN q."expectedAmount" ELSE 0 END) as "receivableExpectedAmount",
        SUM(CASE WHEN q.direction = 'IN' THEN q."expectedAmount" ELSE 0 END) as "payableExpectedAmount",
        SUM(CASE WHEN q.direction = 'OUT' THEN q."riskAmount" ELSE 0 END) as "receivableRiskAmount",
        SUM(CASE WHEN q.direction = 'IN' THEN q."riskAmount" ELSE 0 END) as "payableRiskAmount",
        COUNT(CASE WHEN q.direction = 'OUT' THEN 1 ELSE NULL END) as "receivableCount",
        COUNT(CASE WHEN q.direction = 'IN' THEN 1 ELSE NULL END) as "payableCount",
        -- Maturity Breakdown for Forecast Horizons (Due in Period vs Overdue Carried Over)
        SUM(CASE WHEN q.direction = 'OUT' AND q."estimatedSettlementDate" IS NOT NULL AND q."estimatedSettlementDate"::date >= CURRENT_DATE THEN q.${metricField} ELSE 0 END) as "outDueInPeriodAmount",
        COUNT(CASE WHEN q.direction = 'OUT' AND q."estimatedSettlementDate" IS NOT NULL AND q."estimatedSettlementDate"::date >= CURRENT_DATE THEN 1 ELSE NULL END) as "outDueInPeriodCount",
        SUM(CASE WHEN q.direction = 'OUT' AND q."estimatedSettlementDate" IS NOT NULL AND q."estimatedSettlementDate"::date < CURRENT_DATE THEN q.${metricField} ELSE 0 END) as "outOverdueCarriedAmount",
        COUNT(CASE WHEN q.direction = 'OUT' AND q."estimatedSettlementDate" IS NOT NULL AND q."estimatedSettlementDate"::date < CURRENT_DATE THEN 1 ELSE NULL END) as "outOverdueCarriedCount",
        SUM(CASE WHEN q.direction = 'IN' AND q."estimatedSettlementDate" IS NOT NULL AND q."estimatedSettlementDate"::date >= CURRENT_DATE THEN q.${metricField} ELSE 0 END) as "inDueInPeriodAmount",
        COUNT(CASE WHEN q.direction = 'IN' AND q."estimatedSettlementDate" IS NOT NULL AND q."estimatedSettlementDate"::date >= CURRENT_DATE THEN 1 ELSE NULL END) as "inDueInPeriodCount",
        SUM(CASE WHEN q.direction = 'IN' AND q."estimatedSettlementDate" IS NOT NULL AND q."estimatedSettlementDate"::date < CURRENT_DATE THEN q.${metricField} ELSE 0 END) as "inOverdueCarriedAmount",
        COUNT(CASE WHEN q.direction = 'IN' AND q."estimatedSettlementDate" IS NOT NULL AND q."estimatedSettlementDate"::date < CURRENT_DATE THEN 1 ELSE NULL END) as "inOverdueCarriedCount"
      FROM (${baseQuery}) q
    `;
    const summaryRows = await this.invoiceRepo.query(summarySql);
    const sRow = summaryRows[0] || {};
    const receivableAmount = Number(sRow.receivableAmount) || 0;
    const payableAmount = Number(sRow.payableAmount) || 0;
    const receivableTotalAmount = Number(sRow.receivableTotalAmount) || 0;
    const payableTotalAmount = Number(sRow.payableTotalAmount) || 0;
    const receivedAmount = Number(sRow.receivedAmount) || 0;
    const paidAmount = Number(sRow.paidAmount) || 0;
    const receivableExpectedAmount = Number(sRow.receivableExpectedAmount) || 0;
    const payableExpectedAmount = Number(sRow.payableExpectedAmount) || 0;
    const receivableRiskAmount = Number(sRow.receivableRiskAmount) || 0;
    const payableRiskAmount = Number(sRow.payableRiskAmount) || 0;
    const receivableCount = parseInt(sRow.receivableCount || '0', 10);
    const payableCount = parseInt(sRow.payableCount || '0', 10);
    const netAmount = receivableAmount - payableAmount;

    // Maturity breakdown details
    const maturityBreakdown = {
      outDueInPeriodAmount: Number(sRow.outDueInPeriodAmount) || 0,
      outDueInPeriodCount: parseInt(sRow.outDueInPeriodCount || '0', 10),
      outOverdueCarriedAmount: Number(sRow.outOverdueCarriedAmount) || 0,
      outOverdueCarriedCount: parseInt(sRow.outOverdueCarriedCount || '0', 10),
      inDueInPeriodAmount: Number(sRow.inDueInPeriodAmount) || 0,
      inDueInPeriodCount: parseInt(sRow.inDueInPeriodCount || '0', 10),
      inOverdueCarriedAmount: Number(sRow.inOverdueCarriedAmount) || 0,
      inOverdueCarriedCount: parseInt(sRow.inOverdueCarriedCount || '0', 10),
    };

    // Top 5 Receivable Customers in this horizon sorted by the specific horizon metric
    const topReceivableSql = `
      SELECT 
        q."taxCode",
        q."partnerName",
        SUM(q."balanceAmount") as "balanceAmount",
        SUM(q.${metricField}) as "contributingAmount",
        COUNT(q.id) as "invoiceCount",
        ROUND(AVG(q."partnerAvgLagDays")) as "avgLagDays",
        SUM(CASE WHEN q."estimatedSettlementDate" IS NOT NULL AND q."estimatedSettlementDate"::date < CURRENT_DATE THEN q.${metricField} ELSE 0 END) as "overdueCarriedAmount",
        COUNT(CASE WHEN q."estimatedSettlementDate" IS NOT NULL AND q."estimatedSettlementDate"::date < CURRENT_DATE THEN 1 ELSE NULL END) as "overdueInvoicesCount"
      FROM (${baseQuery}) q
      WHERE q.direction = 'OUT'
      GROUP BY q."taxCode", q."partnerName"
      ORDER BY "contributingAmount" DESC, "balanceAmount" DESC
      LIMIT 5
    `;
    const rawTopRec = await this.invoiceRepo.query(topReceivableSql);
    const topReceivablePartners = rawTopRec.map((r: any) => {
      const contributingAmount = Number(r.contributingAmount) || 0;
      const sharePercentage =
        receivableAmount > 0
          ? Number(((contributingAmount / receivableAmount) * 100).toFixed(1))
          : 0;
      const overdueCarriedAmount = Number(r.overdueCarriedAmount) || 0;
      return {
        taxCode: r.taxCode,
        partnerName: r.partnerName,
        balanceAmount: Number(r.balanceAmount) || 0,
        contributingAmount,
        sharePercentage,
        invoiceCount: parseInt(r.invoiceCount || '0', 10),
        avgLagDays: Math.round(Number(r.avgLagDays) || 30),
        overdueCarriedAmount,
        overdueInvoicesCount: parseInt(r.overdueInvoicesCount || '0', 10),
        isOverdueLag: overdueCarriedAmount > 0,
      };
    });

    // Top 5 Payable Suppliers in this horizon sorted by the specific horizon metric
    const topPayableSql = `
      SELECT 
        q."taxCode",
        q."partnerName",
        SUM(q."balanceAmount") as "balanceAmount",
        SUM(q.${metricField}) as "contributingAmount",
        COUNT(q.id) as "invoiceCount",
        ROUND(AVG(q."partnerAvgLagDays")) as "avgLagDays",
        SUM(CASE WHEN q."estimatedSettlementDate" IS NOT NULL AND q."estimatedSettlementDate"::date < CURRENT_DATE THEN q.${metricField} ELSE 0 END) as "overdueCarriedAmount",
        COUNT(CASE WHEN q."estimatedSettlementDate" IS NOT NULL AND q."estimatedSettlementDate"::date < CURRENT_DATE THEN 1 ELSE NULL END) as "overdueInvoicesCount"
      FROM (${baseQuery}) q
      WHERE q.direction = 'IN'
      GROUP BY q."taxCode", q."partnerName"
      ORDER BY "contributingAmount" DESC, "balanceAmount" DESC
      LIMIT 5
    `;
    const rawTopPay = await this.invoiceRepo.query(topPayableSql);
    const topPayablePartners = rawTopPay.map((r: any) => {
      const contributingAmount = Number(r.contributingAmount) || 0;
      const sharePercentage =
        payableAmount > 0
          ? Number(((contributingAmount / payableAmount) * 100).toFixed(1))
          : 0;
      const overdueCarriedAmount = Number(r.overdueCarriedAmount) || 0;
      return {
        taxCode: r.taxCode,
        partnerName: r.partnerName,
        balanceAmount: Number(r.balanceAmount) || 0,
        contributingAmount,
        sharePercentage,
        invoiceCount: parseInt(r.invoiceCount || '0', 10),
        avgLagDays: Math.round(Number(r.avgLagDays) || 30),
        overdueCarriedAmount,
        overdueInvoicesCount: parseInt(r.overdueInvoicesCount || '0', 10),
        isOverdueLag: overdueCarriedAmount > 0,
      };
    });

    // Monthly Trend aggregated across invoices in this horizon
    const monthlyTrendSql = `
      SELECT 
        SUBSTRING(q."invoiceDate", 1, 7) as "month",
        SUM(CASE WHEN q.direction = 'OUT' THEN q."totalAmount" ELSE 0 END) as "outTotal",
        SUM(CASE WHEN q.direction = 'OUT' THEN q."paidAmount" ELSE 0 END) as "outPaid",
        SUM(CASE WHEN q.direction = 'OUT' THEN q."balanceAmount" ELSE 0 END) as "outBalance",
        SUM(CASE WHEN q.direction = 'IN' THEN q."totalAmount" ELSE 0 END) as "inTotal",
        SUM(CASE WHEN q.direction = 'IN' THEN q."paidAmount" ELSE 0 END) as "inPaid",
        SUM(CASE WHEN q.direction = 'IN' THEN q."balanceAmount" ELSE 0 END) as "inBalance",
        COUNT(q.id) as "invoiceCount"
      FROM (${baseQuery}) q
      WHERE q."invoiceDate" IS NOT NULL AND q."invoiceDate" != ''
      GROUP BY 1
      ORDER BY 1 ASC
    `;
    const rawMonthly = await this.invoiceRepo.query(monthlyTrendSql);
    const monthlyTrend = rawMonthly.map((r: any) => ({
      month: r.month,
      outTotal: Number(r.outTotal) || 0,
      outPaid: Number(r.outPaid) || 0,
      outBalance: Number(r.outBalance) || 0,
      inTotal: Number(r.inTotal) || 0,
      inPaid: Number(r.inPaid) || 0,
      inBalance: Number(r.inBalance) || 0,
      invoiceCount: parseInt(r.invoiceCount || '0', 10),
    }));

    // Daily Forecast Timeline - Chỉ tính cho Forecast Horizons (T+7 / T+30)
    let dailyForecastTimeline: {
      dateKey: string;
      outAmount: number;
      outCount: number;
      inAmount: number;
      inCount: number;
    }[] = [];

    const isForecastHorizonApi =
      horizon === 'forecastNext7Days' ||
      horizon === 'forecastNextWeek' ||
      horizon === 'forecastNext30Days' ||
      horizon === 'forecastNextMonth';

    if (isForecastHorizonApi) {
      const dailyForecastSql = `
        SELECT
          CASE
            WHEN q."estimatedSettlementDate"::date < CURRENT_DATE THEN 'OVERDUE'
            ELSE TO_CHAR(q."estimatedSettlementDate"::date, 'YYYY-MM-DD')
          END as "dateKey",
          SUM(CASE WHEN q.direction = 'OUT' THEN q.${metricField} ELSE 0 END) as "outAmount",
          COUNT(CASE WHEN q.direction = 'OUT' THEN 1 ELSE NULL END) as "outCount",
          SUM(CASE WHEN q.direction = 'IN' THEN q.${metricField} ELSE 0 END) as "inAmount",
          COUNT(CASE WHEN q.direction = 'IN' THEN 1 ELSE NULL END) as "inCount"
        FROM (${baseQuery}) q
        WHERE q."estimatedSettlementDate" IS NOT NULL AND q."estimatedSettlementDate" != ''
        GROUP BY 1
        ORDER BY
          CASE WHEN CASE
            WHEN q."estimatedSettlementDate"::date < CURRENT_DATE THEN 'OVERDUE'
            ELSE TO_CHAR(q."estimatedSettlementDate"::date, 'YYYY-MM-DD')
          END = 'OVERDUE' THEN '0000-00-00' ELSE CASE
            WHEN q."estimatedSettlementDate"::date < CURRENT_DATE THEN 'OVERDUE'
            ELSE TO_CHAR(q."estimatedSettlementDate"::date, 'YYYY-MM-DD')
          END END ASC
      `;
      const rawDaily = await this.invoiceRepo.query(dailyForecastSql);
      dailyForecastTimeline = rawDaily.map((r: any) => ({
        dateKey: r.dateKey,
        outAmount: Number(r.outAmount) || 0,
        outCount: parseInt(r.outCount || '0', 10),
        inAmount: Number(r.inAmount) || 0,
        inCount: parseInt(r.inCount || '0', 10),
      }));
    }

    // Aging Breakdown (4 standard buckets) for both OUT and IN
    const agingBreakdownSql = `
      SELECT 
        SUM(CASE WHEN q.direction = 'OUT' AND q."agingDays" <= 30 THEN q."balanceAmount" ELSE 0 END) as "outAging0_30",
        SUM(CASE WHEN q.direction = 'OUT' AND q."agingDays" > 30 AND q."agingDays" <= 60 THEN q."balanceAmount" ELSE 0 END) as "outAging31_60",
        SUM(CASE WHEN q.direction = 'OUT' AND q."agingDays" > 60 AND q."agingDays" <= 90 THEN q."balanceAmount" ELSE 0 END) as "outAging61_90",
        SUM(CASE WHEN q.direction = 'OUT' AND q."agingDays" > 90 THEN q."balanceAmount" ELSE 0 END) as "outAgingOver90",
        SUM(CASE WHEN q.direction = 'IN' AND q."agingDays" <= 30 THEN q."balanceAmount" ELSE 0 END) as "inAging0_30",
        SUM(CASE WHEN q.direction = 'IN' AND q."agingDays" > 30 AND q."agingDays" <= 60 THEN q."balanceAmount" ELSE 0 END) as "inAging31_60",
        SUM(CASE WHEN q.direction = 'IN' AND q."agingDays" > 60 AND q."agingDays" <= 90 THEN q."balanceAmount" ELSE 0 END) as "inAging61_90",
        SUM(CASE WHEN q.direction = 'IN' AND q."agingDays" > 90 THEN q."balanceAmount" ELSE 0 END) as "inAgingOver90"
      FROM (${baseQuery}) q
    `;
    const rawAging = await this.invoiceRepo.query(agingBreakdownSql);
    const aRow = rawAging[0] || {};
    const agingBreakdown = {
      outAging0_30: Number(aRow.outAging0_30) || 0,
      outAging31_60: Number(aRow.outAging31_60) || 0,
      outAging61_90: Number(aRow.outAging61_90) || 0,
      outAgingOver90: Number(aRow.outAgingOver90) || 0,
      inAging0_30: Number(aRow.inAging0_30) || 0,
      inAging31_60: Number(aRow.inAging31_60) || 0,
      inAging61_90: Number(aRow.inAging61_90) || 0,
      inAgingOver90: Number(aRow.inAgingOver90) || 0,
    };

    // Ticket Size Pareto Distribution (Quy mô hóa đơn: <10M, 10-50M, 50-100M, >100M)
    const ticketSizeSql = `
      SELECT
        SUM(CASE WHEN q.direction = 'OUT' AND q."totalAmount" < 10000000 THEN q.${metricField} ELSE 0 END) as "outUnder10mAmount",
        COUNT(CASE WHEN q.direction = 'OUT' AND q."totalAmount" < 10000000 THEN 1 ELSE NULL END) as "outUnder10mCount",
        SUM(CASE WHEN q.direction = 'OUT' AND q."totalAmount" >= 10000000 AND q."totalAmount" < 50000000 THEN q.${metricField} ELSE 0 END) as "out10mTo50mAmount",
        COUNT(CASE WHEN q.direction = 'OUT' AND q."totalAmount" >= 10000000 AND q."totalAmount" < 50000000 THEN 1 ELSE NULL END) as "out10mTo50mCount",
        SUM(CASE WHEN q.direction = 'OUT' AND q."totalAmount" >= 50000000 AND q."totalAmount" < 100000000 THEN q.${metricField} ELSE 0 END) as "out50mTo100mAmount",
        COUNT(CASE WHEN q.direction = 'OUT' AND q."totalAmount" >= 50000000 AND q."totalAmount" < 100000000 THEN 1 ELSE NULL END) as "out50mTo100mCount",
        SUM(CASE WHEN q.direction = 'OUT' AND q."totalAmount" >= 100000000 THEN q.${metricField} ELSE 0 END) as "outOver100mAmount",
        COUNT(CASE WHEN q.direction = 'OUT' AND q."totalAmount" >= 100000000 THEN 1 ELSE NULL END) as "outOver100mCount",

        SUM(CASE WHEN q.direction = 'IN' AND q."totalAmount" < 10000000 THEN q.${metricField} ELSE 0 END) as "inUnder10mAmount",
        COUNT(CASE WHEN q.direction = 'IN' AND q."totalAmount" < 10000000 THEN 1 ELSE NULL END) as "inUnder10mCount",
        SUM(CASE WHEN q.direction = 'IN' AND q."totalAmount" >= 10000000 AND q."totalAmount" < 50000000 THEN q.${metricField} ELSE 0 END) as "in10mTo50mAmount",
        COUNT(CASE WHEN q.direction = 'IN' AND q."totalAmount" >= 10000000 AND q."totalAmount" < 50000000 THEN 1 ELSE NULL END) as "in10mTo50mCount",
        SUM(CASE WHEN q.direction = 'IN' AND q."totalAmount" >= 50000000 AND q."totalAmount" < 100000000 THEN q.${metricField} ELSE 0 END) as "in50mTo100mAmount",
        COUNT(CASE WHEN q.direction = 'IN' AND q."totalAmount" >= 50000000 AND q."totalAmount" < 100000000 THEN 1 ELSE NULL END) as "in50mTo100mCount",
        SUM(CASE WHEN q.direction = 'IN' AND q."totalAmount" >= 100000000 THEN q.${metricField} ELSE 0 END) as "inOver100mAmount",
        COUNT(CASE WHEN q.direction = 'IN' AND q."totalAmount" >= 100000000 THEN 1 ELSE NULL END) as "inOver100mCount"
      FROM (${baseQuery}) q
    `;
    const rawTicket = await this.invoiceRepo.query(ticketSizeSql);
    const tRow = rawTicket[0] || {};
    const ticketSizeBuckets = {
      outUnder10mAmount: Number(tRow.outUnder10mAmount) || 0,
      outUnder10mCount: parseInt(tRow.outUnder10mCount || '0', 10),
      out10mTo50mAmount: Number(tRow.out10mTo50mAmount) || 0,
      out10mTo50mCount: parseInt(tRow.out10mTo50mCount || '0', 10),
      out50mTo100mAmount: Number(tRow.out50mTo100mAmount) || 0,
      out50mTo100mCount: parseInt(tRow.out50mTo100mCount || '0', 10),
      outOver100mAmount: Number(tRow.outOver100mAmount) || 0,
      outOver100mCount: parseInt(tRow.outOver100mCount || '0', 10),

      inUnder10mAmount: Number(tRow.inUnder10mAmount) || 0,
      inUnder10mCount: parseInt(tRow.inUnder10mCount || '0', 10),
      in10mTo50mAmount: Number(tRow.in10mTo50mAmount) || 0,
      in10mTo50mCount: parseInt(tRow.in10mTo50mCount || '0', 10),
      in50mTo100mAmount: Number(tRow.in50mTo100mAmount) || 0,
      in50mTo100mCount: parseInt(tRow.in50mTo100mCount || '0', 10),
      inOver100mAmount: Number(tRow.inOver100mAmount) || 0,
      inOver100mCount: parseInt(tRow.inOver100mCount || '0', 10),
    };

    // Phân rã theo chi nhánh / địa điểm (Branch breakdown)
    const branchBreakdownSql = `
      SELECT 
        COALESCE(q."branchId"::text, 'UNASSIGNED') as "branchId",
        COALESCE(b.name, CASE WHEN q."branchId" IS NULL THEN 'Chưa phân chi nhánh' ELSE 'Chi nhánh khác' END) as "branchName",
        COALESCE(b.code, '') as "branchCode",
        SUM(CASE WHEN q.direction = 'OUT' THEN q.${metricField} ELSE 0 END) as "outAmount",
        COUNT(CASE WHEN q.direction = 'OUT' THEN 1 ELSE NULL END) as "outCount",
        SUM(CASE WHEN q.direction = 'IN' THEN q.${metricField} ELSE 0 END) as "inAmount",
        COUNT(CASE WHEN q.direction = 'IN' THEN 1 ELSE NULL END) as "inCount"
      FROM (${baseQuery}) q
      LEFT JOIN erp_branches b ON b.id = q."branchId"
      GROUP BY q."branchId", b.name, b.code
      ORDER BY "outAmount" DESC, "inAmount" DESC
    `;
    const rawBranch = await this.invoiceRepo.query(branchBreakdownSql);
    const branchBreakdown = rawBranch.map((r: any) => ({
      branchId: r.branchId,
      branchName:
        r.branchName ||
        (r.branchId === 'UNASSIGNED' ? 'Chưa phân chi nhánh' : r.branchId),
      branchCode: r.branchCode || '',
      outAmount: Number(r.outAmount) || 0,
      outCount: parseInt(r.outCount || '0', 10),
      inAmount: Number(r.inAmount) || 0,
      inCount: parseInt(r.inCount || '0', 10),
    }));

    // 2. Filter wrapper for items list
    let filteredQuery = `SELECT * FROM (${baseQuery}) p`;
    const whereConditions: string[] = [];

    if (direction && direction !== 'ALL') {
      whereConditions.push(`p.direction = '${direction}'`);
    }

    if (search && search.trim()) {
      const s = search.trim().replace(/'/g, "''");
      whereConditions.push(
        `(p."invoiceNo" ILIKE '%${s}%' OR p."serialNo" ILIKE '%${s}%' OR p."partnerName" ILIKE '%${s}%' OR p."taxCode" ILIKE '%${s}%' OR p.description ILIKE '%${s}%')`,
      );
    }

    if (columnSearch) {
      try {
        const cSearch = JSON.parse(columnSearch) as Record<string, string>;
        for (const [col, rawVal] of Object.entries(cSearch)) {
          if (!rawVal || !rawVal.trim()) continue;
          if (col === 'invoiceNo') {
            const noClause = buildKeywordSqlClause(
              `p."invoiceNo"`,
              rawVal.trim(),
            );
            const serialClause = buildKeywordSqlClause(
              `p."serialNo"`,
              rawVal.trim(),
            );
            if (noClause && serialClause) {
              whereConditions.push(`(${noClause} OR ${serialClause})`);
            } else if (noClause) {
              whereConditions.push(noClause);
            }
          } else if (col === 'partner' || col === 'partnerName') {
            const nameClause = buildKeywordSqlClause(
              `p."partnerName"`,
              rawVal.trim(),
            );
            const taxClause = buildKeywordSqlClause(
              `p."taxCode"`,
              rawVal.trim(),
            );
            if (nameClause && taxClause) {
              whereConditions.push(`(${nameClause} OR ${taxClause})`);
            } else if (nameClause) {
              whereConditions.push(nameClause);
            }
          } else {
            const searchClause = buildKeywordSqlClause(
              `p."${col}"`,
              rawVal.trim(),
            );
            if (searchClause) whereConditions.push(searchClause);
          }
        }
      } catch (e) {
        this.logger.warn(`Failed to parse columnSearch: ${e}`);
      }
    }

    if (columnFilters) {
      try {
        const cFilters = JSON.parse(columnFilters) as Record<string, string[]>;
        for (const [col, vals] of Object.entries(cFilters)) {
          if (!vals || vals.length === 0) continue;

          if (vals[0] === '__ALL_MATCHING__') {
            const searchKeyword = vals[1] || '';
            if (searchKeyword) {
              const searchClause = buildKeywordSqlClause(
                `p."${col}"`,
                searchKeyword,
              );
              if (searchClause) whereConditions.push(searchClause);
            }
            continue;
          }

          const hasBlank = vals.includes('__BLANK__');
          const validVals = vals.filter((v) => v !== '__BLANK__');

          const condParts: string[] = [];
          if (validVals.length > 0) {
            const quotedVals = validVals
              .map((v) => `'${v.replace(/'/g, "''")}'`)
              .join(', ');
            condParts.push(`CAST(p."${col}" AS TEXT) IN (${quotedVals})`);
          }
          if (hasBlank) {
            condParts.push(
              `(p."${col}" IS NULL OR CAST(p."${col}" AS TEXT) = '' OR CAST(p."${col}" AS TEXT) = 'KHONG_MST')`,
            );
          }
          if (condParts.length > 0) {
            whereConditions.push(`(${condParts.join(' OR ')})`);
          }
        }
      } catch (e) {
        this.logger.warn(`Failed to parse columnFilters: ${e}`);
      }
    }

    if (whereConditions.length > 0) {
      filteredQuery += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    // Count Total
    const countSql = `SELECT COUNT(*) as count FROM (${filteredQuery}) as t`;
    const countRes = await this.invoiceRepo.query(countSql);
    const total = parseInt(countRes[0]?.count || '0', 10);

    // Sorting & Pagination
    let orderClause = `ORDER BY p."balanceAmount" DESC, p."invoiceDate" DESC`;
    if (sortBy) {
      const cleanSortBy = sortBy.replace(/"/g, '');
      const cleanOrder = sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      orderClause = `ORDER BY p."${cleanSortBy}" ${cleanOrder}, p."balanceAmount" DESC`;
    }

    const safePageSize = Math.max(1, Math.min(200, pageSize));
    const offset = (Math.max(1, page) - 1) * safePageSize;
    const dataSql = `${filteredQuery} ${orderClause} LIMIT ${safePageSize} OFFSET ${offset}`;
    const rawData = await this.invoiceRepo.query(dataSql);

    const items: TimeHorizonInvoiceItem[] = (rawData || []).map((r: any) => ({
      id: r.id,
      invoiceNo: r.invoiceNo,
      serialNo: r.serialNo,
      invoiceDate: r.invoiceDate,
      direction: r.direction,
      sellerName: r.sellerName,
      sellerTaxCode: r.sellerTaxCode,
      sellerAddress: r.sellerAddress,
      buyerName: r.buyerName || r.buyerPersonalName,
      buyerTaxCode: r.buyerTaxCode || r.buyerCccd,
      buyerAddress: r.buyerAddress,
      partnerName: r.partnerName,
      taxCode: r.taxCode,
      preVatAmount: Number(r.preVatAmount) || 0,
      vatAmount: Number(r.vatAmount) || 0,
      totalAmount: Number(r.totalAmount) || 0,
      paidAmount: Number(r.paidAmount) || 0,
      balanceAmount: Number(r.balanceAmount) || 0,
      agingDays: parseInt(r.agingDays || '0', 10),
      partnerAvgLagDays: Math.round(Number(r.partnerAvgLagDays) || 30),
      estimatedSettlementDate: r.estimatedSettlementDate || null,
      recoveryProbability: Number(r.recoveryProbability) || 0,
      riskProbability: Number(r.riskProbability) || 0,
      expectedAmount: Number(r.expectedAmount) || 0,
      riskAmount: Number(r.riskAmount) || 0,
      status: r.status,
      taxInvoiceStatus: r.taxInvoiceStatus,
      description: r.description,
    }));

    return {
      summary: {
        horizon,
        horizonLabel,
        receivableAmount,
        payableAmount,
        receivableTotalAmount,
        payableTotalAmount,
        receivedAmount,
        paidAmount,
        receivableExpectedAmount,
        payableExpectedAmount,
        receivableRiskAmount,
        payableRiskAmount,
        netAmount,
        receivableCount,
        payableCount,
        topReceivablePartners,
        topPayablePartners,
        monthlyTrend,
        agingBreakdown,
        maturityBreakdown,
        dailyForecastTimeline,
        ticketSizeBuckets,
        branchBreakdown,
      },
      items,
      total,
      page,
      pageSize: safePageSize,
      totalPages: Math.ceil(total / safePageSize),
    };
  }
}
