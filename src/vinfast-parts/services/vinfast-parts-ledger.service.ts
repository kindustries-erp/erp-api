import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VinfastPartsLedger } from '../entities/vinfast-parts-ledger.entity';
import {
  calculateFifoUnitRows,
  calculateLedgerHistoryCogs,
  LedgerEntryForFifo,
} from '../engines/vinfast-fifo.engine';
import { FifoUnitRow } from '../dto/fifo-unit-row.dto';

@Injectable()
export class VinfastPartsLedgerService {
  private readonly logger = new Logger(VinfastPartsLedgerService.name);

  constructor(
    @InjectRepository(VinfastPartsLedger)
    private readonly ledgerRepo: Repository<VinfastPartsLedger>,
  ) {}

  /**
   * Lấy lịch sử giao dịch sổ cái theo mã SKU (hỗ trợ cả có và không có tiền tố VF-).
   */
  async getPartLedgerHistory(sku: string) {
    const rawSku = sku.trim();
    const vfSku = rawSku.startsWith('VF-') ? rawSku : `VF-${rawSku}`;
    const bareSku = rawSku.replace(/^VF-/, '');

    const query = `
      SELECT 
        l.id,
        l.direction,
        l.qty::numeric as qty,
        l.unit_cost::numeric as "unitCost",
        l.pre_vat_amount::numeric as "preVatAmount",
        l.transaction_date as "transactionDate",
        l.is_adjustment as "isAdjustment",
        l.adj_sign as "adjSign",
        l.invoice_id as "invoiceId",
        i.invoice_no as "invoiceNo",
        i.invoice_date as "invoiceDate",
        i.buyer_name as "buyerName",
        i.seller_name as "sellerName",
        i.buyer_tax_code as "buyerTaxCode",
        i.seller_tax_code as "sellerTaxCode",
        i.license_plate as "licensePlate"
      FROM vinfast_parts_ledger l
      JOIN erp_invoices i ON i.id = l.invoice_id
      WHERE (l.part_sku = $1 OR l.part_sku = $2) AND i.tax_invoice_status IN (1, 3)
      ORDER BY l.transaction_date ASC, l.created_at ASC
    `;

    const entries: LedgerEntryForFifo[] = await this.ledgerRepo.query(query, [
      vfSku,
      bareSku,
    ]);

    return calculateLedgerHistoryCogs(entries);
  }

  /**
   * Lấy bảng kê phân rã từng đơn vị FIFO theo mã SKU (hỗ trợ phân trang).
   */
  async getFifoUnitRows(
    sku: string,
    page: number = 1,
    limit: number = 100,
  ): Promise<{
    items: FifoUnitRow[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const rawSku = sku.trim();
    const vfSku = rawSku.startsWith('VF-') ? rawSku : `VF-${rawSku}`;
    const bareSku = rawSku.replace(/^VF-/, '');

    const query = `
      SELECT 
        l.id,
        l.direction,
        l.qty::numeric as qty,
        l.unit_cost::numeric as "unitCost",
        l.pre_vat_amount::numeric as "preVatAmount",
        l.transaction_date as "transactionDate",
        l.is_adjustment as "isAdjustment",
        l.adj_sign as "adjSign",
        i.id as "invoiceId",
        i.invoice_no as "invoiceNo",
        i.invoice_date as "invoiceDate",
        i.buyer_name as "buyerName",
        i.seller_name as "sellerName",
        i.license_plate as "licensePlate"
      FROM vinfast_parts_ledger l
      JOIN erp_invoices i ON i.id = l.invoice_id
      WHERE (l.part_sku = $1 OR l.part_sku = $2) AND i.tax_invoice_status IN (1, 3)
      ORDER BY l.transaction_date ASC, l.created_at ASC
    `;

    const entries: LedgerEntryForFifo[] = await this.ledgerRepo.query(query, [
      vfSku,
      bareSku,
    ]);

    const allUnitRows = calculateFifoUnitRows(entries);
    const total = allUnitRows.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const paginatedItems = allUnitRows.slice(startIndex, startIndex + limit);

    return {
      items: paginatedItems,
      total,
      page,
      limit,
      totalPages,
    };
  }
}
