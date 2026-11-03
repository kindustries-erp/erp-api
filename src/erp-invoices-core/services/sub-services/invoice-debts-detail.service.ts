import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErpInvoice } from '../../entities/erp_invoice.entity';
import { InvoicePartnerType } from '../../dto/get-invoice-debts.dto';

@Injectable()
export class InvoiceDebtsDetailService {
  constructor(
    @InjectRepository(ErpInvoice)
    private readonly invoiceRepo: Repository<ErpInvoice>,
  ) {}

  /**
   * Lấy danh sách hóa đơn chi tiết của một đối tác cụ thể
   */
  async getPartnerInvoices(
    taxCode: string,
    partnerType?: InvoicePartnerType,
    dateFrom?: string,
    dateTo?: string,
    partnerName?: string,
  ) {
    const direction =
      partnerType === InvoicePartnerType.SUPPLIER ? 'IN' : 'OUT';

    let query = `
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
        CAST(inv.pre_vat_amount AS NUMERIC) as "preVatAmount",
        inv.vat_rate as "vatRate",
        CAST(inv.vat_amount AS NUMERIC) as "vatAmount",
        CAST(inv.total_amount AS NUMERIC) as "totalAmount",
        (COALESCE(netoff.net_off_amount, 0) + COALESCE(adj_orig.offset_amount, 0) + COALESCE(adj_item.offset_amount, 0)) as "paidAmount",
        CASE 
          WHEN inv.tax_invoice_status = 3 OR CAST(inv.total_amount AS NUMERIC) < 0 THEN
            CASE 
              WHEN COALESCE(adj_item.offset_amount, 0) >= ABS(CAST(inv.total_amount AS NUMERIC)) THEN 0
              ELSE CAST(inv.total_amount AS NUMERIC) + COALESCE(adj_item.offset_amount, 0)
            END
          ELSE
            GREATEST(0, CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0) - COALESCE(adj_orig.offset_amount, 0))
        END as "balanceAmount",
        GREATEST(0, (CURRENT_DATE - inv.invoice_date::date)) as "agingDays",
        inv.status,
        inv.tax_invoice_status as "taxInvoiceStatus",
        inv.description,
        inv.related_invoice_no as "relatedInvoiceNo",
        inv.related_serial_no as "relatedSerialNo",
        inv.effective_data as "effectiveData"
      FROM erp_invoices inv
      LEFT JOIN (
        SELECT invoice_id, SUM(net_off_amount) as net_off_amount
        FROM erp_invoice_voucher_netoff
        GROUP BY invoice_id
      ) netoff ON netoff.invoice_id = inv.id
      LEFT JOIN (
        SELECT original_invoice_id, SUM(offset_amount) as offset_amount
        FROM erp_invoice_adjustment_netoff
        GROUP BY original_invoice_id
      ) adj_orig ON adj_orig.original_invoice_id = inv.id
      LEFT JOIN (
        SELECT adjusting_invoice_id, SUM(offset_amount) as offset_amount
        FROM erp_invoice_adjustment_netoff
        GROUP BY adjusting_invoice_id
      ) adj_item ON adj_item.adjusting_invoice_id = inv.id
      WHERE inv.is_deleted = false 
        AND (inv.tax_invoice_status IS NULL OR inv.tax_invoice_status != 4)
    `;

    const parameters: any[] = [];
    let paramIndex = 1;

    if (direction === 'IN') {
      if (taxCode === 'KHONG_MST' || !taxCode) {
        query += ` AND inv.direction = 'IN' AND (inv.seller_tax_code IS NULL OR inv.seller_tax_code = '')`;
      } else {
        query += ` AND inv.direction = 'IN' AND inv.seller_tax_code = $${paramIndex++}`;
        parameters.push(taxCode);
      }
      if (partnerName && partnerName.trim()) {
        query += ` AND COALESCE(NULLIF(TRIM(inv.seller_name), ''), 'Nhà cung cấp') = $${paramIndex++}`;
        parameters.push(partnerName.trim());
      }
    } else {
      if (taxCode === 'KHONG_MST' || !taxCode) {
        query += ` AND inv.direction = 'OUT' AND (inv.buyer_tax_code IS NULL OR inv.buyer_tax_code = '') AND (inv.buyer_cccd IS NULL OR inv.buyer_cccd = '')`;
      } else {
        query += ` AND inv.direction = 'OUT' AND (inv.buyer_tax_code = $${paramIndex} OR inv.buyer_cccd = $${paramIndex})`;
        parameters.push(taxCode);
        paramIndex++;
      }
      if (partnerName && partnerName.trim()) {
        query += ` AND COALESCE(NULLIF(TRIM(inv.buyer_name), ''), NULLIF(TRIM(inv.buyer_personal_name), ''), 'Khách hàng lẻ') = $${paramIndex++}`;
        parameters.push(partnerName.trim());
      }
    }

    if (dateFrom) {
      query += ` AND inv.invoice_date >= $${paramIndex++}`;
      parameters.push(dateFrom);
    }
    if (dateTo) {
      const effTo = dateTo.length === 10 ? `${dateTo} 23:59:59.999` : dateTo;
      query += ` AND inv.invoice_date <= $${paramIndex++}`;
      parameters.push(effTo);
    }

    query += ` ORDER BY inv.invoice_date DESC`;

    const rawData = await this.invoiceRepo.query(query, parameters);

    return rawData.map((r: any) => ({
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
      preVatAmount: Number(r.preVatAmount) || 0,
      vatRate: r.vatRate != null ? String(r.vatRate) : null,
      vatAmount: Number(r.vatAmount) || 0,
      totalAmount: Number(r.totalAmount) || 0,
      paidAmount: Number(r.paidAmount) || 0,
      balanceAmount: Number(r.balanceAmount) || 0,
      agingDays: parseInt(r.agingDays || '0', 10),
      status: r.status,
      taxInvoiceStatus: r.taxInvoiceStatus,
      description: r.description,
    }));
  }

  /**
   * Các khoản sao kê đã gắn đối tác (MST) nhưng còn phần chưa cấn trừ hóa đơn nào.
   * Dòng thu cho khách hàng (OUT), dòng chi cho nhà cung cấp (IN). Tham số hóa toàn bộ SQL.
   */
  async getUnallocatedPayments(
    taxCode: string,
    partnerType?: InvoicePartnerType,
  ) {
    const amountFilter =
      partnerType === InvoicePartnerType.SUPPLIER
        ? 't.debit_amount > 0'
        : 't.credit_amount > 0';
    const rows: any[] = await this.invoiceRepo.query(
      `
      SELECT t.id,
             TO_CHAR(t.trans_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') AS "transDate",
             t.reference_number AS "referenceNumber",
             t.description,
             t.note,
             t.cashflow_purpose AS "cashflowPurpose",
             GREATEST(t.credit_amount, t.debit_amount)::text AS "amount",
             COALESCE(n.net_off, 0)::text AS "netOffAmount",
             GREATEST(0, GREATEST(t.credit_amount, t.debit_amount) - COALESCE(n.net_off, 0))::text AS "unallocatedAmount"
      FROM erp_bank_transactions t
      JOIN erp_business_partners p ON p.id = t.partner_id AND p.is_deleted = false
      LEFT JOIN (
        SELECT bank_transaction_id, SUM(net_off_amount) AS net_off
        FROM erp_invoice_voucher_netoff
        GROUP BY bank_transaction_id
      ) n ON n.bank_transaction_id = t.id
      WHERE t.is_deleted = false
        AND p.tax_code = $1
        AND ${amountFilter}
        AND GREATEST(0, GREATEST(t.credit_amount, t.debit_amount) - COALESCE(n.net_off, 0)) > 0
      ORDER BY t.trans_date DESC
      LIMIT 500
      `,
      [taxCode],
    );
    return {
      items: rows,
      total: rows.length,
    };
  }
}
