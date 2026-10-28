import { Injectable, Logger } from '@nestjs/common';
import { Subject } from 'rxjs';
import { buildVinfastPartsStockWorkbook } from './services/vinfast-parts-stock-excel.builder';
import { VinfastPartsSyncService } from './services/vinfast-parts-sync.service';
import { VinfastPartsStockService } from './services/vinfast-parts-stock.service';
import { VinfastPartsLedgerService } from './services/vinfast-parts-ledger.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VinfastPartsLedger } from './entities/vinfast-parts-ledger.entity';
import { VinfastPartsCatalog } from './entities/vinfast-parts-catalog.entity';
import { isVinfastCarPartCode } from '../reports-core/vinfast-car-part-codes';
import {
  VinfastSyncRunSnapshot,
  VinfastSyncRunState,
} from './helpers/vinfast-sync-run.state';

@Injectable()
export class VinfastPartsService {
  private readonly logger = new Logger(VinfastPartsService.name);
  public readonly progress$ = new Subject<any>();
  private readonly runState = new VinfastSyncRunState();

  constructor(
    private readonly syncService: VinfastPartsSyncService,
    private readonly stockService: VinfastPartsStockService,
    private readonly ledgerService: VinfastPartsLedgerService,
    @InjectRepository(VinfastPartsLedger)
    private readonly ledgerRepo: Repository<VinfastPartsLedger>,
    @InjectRepository(VinfastPartsCatalog)
    private readonly catalogRepo: Repository<VinfastPartsCatalog>,
  ) {
    this.progress$.subscribe((event) => this.runState.applyProgress(event));
  }

  /** Trạng thái lượt đồng bộ hiện tại (để hỏi lại khi SSE không nhận được sự kiện). */
  getSyncState(): VinfastSyncRunSnapshot {
    return this.runState.snapshot();
  }

  /**
   * Chạy đồng bộ danh mục rồi sổ cái trong nền. Trả started=false nếu đang có lượt chạy.
   */
  runFullSync(options: {
    dateFrom?: string;
    dateTo?: string;
    clearDb?: boolean;
  }): { started: boolean; state: VinfastSyncRunSnapshot } {
    if (!this.runState.start()) {
      return { started: false, state: this.runState.snapshot() };
    }
    void (async () => {
      try {
        await this.syncCatalog({ ...options, progress$: this.progress$ });
        await this.syncLedger({
          dateFrom: options.dateFrom,
          dateTo: options.dateTo,
          progress$: this.progress$,
        });
        this.runState.finish();
      } catch (e: any) {
        this.logger.error(`VinFast sync failed: ${e?.message ?? e}`);
        this.runState.finish(e?.message ?? String(e));
      }
    })();
    return { started: true, state: this.runState.snapshot() };
  }

  public resolveVinfastSku(
    itemCode: string | null | undefined,
    description: string | null | undefined,
  ): string | null {
    return this.syncService.resolveVinfastSku(itemCode, description);
  }

  async syncCatalog(options?: {
    dateFrom?: string;
    dateTo?: string;
    invoiceIds?: string[];
    progress$?: any;
    clearDb?: boolean;
  }) {
    return this.syncService.syncCatalog({
      ...options,
      progress$: options?.progress$ || this.progress$,
    });
  }

  async syncLedger(options?: {
    dateFrom?: string;
    dateTo?: string;
    invoiceIds?: string[];
    progress$?: any;
  }) {
    return this.syncService.syncLedger({
      ...options,
      progress$: options?.progress$ || this.progress$,
    });
  }

  async getPartsStock(
    vehicleType?: string,
    page: number = 1,
    limit: number = 50,
    search?: string,
    sortBy?: string,
    sortDir?: string,
    sorts?: string,
    columnSearch?: string,
    columnFilters?: string,
    stockTab?: string,
  ) {
    return this.stockService.getPartsStock(
      vehicleType,
      page,
      limit,
      search,
      sortBy,
      sortDir,
      sorts,
      columnSearch,
      columnFilters,
      stockTab,
    );
  }

  async getStockColumnOptions(
    columnKey: string,
    search?: string,
    page: number = 1,
    limit: number = 20,
    filters?: string,
    vehicleType?: string,
    stockTab?: string,
  ) {
    return this.stockService.getStockColumnOptions(
      columnKey,
      vehicleType,
      search,
      page,
      limit,
      filters,
      stockTab,
    );
  }

  async getPartLedgerHistory(sku: string) {
    return this.ledgerService.getPartLedgerHistory(sku);
  }

  async getFifoUnitRows(sku: string, page: number = 1, limit: number = 100) {
    return this.ledgerService.getFifoUnitRows(sku, page, limit);
  }

  async exportStockExcel(options: {
    vehicleType?: 'oto' | 'xemay' | 'CAR' | 'MOTORBIKE' | string;
    dateFrom?: string;
    dateTo?: string;
    columnFilters?: string;
    selectedColumns?: string[];
    onProgress?: (current: number, total: number, message: string) => void;
  }): Promise<Buffer> {
    const {
      vehicleType,
      dateFrom,
      dateTo,
      columnFilters,
      selectedColumns,
      onProgress,
    } = options;
    const totalProgress = 100;

    onProgress?.(5, totalProgress, 'Đang tải dữ liệu tổng quan tồn kho...');

    // 1. Lấy dữ liệu tổng quan tồn kho
    const overviewData = await this.getPartsStock(
      vehicleType,
      1,
      1000000,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      columnFilters,
    );
    const skus = overviewData.items.map((d: any) => d.sku);

    if (skus.length === 0) {
      throw new Error('Không có dữ liệu tồn kho để xuất.');
    }

    onProgress?.(20, totalProgress, 'Đang tải chi tiết giao dịch (FIFO)...');

    // 2. Tải toàn bộ sổ cái cho các mã sku này
    const query = `
      SELECT 
        l.part_sku as "partSku",
        l.id,
        l.direction,
        l.qty::numeric as qty,
        l.unit_cost::numeric as "unitCost",
        l.pre_vat_amount::numeric as "preVatAmount",
        l.transaction_date as "transactionDate",
        l.is_adjustment as "isAdjustment",
        l.adj_sign as "adjSign",
        l.invoice_id as "invoiceId",
        br.name as "invoiceBranchName",
        i.invoice_no as "invoiceNo",
        i.serial_no as "invoiceSerial",
        i.invoice_date as "invoiceDate",
        i.buyer_name as "buyerName",
        i.buyer_tax_code as "buyerTaxCode",
        i.seller_name as "sellerName",
        i.seller_tax_code as "sellerTaxCode",
        i.license_plate as "licensePlate",
        c.name as "partName",
        c.uom as "unit",
        ii.description as "invoiceItemName",
        ii.quantity::numeric as "invoiceItemQty",
        ii.unit_price::numeric as "invoiceItemUnitPrice",
        ii.pre_vat_amount::numeric as "invoiceItemPreVatAmount",
        ii.vat_rate as "invoiceItemVatRate",
        ii.vat_amount::numeric as "invoiceItemVatAmount",
        ii.total_amount::numeric as "invoiceItemTotalAmount"
      FROM vinfast_parts_ledger l
      JOIN erp_invoices i ON i.id = l.invoice_id
      LEFT JOIN erp_invoice_items ii ON ii.id = l.invoice_item_id
      LEFT JOIN erp_branches br ON br.id = i.branch_id
      LEFT JOIN vinfast_parts_catalog c ON c.sku = l.part_sku
      WHERE l.part_sku = ANY($1) AND i.tax_invoice_status IN (1, 3)
      ORDER BY l.part_sku ASC, l.transaction_date ASC, l.created_at ASC
    `;

    const allEntries = await this.ledgerRepo.query(query, [skus]);

    onProgress?.(50, totalProgress, 'Đang tính toán giá vốn FIFO...');

    // Nhóm theo SKU
    const entriesBySku = new Map<string, any[]>();
    for (const row of allEntries) {
      if (!entriesBySku.has(row.partSku)) {
        entriesBySku.set(row.partSku, []);
      }
      entriesBySku.get(row.partSku)?.push(row);
    }

    const formatPartnerName = (row: any): string => {
      const isOut = row.direction === 'OUT' || row.direction === 'Xuất';
      return (isOut ? row.buyerName : row.sellerName) || '';
    };

    const formatTaxCode = (row: any): string => {
      const isOut = row.direction === 'OUT' || row.direction === 'Xuất';
      return (isOut ? row.buyerTaxCode : row.sellerTaxCode) || '';
    };

    const formatVatRate = (rate: any): string => {
      if (rate == null || rate === '') return '';
      const str = String(rate).trim();
      if (str.endsWith('%')) return str;
      const num = Number(str);
      if (!isNaN(num)) return `${Math.round(num * 100)}%`;
      return str;
    };

    const calculateInvoiceItemTotalAmount = (row: any): number | null => {
      const dbTotal =
        row.invoiceItemTotalAmount != null
          ? Number(row.invoiceItemTotalAmount)
          : 0;
      if (dbTotal > 0) return dbTotal;

      const preVat =
        row.invoiceItemPreVatAmount != null
          ? Number(row.invoiceItemPreVatAmount)
          : 0;
      const vatAmt =
        row.invoiceItemVatAmount != null ? Number(row.invoiceItemVatAmount) : 0;
      const qty = row.invoiceItemQty != null ? Number(row.invoiceItemQty) : 0;
      const unitPrice =
        row.invoiceItemUnitPrice != null ? Number(row.invoiceItemUnitPrice) : 0;

      let vatRateDec = 0;
      if (row.invoiceItemVatRate != null && row.invoiceItemVatRate !== '') {
        const str = String(row.invoiceItemVatRate).replace('%', '').trim();
        const n = Number(str);
        if (!isNaN(n)) {
          vatRateDec = n > 1 ? n / 100 : n;
        }
      }

      if (preVat > 0) {
        if (vatAmt > 0) return preVat + vatAmt;
        if (vatRateDec > 0) return Math.round(preVat * (1 + vatRateDec));
        return preVat;
      }

      if (qty > 0 && unitPrice > 0) {
        const base = qty * unitPrice;
        if (vatAmt > 0) return base + vatAmt;
        if (vatRateDec > 0) return Math.round(base * (1 + vatRateDec));
        return base;
      }

      return dbTotal > 0 ? dbTotal : null;
    };

    const ledgerSections: {
      sku: string;
      partName: string;
      unit: string;
      vehicleType?: string;
      openingBalanceQty: number;
      openingBalanceValue: number;
      rows: any[];
      closingBalanceQty: number;
      closingBalanceValue: number;
    }[] = [];

    const skuStats = new Map<
      string,
      {
        openingBalanceQty: number;
        periodQtyIn: number;
        periodQtyOut: number;
        closingBalanceQty: number;
      }
    >();

    for (const [sku, entries] of entriesBySku.entries()) {
      const inQueue: { id: string; qty: number; unitCost: number }[] = [];
      const ledgerRowsForSku: any[] = [];
      let openingBalanceQty = 0;
      let openingBalanceValue = 0;
      let currentRunningQty = 0;
      let currentRunningValue = 0;
      let periodQtyIn = 0;
      let periodQtyOut = 0;
      const partName = entries[0]?.partName || '';
      const unit = entries[0]?.unit || '';

      for (const row of entries) {
        let qty = Number(row.qty || 0);
        let amount = Number(row.preVatAmount || 0);

        if (row.isAdjustment && row.adjSign === -1) {
          qty = -qty;
          amount = -amount;
        }

        if (row.direction === 'IN') {
          if (qty > 0) {
            inQueue.push({
              id: row.id,
              qty,
              unitCost: Number(row.unitCost || 0),
            });
          } else if (qty < 0) {
            let qToReverse = Math.abs(qty);
            while (qToReverse > 0 && inQueue.length > 0) {
              const batch = inQueue[0];
              if (batch.qty <= qToReverse) {
                qToReverse -= batch.qty;
                inQueue.shift();
              } else {
                batch.qty -= qToReverse;
                qToReverse = 0;
              }
            }
          }
          row.calculatedCogs = null;
        } else {
          let cogsForThisOut = 0;
          const batchesConsumed: {
            qty: number;
            unitCost: number;
            amount: number;
          }[] = [];
          if (qty > 0) {
            let qNeeded = qty;
            while (qNeeded > 0) {
              if (inQueue.length === 0) break;
              const batch = inQueue[0];
              if (batch.qty <= qNeeded) {
                cogsForThisOut += batch.qty * batch.unitCost;
                batchesConsumed.push({
                  qty: batch.qty,
                  unitCost: batch.unitCost,
                  amount: batch.qty * batch.unitCost,
                });
                qNeeded -= batch.qty;
                inQueue.shift();
              } else {
                cogsForThisOut += qNeeded * batch.unitCost;
                batchesConsumed.push({
                  qty: qNeeded,
                  unitCost: batch.unitCost,
                  amount: qNeeded * batch.unitCost,
                });
                batch.qty -= qNeeded;
                qNeeded = 0;
              }
            }
          }
          row.calculatedCogs = cogsForThisOut;
          row.calculatedUnitCost = qty !== 0 ? cogsForThisOut / qty : 0;
          row.batchesConsumed = batchesConsumed;
        }

        currentRunningQty = 0;
        currentRunningValue = 0;
        for (const q of inQueue) {
          currentRunningQty += q.qty;
          currentRunningValue += q.qty * q.unitCost;
        }
        row.runningBalanceQty = currentRunningQty;
        row.runningBalanceValue = currentRunningValue;

        if (dateFrom && row.transactionDate < new Date(dateFrom)) {
          openingBalanceQty = currentRunningQty;
          openingBalanceValue = currentRunningValue;
        }
      }

      let includeInFilter = (row: any) => {
        let ok = true;
        if (dateFrom && row.transactionDate < new Date(dateFrom)) ok = false;
        if (dateTo && row.transactionDate > new Date(dateTo + 'T23:59:59.999Z'))
          ok = false;
        return ok;
      };

      let periodClosingBalanceQty = openingBalanceQty;
      let periodClosingBalanceValue = openingBalanceValue;

      for (const row of entries) {
        if (includeInFilter(row)) {
          let qty = Number(row.qty || 0);
          if (row.isAdjustment && row.adjSign === -1) {
            qty = -qty;
          }
          if (row.direction === 'IN') {
            periodQtyIn += qty;
          } else if (row.direction === 'OUT') {
            periodQtyOut += qty;
          }

          ledgerRowsForSku.push({
            ...row,
            qty,
            direction:
              row.direction === 'IN' || row.direction === 'Nhập'
                ? 'Nhập'
                : 'Xuất',
            vehicleType: isVinfastCarPartCode(row.partSku) ? 'Ô tô' : 'Xe máy',
            invoicePartner: formatPartnerName(row),
            invoiceTaxCode: formatTaxCode(row),
            invoiceItemName: row.invoiceItemName || '',
            invoiceItemQty:
              row.invoiceItemQty != null ? Number(row.invoiceItemQty) : null,
            invoiceItemUnitPrice:
              row.invoiceItemUnitPrice != null
                ? Number(row.invoiceItemUnitPrice)
                : null,
            invoiceItemVatRate: formatVatRate(row.invoiceItemVatRate),
            invoiceItemTotalAmount: calculateInvoiceItemTotalAmount(row),
          });
          periodClosingBalanceQty = row.runningBalanceQty;
          periodClosingBalanceValue = row.runningBalanceValue;
        }
      }

      skuStats.set(sku, {
        openingBalanceQty,
        periodQtyIn,
        periodQtyOut,
        closingBalanceQty: periodClosingBalanceQty,
      });

      ledgerSections.push({
        sku,
        partName,
        unit,
        vehicleType: isVinfastCarPartCode(sku) ? 'Ô tô' : 'Xe máy',
        openingBalanceQty,
        openingBalanceValue,
        rows: ledgerRowsForSku,
        closingBalanceQty: periodClosingBalanceQty,
        closingBalanceValue: periodClosingBalanceValue,
      });
    }

    onProgress?.(80, totalProgress, 'Đang tạo workbook Excel...');

    const overviewItems = overviewData.items.map((item: any) => {
      const stats = skuStats.get(item.sku);
      const vehicleTypeLabel = isVinfastCarPartCode(item.sku)
        ? 'Ô tô'
        : 'Xe máy';
      if (stats) {
        return {
          ...item,
          vehicleType: vehicleTypeLabel,
          qtyOpening: stats.openingBalanceQty,
          qtyIn: stats.periodQtyIn,
          qtyOut: stats.periodQtyOut,
          qtyBalance: stats.closingBalanceQty,
        };
      }
      return {
        ...item,
        vehicleType: vehicleTypeLabel,
        qtyOpening: 0,
        qtyIn: Number(item.qtyIn || 0),
        qtyOut: Number(item.qtyOut || 0),
        qtyBalance: Number(item.qtyBalance || 0),
      };
    });

    const buffer = await buildVinfastPartsStockWorkbook({
      overviewItems,
      ledgerSections,
      selectedColumns,
      periodInfo: {
        dateFrom,
        dateTo,
        vehicleType,
        exportedAt: new Date(),
      },
    });

    onProgress?.(95, totalProgress, 'Đang lưu file...');

    return buffer;
  }
}
