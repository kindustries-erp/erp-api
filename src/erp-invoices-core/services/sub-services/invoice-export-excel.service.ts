import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { ErpInvoice } from '../../entities/erp_invoice.entity';
import type { ErpInvoiceQuery } from '../../erp-invoices-core.service';
import {
  _loadNetOffAmounts,
  _mapSortByToQbColumn,
  _applyColumnSearch,
  _applyColumnFiltersExport,
} from './invoice-query-helpers';
import {
  summaryColumns,
  detailedColumns,
  overviewColumns,
  debtColumns,
  initSheetStructure,
  createOverviewAccumulator,
  writeSummaryRows,
  writeDetailedRows,
  writeOverviewRows,
  writeDebtRows,
} from './invoice-export-excel-writers.helper';

@Injectable()
export class InvoiceExportExcelService {
  private readonly logger = new Logger(InvoiceExportExcelService.name);

  public static readonly EXPORT_PROGRESS_TOTAL_UNITS = 100;

  constructor(
    @InjectRepository(ErpInvoice)
    private readonly repository: Repository<ErpInvoice>,
  ) {}

  /**
   * Excel export — replicates findAll filter logic then writes spreadsheet
   */
  async exportExcel(
    query: ErpInvoiceQuery,
    options?: {
      onProgress?: (current: number, total: number, message: string) => void;
    },
  ): Promise<Buffer> {
    const totalUnits = InvoiceExportExcelService.EXPORT_PROGRESS_TOTAL_UNITS;
    const emitProgress = (current: number, message: string) => {
      options?.onProgress?.(
        Math.max(0, Math.min(totalUnits, current)),
        totalUnits,
        message,
      );
    };

    emitProgress(5, 'Dang truy van danh sach hoa don...');

    const qb = this.repository
      .createQueryBuilder('inv')
      .leftJoinAndSelect('inv.items', 'items')
      .where('inv.is_deleted = false')
      .andWhere(query.direction ? 'inv.direction = :dir' : '1=1', {
        dir: query.direction,
      })
      .andWhere(query.status ? 'inv.status = :status' : '1=1', {
        status: query.status,
      })
      .andWhere(query.date_from ? 'inv.invoice_date >= :dateFrom' : '1=1', {
        dateFrom: query.date_from,
      })
      .andWhere(query.date_to ? 'inv.invoice_date <= :dateTo' : '1=1', {
        dateTo:
          query.date_to?.length === 10
            ? `${query.date_to} 23:59:59.999`
            : query.date_to,
      });

    if (query.search)
      qb.andWhere(
        `(inv.invoice_no ILIKE :q OR inv.serial_no ILIKE :q OR inv.buyer_name ILIKE :q OR inv.seller_name ILIKE :q OR inv.buyer_tax_code ILIKE :q OR inv.seller_tax_code ILIKE :q)`,
        { q: `%${query.search}%` },
      );
    if (query.seller_name)
      qb.andWhere('inv.seller_name ILIKE :sn', {
        sn: `%${query.seller_name}%`,
      });
    if (query.buyer_name)
      qb.andWhere('inv.buyer_name ILIKE :bn', {
        bn: `%${query.buyer_name}%`,
      });
    if (query.id) {
      qb.andWhere('inv.id = :invId', { invId: query.id });
    }
    if (query.invoice_no) {
      qb.andWhere('inv.invoice_no = :invNo', { invNo: query.invoice_no });
    }
    if (query.serial_no) {
      qb.andWhere('inv.serial_no = :serNo', { serNo: query.serial_no });
    }
    if (query.tag_id)
      qb.andWhere(
        `inv.id IN (SELECT entity_id FROM sys_entity_tags WHERE entity_type = 'erp_invoice' AND tag_id = :tagId)`,
        { tagId: query.tag_id },
      );

    let columnSearch: Record<string, string> = {};
    let columnFilters: Record<string, string[]> = {};
    try {
      if (query.column_search) columnSearch = JSON.parse(query.column_search);
      if (query.column_filters)
        columnFilters = JSON.parse(query.column_filters);
    } catch (e) {
      this.logger.error('Failed to parse column_search or column_filters', e);
    }

    _applyColumnSearch(qb, columnSearch, query.direction);
    _applyColumnFiltersExport(qb, columnFilters, query.direction);

    const needsNetOffJoin =
      query.sort_by === 'netOffAmount' ||
      query.sort_by === 'remainingAmount' ||
      columnSearch['netOffAmount'] !== undefined ||
      columnSearch['remainingAmount'] !== undefined ||
      (columnFilters['netOffAmount'] &&
        columnFilters['netOffAmount'].length > 0) ||
      (columnFilters['remainingAmount'] &&
        columnFilters['remainingAmount'].length > 0);

    if (needsNetOffJoin) {
      qb.leftJoin(
        '(SELECT invoice_id, SUM(net_off_amount) as net_off_sum FROM erp_invoice_voucher_netoff GROUP BY invoice_id)',
        'netoff_agg',
        'netoff_agg.invoice_id = inv.id',
      );
    }

    let orderColumn = 'inv.invoiceDate';
    let orderDirection: 'ASC' | 'DESC' = 'DESC';
    if (query.sort_by) {
      const col = _mapSortByToQbColumn(query.sort_by, query.direction);
      if (col) orderColumn = col;
    }
    if (query.sort_order)
      orderDirection = query.sort_order.toUpperCase() as 'ASC' | 'DESC';

    qb.orderBy(orderColumn, orderDirection).addOrderBy('inv.createdAt', 'DESC');
    let items = await qb.getMany();
    emitProgress(
      35,
      `Da tai ${items.length} hoa don, dang tong hop can tru...`,
    );

    items = await _loadNetOffAmounts(this.repository.manager, items);
    emitProgress(45, 'Dang tai du lieu chi nhanh...');

    const branches = await this.repository.manager.query(
      'SELECT id, name FROM erp_branches',
    );
    const branchMap: Record<string, string> = branches.reduce(
      (acc: any, curr: any) => {
        acc[curr.id] = curr.name;
        return acc;
      },
      {},
    );

    const workbook = new ExcelJS.Workbook();

    // Build Cumulative map for debt
    let cutoffDate = query.date_to ? query.date_to.substring(0, 10) : '';
    if (!cutoffDate) {
      const dates = items
        .map((i) =>
          i.invoiceDate ? String(i.invoiceDate).substring(0, 10) : '',
        )
        .filter(Boolean)
        .sort();
      cutoffDate =
        dates.length > 0
          ? dates[dates.length - 1]
          : new Date().toISOString().substring(0, 10);
    }
    const effectiveCutoffDate =
      cutoffDate.length === 10 ? `${cutoffDate} 23:59:59.999` : cutoffDate;

    let cumRows: any[] = [];
    try {
      cumRows = await this.repository.manager.query(
        `
        SELECT 
          CASE 
            WHEN inv.direction = 'IN' THEN COALESCE(inv.seller_tax_code, '')
            WHEN inv.direction = 'OUT' THEN COALESCE(inv.buyer_tax_code, '')
          END as "taxCode",
          CASE 
            WHEN inv.direction = 'IN' THEN COALESCE(inv.seller_name, '')
            WHEN inv.direction = 'OUT' THEN COALESCE(inv.buyer_name, '')
          END as "partnerName",
          SUM(CAST(inv.total_amount AS NUMERIC)) as "cumTotalAmount",
          SUM(COALESCE(netoff.net_off_amount, 0)) as "cumNetOffAmount"
        FROM erp_invoices inv
        LEFT JOIN (
          SELECT invoice_id, SUM(net_off_amount) as net_off_amount
          FROM erp_invoice_voucher_netoff
          GROUP BY invoice_id
        ) netoff ON netoff.invoice_id = inv.id
        WHERE inv.is_deleted = false 
          AND (inv.tax_invoice_status IS NULL OR inv.tax_invoice_status != 4)
          ${query.direction ? `AND inv.direction = '${query.direction}'` : ''}
          AND inv.invoice_date <= '${effectiveCutoffDate}'
        GROUP BY 
          CASE 
            WHEN inv.direction = 'IN' THEN COALESCE(inv.seller_tax_code, '')
            WHEN inv.direction = 'OUT' THEN COALESCE(inv.buyer_tax_code, '')
          END,
          CASE 
            WHEN inv.direction = 'IN' THEN COALESCE(inv.seller_name, '')
            WHEN inv.direction = 'OUT' THEN COALESCE(inv.buyer_name, '')
          END
        `,
      );
    } catch (e) {
      cumRows = [];
    }

    const cumMap = new Map<string, { cumTotal: number; cumNetOff: number }>();
    for (const r of cumRows || []) {
      const tCode = String(r.taxCode || '').trim();
      const pName = String(r.partnerName || '').trim();
      const key = `${tCode}:::${pName}`;
      cumMap.set(key, {
        cumTotal: Number(r.cumTotalAmount) || 0,
        cumNetOff: Number(r.cumNetOffAmount) || 0,
      });
    }

    const isSingleInvoice = Boolean(query.id && items.length === 1);

    if (isSingleInvoice) {
      const targetInvoice = items[0];
      const partnerTaxCode =
        targetInvoice.direction === 'IN'
          ? targetInvoice.sellerTaxCode
          : targetInvoice.buyerTaxCode;
      const partnerName =
        targetInvoice.direction === 'IN'
          ? targetInvoice.sellerName
          : targetInvoice.buyerName;

      let partnerItems: any[] = items;
      try {
        const partnerQb = this.repository
          .createQueryBuilder('inv')
          .leftJoinAndSelect('inv.items', 'items')
          .where('inv.is_deleted = false')
          .andWhere('inv.direction = :dir', { dir: targetInvoice.direction });

        if (partnerTaxCode && partnerTaxCode.trim()) {
          if (targetInvoice.direction === 'IN') {
            partnerQb.andWhere('inv.seller_tax_code = :ptc', {
              ptc: partnerTaxCode.trim(),
            });
          } else {
            partnerQb.andWhere('inv.buyer_tax_code = :ptc', {
              ptc: partnerTaxCode.trim(),
            });
          }
        } else if (partnerName && partnerName.trim()) {
          if (targetInvoice.direction === 'IN') {
            partnerQb.andWhere('inv.seller_name = :pname', {
              pname: partnerName.trim(),
            });
          } else {
            partnerQb.andWhere('inv.buyer_name = :pname', {
              pname: partnerName.trim(),
            });
          }
        }

        partnerQb
          .orderBy('inv.invoiceDate', 'DESC')
          .addOrderBy('inv.createdAt', 'DESC');
        partnerItems = await partnerQb.getMany();
        partnerItems = await _loadNetOffAmounts(
          this.repository.manager,
          partnerItems,
        );
      } catch (err: any) {
        this.logger.warn(
          `Failed to load partner invoices for export: ${err?.message}`,
        );
        partnerItems = items;
      }

      // 1. Sheet: Chi tiết HĐ (chỉ dữ liệu hóa đơn này)
      const singleSummarySheet = workbook.addWorksheet('Chi tiết HĐ');
      initSheetStructure(singleSummarySheet, summaryColumns);
      writeSummaryRows(singleSummarySheet, items, query.direction, branchMap);

      // 2. Sheet: Bảng kê HHDV HĐ (chỉ hàng hóa của hóa đơn này)
      const singleDetailedSheet = workbook.addWorksheet('Bảng kê HHDV HĐ');
      initSheetStructure(singleDetailedSheet, detailedColumns);
      writeDetailedRows(singleDetailedSheet, items, query.direction, branchMap);

      // 3. Sheet: Bảng kê đối tác (tổng hợp toàn bộ hóa đơn của đối tượng đó)
      const partnerSummarySheet = workbook.addWorksheet('Bảng kê đối tác');
      initSheetStructure(partnerSummarySheet, summaryColumns);
      writeSummaryRows(
        partnerSummarySheet,
        partnerItems,
        query.direction,
        branchMap,
      );

      // 4. Sheet: Tổng quan HHDV đối tác (đặt trước Bảng kê HHDV)
      const partnerOverviewSheet = workbook.addWorksheet(
        'Tổng quan HHDV đối tác',
      );
      initSheetStructure(partnerOverviewSheet, overviewColumns);

      // 5. Sheet: Bảng kê HHDV đối tác (toàn bộ hàng hóa của đối tượng đó)
      const partnerDetailedSheet = workbook.addWorksheet(
        'Bảng kê HHDV đối tác',
      );
      initSheetStructure(partnerDetailedSheet, detailedColumns);

      const partnerOverviewMap = new Map<string, any>();
      writeDetailedRows(
        partnerDetailedSheet,
        partnerItems,
        query.direction,
        branchMap,
        (p) => createOverviewAccumulator(partnerOverviewMap)(p),
      );
      writeOverviewRows(partnerOverviewSheet, partnerOverviewMap);

      // 6. Sheet: Công nợ đối tác
      const partnerDebtSheet = workbook.addWorksheet('Công nợ đối tác');
      initSheetStructure(partnerDebtSheet, debtColumns);
      writeDebtRows(partnerDebtSheet, partnerItems, query.direction, cumMap);
    } else {
      // 1. Sheet: Bảng kê
      const summarySheet = workbook.addWorksheet('Bảng kê');
      initSheetStructure(summarySheet, summaryColumns);
      writeSummaryRows(summarySheet, items, query.direction, branchMap);

      // 2. Sheet: Tổng quan HHDV (đặt trước Bảng kê HHDV)
      const overviewSheet = workbook.addWorksheet('Tổng quan HHDV');
      initSheetStructure(overviewSheet, overviewColumns);

      // 3. Sheet: Bảng kê HHDV
      const detailedSheet = workbook.addWorksheet('Bảng kê HHDV');
      initSheetStructure(detailedSheet, detailedColumns);

      const overviewMap = new Map<string, any>();
      writeDetailedRows(detailedSheet, items, query.direction, branchMap, (p) =>
        createOverviewAccumulator(overviewMap)(p),
      );
      writeOverviewRows(overviewSheet, overviewMap);

      // 4. Sheet: Công nợ theo đối tượng
      const debtSheet = workbook.addWorksheet('Công nợ theo đối tượng');
      initSheetStructure(debtSheet, debtColumns);
      writeDebtRows(debtSheet, items, query.direction, cumMap);
    }

    emitProgress(97, 'Dang dong goi file XLSX...');
    const buffer = await workbook.xlsx.writeBuffer();
    emitProgress(100, 'Da tao xong file XLSX');
    return buffer as any;
  }
}
