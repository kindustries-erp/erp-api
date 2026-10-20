import * as ExcelJS from 'exceljs';
import { Injectable, Logger } from '@nestjs/common';
import { Subject } from 'rxjs';
import { VinfastPartsSyncService } from './services/vinfast-parts-sync.service';
import { VinfastPartsStockService } from './services/vinfast-parts-stock.service';
import { VinfastPartsLedgerService } from './services/vinfast-parts-ledger.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VinfastPartsLedger } from './entities/vinfast-parts-ledger.entity';
import { VinfastPartsCatalog } from './entities/vinfast-parts-catalog.entity';

@Injectable()
export class VinfastPartsService {
  private readonly logger = new Logger(VinfastPartsService.name);
  public readonly progress$ = new Subject<any>();

  constructor(
    private readonly syncService: VinfastPartsSyncService,
    private readonly stockService: VinfastPartsStockService,
    private readonly ledgerService: VinfastPartsLedgerService,
    @InjectRepository(VinfastPartsLedger)
    private readonly ledgerRepo: Repository<VinfastPartsLedger>,
    @InjectRepository(VinfastPartsCatalog)
    private readonly catalogRepo: Repository<VinfastPartsCatalog>,
  ) {}

  public resolveVinfastSku(
    itemCode: string | null | undefined,
    description: string | null | undefined,
  ): string | null {
    return this.syncService.resolveVinfastSku(itemCode, description);
  }

  async syncCatalog(options?: {
    dateFrom?: string;
    dateTo?: string;
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
    onProgress?: (current: number, total: number, message: string) => void;
  }): Promise<Buffer> {
    const { vehicleType, dateFrom, dateTo, columnFilters, onProgress } =
      options;
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
        i.invoice_no as "invoiceNo",
        i.invoice_date as "invoiceDate",
        i.buyer_name as "buyerName",
        i.seller_name as "sellerName",
        i.license_plate as "licensePlate",
        c.name as "partName",
        c.uom as "unit"
      FROM vinfast_parts_ledger l
      JOIN erp_invoices i ON i.id = l.invoice_id
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

    const ledgerSections: {
      sku: string;
      partName: string;
      unit: string;
      openingBalanceQty: number;
      openingBalanceValue: number;
      rows: any[];
      closingBalanceQty: number;
      closingBalanceValue: number;
    }[] = [];

    for (const [sku, entries] of entriesBySku.entries()) {
      const inQueue: { id: string; qty: number; unitCost: number }[] = [];
      const ledgerRowsForSku: any[] = [];
      let openingBalanceQty = 0;
      let openingBalanceValue = 0;
      let currentRunningQty = 0;
      let currentRunningValue = 0;
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
          ledgerRowsForSku.push(row);
          periodClosingBalanceQty = row.runningBalanceQty;
          periodClosingBalanceValue = row.runningBalanceValue;
        }
      }

      ledgerSections.push({
        sku,
        partName,
        unit,
        openingBalanceQty,
        openingBalanceValue,
        rows: ledgerRowsForSku,
        closingBalanceQty: periodClosingBalanceQty,
        closingBalanceValue: periodClosingBalanceValue,
      });
    }

    onProgress?.(80, totalProgress, 'Đang tạo workbook Excel...');

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Liouni ERP';

    // Sheet 1: Tổng hợp tồn kho
    const summarySheet = workbook.addWorksheet('Tổng Hợp Tồn Kho');
    summarySheet.columns = [
      { header: 'STT', key: 'stt', width: 8 },
      { header: 'Mã Phụ Tùng', key: 'sku', width: 22 },
      { header: 'Tên Phụ Tùng', key: 'name', width: 35 },
      { header: 'ĐVT', key: 'uom', width: 12 },
      { header: 'Tổng Nhập', key: 'qtyIn', width: 16 },
      { header: 'Tổng Xuất', key: 'qtyOut', width: 16 },
      { header: 'Tồn Kho', key: 'qtyBalance', width: 16 },
    ];

    overviewData.items.forEach((item: any, idx: number) => {
      summarySheet.addRow({
        stt: idx + 1,
        sku: item.sku,
        name: item.name,
        uom: item.uom,
        qtyIn: Number(item.qtyIn || 0),
        qtyOut: Number(item.qtyOut || 0),
        qtyBalance: Number(item.qtyBalance || 0),
      });
    });

    // Sheet 2: Sổ Cái Chi Tiết FIFO
    const ledgerSheet = workbook.addWorksheet('Sổ Cái Chi Tiết FIFO');
    ledgerSheet.columns = [
      { header: 'Mã Phụ Tùng', key: 'partSku', width: 22 },
      { header: 'Tên Phụ Tùng', key: 'partName', width: 30 },
      { header: 'Ngày Giao Dịch', key: 'transactionDate', width: 15 },
      { header: 'Số Hóa Đơn', key: 'invoiceNo', width: 15 },
      { header: 'Chiều', key: 'direction', width: 10 },
      { header: 'Số Lượng', key: 'qty', width: 14 },
      { header: 'Đơn Giá', key: 'unitCost', width: 16 },
      { header: 'Thành Tiền', key: 'amount', width: 18 },
      { header: 'Biển Số Xe', key: 'licensePlate', width: 15 },
      { header: 'Tồn Lũy Kế', key: 'runningBalanceQty', width: 16 },
      { header: 'Giá Trị Tồn Lũy Kế', key: 'runningBalanceValue', width: 20 },
    ];

    for (const section of ledgerSections) {
      for (const row of section.rows) {
        ledgerSheet.addRow({
          partSku: section.sku,
          partName: section.partName,
          transactionDate: row.transactionDate,
          invoiceNo: row.invoiceNo,
          direction: row.direction,
          qty: Number(row.qty || 0),
          unitCost: Number(row.unitCost || 0),
          amount: Number(row.preVatAmount || 0),
          licensePlate: row.licensePlate || '',
          runningBalanceQty: row.runningBalanceQty,
          runningBalanceValue: row.runningBalanceValue,
        });
      }
    }

    onProgress?.(95, totalProgress, 'Đang lưu file...');

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.isBuffer(buffer)
      ? buffer
      : Buffer.from(buffer as ArrayBuffer);
  }
}
