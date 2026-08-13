import * as ExcelJS from 'exceljs';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
import { VinfastPartsCatalog } from './entities/vinfast-parts-catalog.entity';
import { VinfastPartsLedger } from './entities/vinfast-parts-ledger.entity';
import { ErpInvoiceItem } from '../erp-invoices-core/entities/erp_invoice_item.entity';
import { ErpInvoice } from '../erp-invoices-core/entities/erp_invoice.entity';

import { Subject } from 'rxjs';
import { VINFAST_CAR_PART_CODES } from '../reports-core/vinfast-car-part-codes';
import { FifoUnitRow } from './dto/fifo-unit-row.dto';

@Injectable()
export class VinfastPartsService {
  private readonly logger = new Logger(VinfastPartsService.name);
  public readonly progress$ = new Subject<any>();

  constructor(
    @InjectRepository(VinfastPartsCatalog)
    private catalogRepo: Repository<VinfastPartsCatalog>,
    @InjectRepository(VinfastPartsLedger)
    private ledgerRepo: Repository<VinfastPartsLedger>,
    @InjectRepository(ErpInvoiceItem)
    private invoiceItemRepo: Repository<ErpInvoiceItem>,
  ) {}

  async syncCatalog(options?: {
    dateFrom?: string;
    dateTo?: string;
    progress$?: any;
  }) {
    this.logger.log('Starting VinFast Parts Catalog sync...');
    if (options?.progress$) {
      options.progress$.next({
        processId: 'vinfast-sync',
        type: 'catalog',
        total: 100,
        current: 0,
        message: options.dateFrom
          ? `Đang quét hóa đơn trong hệ thống từ ${options.dateFrom} đến ${options.dateTo}...`
          : `Đang quét hóa đơn trong DB...`,
        completed: false,
      });
    }

    // 1. Get all distinct purchased items with parsed code
    const qb = this.invoiceItemRepo
      .createQueryBuilder('ii')
      .innerJoin('ii.invoice', 'i')
      .select('ii.itemCode', 'sku')
      .addSelect('MAX(ii.description)', 'raw_description')
      .addSelect('MAX(ii.unit)', 'uom')
      .where('ii.itemCode IS NOT NULL')
      .andWhere('i.direction = :direction', { direction: 'IN' })
      .andWhere('i.taxInvoiceStatus != :status', { status: 6 });

    if (options?.dateFrom && options?.dateTo) {
      qb.andWhere('i.invoiceDate >= :dateFrom AND i.invoiceDate <= :dateTo', {
        dateFrom: options.dateFrom,
        dateTo: options.dateTo,
      });
    }

    const rawItems = await qb.groupBy('ii.itemCode').getRawMany();

    this.logger.log(`Found ${rawItems.length} unique purchased items to sync.`);
    if (options?.progress$) {
      options.progress$.next({
        processId: 'vinfast-sync',
        type: 'catalog',
        total: rawItems.length,
        current: 0,
        message: `Đang bóc tách mã phụ tùng từ ${rawItems.length} hóa đơn trong DB...`,
        completed: false,
      });
    }

    let addedCount = 0;
    let processedCount = 0;

    // Process items in chunks
    for (const item of rawItems) {
      processedCount++;
      const { sku, raw_description, uom } = item;
      if (!sku) continue;

      const existing = await this.catalogRepo.findOne({ where: { sku } });
      if (!existing) {
        // Extract name by removing the code from the beginning
        // Pattern: [CODE][space or dash][name]
        const nameRegex = new RegExp(`^${sku}\\s*[-–]?\\s*(.*)$`);
        const match = (raw_description || '').match(nameRegex);
        const name =
          match && match[1] ? match[1].trim() : (raw_description || sku).trim();

        // Normalize UOM
        let normalizedUom = uom || 'Chiếc';
        if (normalizedUom.toUpperCase() === 'CHIẾC') normalizedUom = 'Chiếc';
        if (normalizedUom.toUpperCase() === 'CÁI') normalizedUom = 'Cái';

        // Check if service
        const isService = ['EEH', 'EMT', 'LFP'].some((prefix) =>
          sku.startsWith(prefix),
        );

        const newItem = this.catalogRepo.create({
          sku,
          name,
          uom: normalizedUom,
          isService,
        });

        await this.catalogRepo.save(newItem);
        addedCount++;
      }
    }

    // Add specific warranty items that might not have IN invoices
    const warrantyItems = [
      { sku: 'BAT21001011', name: 'HV BATTERY 41.9KWH', isService: false },
      { sku: 'PVT20030000', name: 'Động cơ điện (Bảo hành)', isService: false },
      { sku: 'BEX69063002AB', name: 'ĐÈN HẬU PHẢI', isService: false },
    ];

    for (const wItem of warrantyItems) {
      const existing = await this.catalogRepo.findOne({
        where: { sku: wItem.sku },
      });
      if (!existing) {
        await this.catalogRepo.save(
          this.catalogRepo.create({
            sku: wItem.sku,
            name: wItem.name,
            uom: 'Chiếc',
            isService: wItem.isService,
            notes: 'Added from manual warranty list',
          }),
        );
        addedCount++;
      }
    }

    this.logger.log(`Catalog sync completed. Added ${addedCount} new items.`);
    if (options?.progress$) {
      options.progress$.next({
        processId: 'vinfast-sync',
        type: 'catalog',
        total: rawItems.length,
        current: rawItems.length,
        message: `Cập nhật Danh mục (Catalog): Thêm mới ${addedCount} mã, Bỏ qua ${rawItems.length - addedCount} mã.`,
        completed: false,
      });
    }
    return {
      addedCount,
      totalProcessed: rawItems.length + warrantyItems.length,
    };
  }

  async syncLedger(options?: {
    dateFrom?: string;
    dateTo?: string;
    progress$?: any;
  }) {
    this.logger.log('Starting VinFast Parts Ledger sync...');

    // We process items that have itemCode mapped to our catalog
    const qb = this.invoiceItemRepo
      .createQueryBuilder('ii')
      .innerJoinAndSelect('ii.invoice', 'i')
      .where('ii.itemCode IS NOT NULL');

    if (options?.dateFrom && options?.dateTo) {
      qb.andWhere('i.invoiceDate >= :dateFrom AND i.invoiceDate <= :dateTo', {
        dateFrom: options.dateFrom,
        dateTo: options.dateTo,
      });
    }

    const invoiceItems = await qb.getMany();

    let processedCount = 0;
    let addedCount = 0;
    let skippedCount = 0;
    let updatedCount = 0;
    let deletedCount = 0;

    for (const ii of invoiceItems) {
      const i = ii.invoice;
      if (!i) continue;

      const sku = ii.itemCode;
      if (!sku) continue;

      processedCount++;
      if (options?.progress$ && processedCount % 50 === 0) {
        options.progress$.next({
          processId: 'vinfast-sync',
          type: 'ledger',
          total: invoiceItems.length,
          current: processedCount,
          message: `Đang xử lý Sổ cái: ${processedCount}/${invoiceItems.length} dòng...`,
          completed: false,
        });
      }

      // Make sure the SKU exists in catalog
      const catalogItem = await this.catalogRepo.findOne({ where: { sku } });
      if (!catalogItem) {
        skippedCount++;
        continue;
      }

      if (catalogItem.isService) {
        skippedCount++;
        continue;
      }

      const existing = await this.ledgerRepo.findOne({
        where: { invoiceItemId: ii.id },
      });

      const status = i.taxInvoiceStatus;

      // 1. Canceled Invoice -> Delete if exists, otherwise skip
      if (status === 6) {
        if (existing) {
          await this.ledgerRepo.remove(existing);
          deletedCount++;
        } else {
          skippedCount++;
        }
        continue;
      }

      let qty = Number(ii.quantity) || 1;
      let preVatAmount = Number(ii.preVatAmount) || 0;
      let unitCost = Number(ii.unitPrice) || null;
      let isAdjustment = false;
      let adjSign = 1;

      if (status === 3) {
        isAdjustment = true;
        if (preVatAmount < 0) {
          adjSign = -1;
        } else if (preVatAmount > 0) {
          adjSign = 1;
        }

        if (qty === 1 && Math.abs(preVatAmount) > 0) {
          qty = 0;
        } else if (qty < 0) {
          adjSign = -1;
        }

        qty = Math.abs(qty);
        preVatAmount = Math.abs(preVatAmount);
      }

      if (existing) {
        let changed = false;
        if (existing.qty !== qty) {
          existing.qty = qty;
          changed = true;
        }
        if (existing.preVatAmount !== preVatAmount) {
          existing.preVatAmount = preVatAmount;
          changed = true;
        }
        if (existing.isAdjustment !== isAdjustment) {
          existing.isAdjustment = isAdjustment;
          changed = true;
        }
        if (existing.adjSign !== adjSign) {
          existing.adjSign = adjSign;
          changed = true;
        }

        if (changed) {
          await this.ledgerRepo.save(existing);
          updatedCount++;
        } else {
          skippedCount++;
        }
        continue;
      }

      const ledgerEntry = this.ledgerRepo.create({
        partSku: sku,
        invoiceItemId: ii.id,
        invoiceId: i.id,
        direction: i.direction as 'IN' | 'OUT',
        qty,
        unitCost: i.direction === 'IN' ? unitCost : null,
        preVatAmount,
        transactionDate: i.invoiceDate,
        licensePlate: i.direction === 'OUT' ? i.licensePlate : null,
        isAdjustment,
        adjSign,
      });

      await this.ledgerRepo.save(ledgerEntry);
      addedCount++;
    }

    this.logger.log(
      `Ledger sync completed. Processed: ${processedCount}, Added: ${addedCount}, Updated: ${updatedCount}, Deleted: ${deletedCount}, Skipped: ${skippedCount}`,
    );
    if (options?.progress$) {
      options.progress$.next({
        processId: 'vinfast-sync',
        type: 'ledger',
        total: invoiceItems.length,
        current: processedCount,
        message: `Cập nhật Sổ cái (Ledger): Đã xử lý ${processedCount} dòng, Thêm mới ${addedCount}, Cập nhật ${updatedCount}, Xóa ${deletedCount}, Bỏ qua ${skippedCount}.`,
        completed: true,
      });
    }
    return {
      processedCount,
      addedCount,
      updatedCount,
      deletedCount,
      skippedCount,
    };
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
  ) {
    const carCodesStr = VINFAST_CAR_PART_CODES.map((c) => `'${c}'`).join(',');
    const params: any[] = [];
    let paramIndex = 1;

    let vehicleTypeFilter = '';
    if (vehicleType) {
      if (vehicleType === 'oto' || vehicleType === 'CAR') {
        vehicleTypeFilter = ` AND c.sku IN (${carCodesStr})`;
      } else if (vehicleType === 'xemay' || vehicleType === 'MOTORBIKE') {
        vehicleTypeFilter = ` AND c.sku NOT IN (${carCodesStr})`;
      }
    }

    let searchFilter = '';
    if (search) {
      searchFilter += ` AND (c.sku ILIKE $${paramIndex} OR c.name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    let cSearchFilter = '';
    let havingSearchFilter = '';
    if (columnSearch) {
      try {
        const parsed = JSON.parse(columnSearch);
        for (const [col, val] of Object.entries(parsed)) {
          if (!val) continue;
          const strVal = val as string;
          if (col === 'sku') {
            cSearchFilter += ` AND c.sku ILIKE $${paramIndex}`;
            params.push(`%${strVal}%`);
            paramIndex++;
          } else if (col === 'name') {
            cSearchFilter += ` AND c.name ILIKE $${paramIndex}`;
            params.push(`%${strVal}%`);
            paramIndex++;
          } else if (col === 'uom') {
            cSearchFilter += ` AND c.uom ILIKE $${paramIndex}`;
            params.push(`%${strVal}%`);
            paramIndex++;
          } else if (['qtyIn', 'qtyOut', 'qtyBalance'].includes(col)) {
            havingSearchFilter += ` AND CAST("${col}" AS TEXT) ILIKE $${paramIndex}`;
            params.push(`%${strVal}%`);
            paramIndex++;
          }
        }
      } catch (e) {}
    }

    let cFiltersSql = '';
    let havingFiltersSql = '';
    if (columnFilters) {
      try {
        const parsed = JSON.parse(columnFilters);
        for (const [col, vals] of Object.entries(parsed)) {
          const arr = vals as string[];
          if (!arr || arr.length === 0) continue;
          if (col === 'sku') {
            cFiltersSql += ` AND c.sku = ANY($${paramIndex})`;
            params.push(arr);
            paramIndex++;
          } else if (col === 'name') {
            cFiltersSql += ` AND c.name = ANY($${paramIndex})`;
            params.push(arr);
            paramIndex++;
          } else if (col === 'uom') {
            cFiltersSql += ` AND c.uom = ANY($${paramIndex})`;
            params.push(arr);
            paramIndex++;
          } else if (col === 'vehicleType') {
            const isCar = arr.includes('CAR');
            const isMoto = arr.includes('MOTORBIKE');
            if (isCar && !isMoto) {
              cFiltersSql += ` AND c.sku IN (${carCodesStr})`;
            } else if (!isCar && isMoto) {
              cFiltersSql += ` AND c.sku NOT IN (${carCodesStr})`;
            }
          } else if (['qtyIn', 'qtyOut', 'qtyBalance'].includes(col)) {
            // numeric array filtering might require type casting
            havingFiltersSql += ` AND CAST("${col}" AS TEXT) = ANY($${paramIndex})`;
            params.push(arr);
            paramIndex++;
          }
        }
      } catch (e) {}
    }

    let orderSql = 'ORDER BY "qtyBalance" DESC, sku ASC';
    if (sorts) {
      try {
        const sortsArr = JSON.parse(sorts) as string[];
        if (sortsArr.length > 0) {
          const sortFields: string[] = [];
          for (const s of sortsArr) {
            const isDesc = s.startsWith('-');
            const col = s.replace(/^-/, '');
            const dir = isDesc ? 'DESC' : 'ASC';
            let sqlCol = '';
            if (col === 'sku') sqlCol = 'sku';
            else if (col === 'name') sqlCol = 'name';
            else if (col === 'uom') sqlCol = 'uom';
            else if (col === 'qtyIn') sqlCol = '"qtyIn"';
            else if (col === 'qtyOut') sqlCol = '"qtyOut"';
            else if (col === 'qtyBalance') sqlCol = '"qtyBalance"';

            if (sqlCol) {
              sortFields.push(`${sqlCol} ${dir} NULLS LAST`);
            }
          }
          if (sortFields.length > 0) {
            orderSql = `ORDER BY ${sortFields.join(', ')}`;
          }
        }
      } catch (e) {}
    } else if (sortBy) {
      let sqlCol = '';
      if (sortBy === 'sku') sqlCol = 'sku';
      else if (sortBy === 'name') sqlCol = 'name';
      else if (sortBy === 'uom') sqlCol = 'uom';
      else if (sortBy === 'qtyIn') sqlCol = '"qtyIn"';
      else if (sortBy === 'qtyOut') sqlCol = '"qtyOut"';
      else if (sortBy === 'qtyBalance') sqlCol = '"qtyBalance"';

      const dir = sortDir === 'asc' ? 'ASC' : 'DESC';
      if (sqlCol) orderSql = `ORDER BY ${sqlCol} ${dir} NULLS LAST`;
    }

    const whereClause = `WHERE c.is_service = false ${vehicleTypeFilter} ${searchFilter} ${cSearchFilter} ${cFiltersSql}`;

    const baseQuery = `
      WITH StockData AS (
        SELECT 
          c.sku, 
          c.name, 
          c.uom, 
          c.is_service as "isService",
          CASE WHEN c.sku IN (${carCodesStr}) THEN 'CAR' ELSE 'MOTORBIKE' END as "vehicleType",
          COALESCE(SUM(CASE WHEN l.direction = 'IN' THEN l.qty ELSE 0 END), 0) as "qtyIn",
          COALESCE(SUM(CASE WHEN l.direction = 'OUT' THEN l.qty ELSE 0 END), 0) as "qtyOut",
          (COALESCE(SUM(CASE WHEN l.direction = 'IN' THEN l.qty ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN l.direction = 'OUT' THEN l.qty ELSE 0 END), 0)) as "qtyBalance"
        FROM vinfast_parts_catalog c
        LEFT JOIN vinfast_parts_ledger l ON l.part_sku = c.sku
        ${whereClause}
        GROUP BY c.sku, c.name, c.uom, c.is_service
      )
    `;

    const finalQuery = `
      ${baseQuery}
      SELECT * FROM StockData
      WHERE 1=1 ${havingSearchFilter} ${havingFiltersSql}
      ${orderSql}
      LIMIT ${limit} OFFSET ${(page - 1) * limit}
    `;

    const countQuery = `
      ${baseQuery}
      SELECT COUNT(*) as total FROM StockData
      WHERE 1=1 ${havingSearchFilter} ${havingFiltersSql}
    `;

    const [items, countResult] = await Promise.all([
      this.catalogRepo.query(finalQuery, params),
      this.catalogRepo.query(countQuery, params),
    ]);

    const total = parseInt(countResult[0]?.total || '0', 10);
    return {
      data: items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getStockColumnOptions(
    columnKey: string,
    search?: string,
    page: number = 1,
    limit: number = 20,
    filtersStr?: string,
    vehicleType?: string,
  ) {
    const carCodesStr = VINFAST_CAR_PART_CODES.map((c) => `'${c}'`).join(',');
    const params: any[] = [];
    let paramIndex = 1;

    let vehicleTypeFilter = '';
    if (vehicleType) {
      if (vehicleType === 'oto' || vehicleType === 'CAR') {
        vehicleTypeFilter = ` AND c.sku IN (${carCodesStr})`;
      } else if (vehicleType === 'xemay' || vehicleType === 'MOTORBIKE') {
        vehicleTypeFilter = ` AND c.sku NOT IN (${carCodesStr})`;
      }
    }

    let cFiltersSql = '';
    let havingFiltersSql = '';
    if (filtersStr) {
      try {
        const filters = JSON.parse(filtersStr);
        for (const [col, vals] of Object.entries(filters)) {
          const arr = vals as string[];
          if (!arr || arr.length === 0) continue;
          if (col === 'vehicleType') {
            const isCar = arr.includes('CAR');
            const isMoto = arr.includes('MOTORBIKE');
            if (isCar && !isMoto) {
              cFiltersSql += ` AND c.sku IN (${carCodesStr})`;
            } else if (!isCar && isMoto) {
              cFiltersSql += ` AND c.sku NOT IN (${carCodesStr})`;
            }
          } else if (col !== columnKey) {
            if (col === 'sku') {
              cFiltersSql += ` AND c.sku = ANY($${paramIndex})`;
              params.push(arr);
              paramIndex++;
            } else if (col === 'name') {
              cFiltersSql += ` AND c.name = ANY($${paramIndex})`;
              params.push(arr);
              paramIndex++;
            } else if (col === 'uom') {
              cFiltersSql += ` AND c.uom = ANY($${paramIndex})`;
              params.push(arr);
              paramIndex++;
            } else if (['qtyIn', 'qtyOut', 'qtyBalance'].includes(col)) {
              havingFiltersSql += ` AND CAST("${col}" AS TEXT) = ANY($${paramIndex})`;
              params.push(arr);
              paramIndex++;
            }
          }
        }
      } catch (e) {}
    }

    let searchSql = '';
    let havingSearchSql = '';
    if (search) {
      if (columnKey === 'sku') {
        searchSql = ` AND c.sku ILIKE $${paramIndex}`;
        params.push(`%${search}%`);
        paramIndex++;
      } else if (columnKey === 'name') {
        searchSql = ` AND c.name ILIKE $${paramIndex}`;
        params.push(`%${search}%`);
        paramIndex++;
      } else if (columnKey === 'uom') {
        searchSql = ` AND c.uom ILIKE $${paramIndex}`;
        params.push(`%${search}%`);
        paramIndex++;
      } else if (['qtyIn', 'qtyOut', 'qtyBalance'].includes(columnKey)) {
        havingSearchSql = ` AND CAST("${columnKey}" AS TEXT) ILIKE $${paramIndex}`;
        params.push(`%${search}%`);
        paramIndex++;
      }
    }

    let selectCol = 'sku';
    if (columnKey === 'name') selectCol = 'name';
    else if (columnKey === 'uom') selectCol = 'uom';
    else if (columnKey === 'sku') selectCol = 'sku';
    else if (['qtyIn', 'qtyOut', 'qtyBalance'].includes(columnKey))
      selectCol = `"${columnKey}"`;

    const baseQuery = `
      WITH StockData AS (
        SELECT 
          c.sku, 
          c.name, 
          c.uom, 
          c.is_service as "isService",
          CASE WHEN c.sku IN (${carCodesStr}) THEN 'CAR' ELSE 'MOTORBIKE' END as "vehicleType",
          COALESCE(SUM(CASE WHEN l.direction = 'IN' THEN l.qty ELSE 0 END), 0) as "qtyIn",
          COALESCE(SUM(CASE WHEN l.direction = 'OUT' THEN l.qty ELSE 0 END), 0) as "qtyOut",
          (COALESCE(SUM(CASE WHEN l.direction = 'IN' THEN l.qty ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN l.direction = 'OUT' THEN l.qty ELSE 0 END), 0)) as "qtyBalance"
        FROM vinfast_parts_catalog c
        LEFT JOIN vinfast_parts_ledger l ON l.part_sku = c.sku
        WHERE c.is_service = false ${vehicleTypeFilter} ${cFiltersSql} ${searchSql}
        GROUP BY c.sku, c.name, c.uom, c.is_service
      )
    `;

    const query = `
      ${baseQuery}
      SELECT DISTINCT CAST(${selectCol} AS TEXT) as value
      FROM StockData
      WHERE 1=1 ${havingFiltersSql} ${havingSearchSql}
      ORDER BY value ASC
      LIMIT ${limit} OFFSET ${(page - 1) * limit}
    `;

    const countQuery = `
      ${baseQuery}
      SELECT COUNT(DISTINCT CAST(${selectCol} AS TEXT)) as total
      FROM StockData
      WHERE 1=1 ${havingFiltersSql} ${havingSearchSql}
    `;

    const [items, countResult] = await Promise.all([
      this.catalogRepo.query(query, params),
      this.catalogRepo.query(countQuery, params),
    ]);

    const total = parseInt(countResult[0]?.total || '0', 10);
    return {
      items: items.map((i: any) => i.value).filter((v: any) => v != null),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getPartLedgerHistory(sku: string) {
    // Return IN transactions and OUT transactions separately or together,
    // we need to return them in a way that helps trace FIFO.
    // Let's just return all ledger entries ordered by date and creation time
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
      WHERE l.part_sku = $1 AND i.tax_invoice_status IN (1, 3)
      ORDER BY l.transaction_date ASC, l.created_at ASC
    `;

    const entries = await this.ledgerRepo.query(query, [sku]);

    // We will do a mini-FIFO calculation here to attach the exact unit_cost for OUT transactions
    // so the UI can just display it.
    const inQueue: { id: string; qty: number; unitCost: number }[] = [];

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
        if (qty > 0) {
          let qNeeded = qty;
          while (qNeeded > 0) {
            if (inQueue.length === 0) {
              break;
            }
            const batch = inQueue[0];
            if (batch.qty <= qNeeded) {
              cogsForThisOut += batch.qty * batch.unitCost;
              qNeeded -= batch.qty;
              inQueue.shift();
            } else {
              cogsForThisOut += qNeeded * batch.unitCost;
              batch.qty -= qNeeded;
              qNeeded = 0;
            }
          }
        }
        // Save the calculated avg unit cost for this OUT transaction
        row.calculatedCogs = cogsForThisOut;
        row.calculatedUnitCost = qty !== 0 ? cogsForThisOut / qty : 0;
      }
    }

    return entries;
  }

  async getFifoUnitRows(sku: string, page: number = 1, limit: number = 100) {
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
      WHERE l.part_sku = $1 AND i.tax_invoice_status IN (1, 3)
      ORDER BY l.transaction_date ASC, l.created_at ASC
    `;

    const entries = await this.ledgerRepo.query(query, [sku]);

    const unitRows: FifoUnitRow[] = [];
    let unitIndexCounter = 1;
    // We keep a queue of indices pointing to IN units in unitRows
    const inQueue: number[] = [];

    for (const row of entries) {
      let qty = Number(row.qty || 0);
      let amount = Number(row.preVatAmount || 0);

      if (row.isAdjustment && row.adjSign === -1) {
        qty = -qty;
        amount = -amount;
      }

      if (row.direction === 'IN') {
        if (qty > 0) {
          const unitCost = Number(row.unitCost || 0);
          unitRows.push({
            unitIndex: unitIndexCounter++,
            inLedgerId: row.id,
            inDate: row.transactionDate,
            inInvoiceNo: row.invoiceNo,
            inInvoiceId: row.invoiceId,
            inUnitCost: unitCost,
            qty: qty,
            status: 'IN_STOCK',
          });
          inQueue.push(unitRows.length - 1);
        } else if (qty < 0) {
          let qToReverse = Math.abs(qty);
          while (qToReverse > 0 && inQueue.length > 0) {
            const rowIndex = inQueue[0];
            const unitRow = unitRows[rowIndex];

            if (unitRow.qty! <= qToReverse + 0.0001) {
              // tolerance
              qToReverse -= unitRow.qty!;
              unitRow.status = 'ADJUSTMENT';
              inQueue.shift();
            } else {
              unitRow.qty =
                Math.round((unitRow.qty! - qToReverse) * 10000) / 10000;
              unitRows.push({
                ...unitRow,
                qty: qToReverse,
                unitIndex: unitIndexCounter++,
                status: 'ADJUSTMENT',
              });
              qToReverse = 0;
            }
          }
        }
      } else if (row.direction === 'OUT') {
        if (qty > 0) {
          const outPricePerUnit = qty !== 0 ? amount / qty : 0;
          let qNeeded = qty;
          while (qNeeded > 0 && inQueue.length > 0) {
            const rowIndex = inQueue[0];
            const unitRow = unitRows[rowIndex];

            if (unitRow.qty! <= qNeeded + 0.0001) {
              qNeeded -= unitRow.qty!;
              unitRow.outLedgerId = row.id;
              unitRow.outDate = row.transactionDate;
              unitRow.outInvoiceNo = row.invoiceNo;
              unitRow.outInvoiceId = row.invoiceId;
              unitRow.licensePlate = row.licensePlate;
              unitRow.outPrice = outPricePerUnit;
              unitRow.cogsFifo = unitRow.inUnitCost;
              unitRow.profit = outPricePerUnit - unitRow.inUnitCost;
              unitRow.status = 'SOLD';
              inQueue.shift();
            } else {
              const consumed = Math.round(qNeeded * 10000) / 10000;
              unitRow.qty =
                Math.round((unitRow.qty! - consumed) * 10000) / 10000;

              unitRows.push({
                ...unitRow,
                qty: consumed,
                unitIndex: unitIndexCounter++,
                outLedgerId: row.id,
                outDate: row.transactionDate,
                outInvoiceNo: row.invoiceNo,
                outInvoiceId: row.invoiceId,
                licensePlate: row.licensePlate,
                outPrice: outPricePerUnit,
                cogsFifo: unitRow.inUnitCost,
                profit: outPricePerUnit - unitRow.inUnitCost,
                status: 'SOLD',
              });
              qNeeded = 0;
            }
          }
        }
      }
    }

    // Filter out ADJUSTMENT if we don't want them in the regular display?
    // Let's keep them so the unit index is consistent, or maybe remove them.
    // The user wants to see what's in stock and what's sold.
    // We'll keep them but UI can show them as adjusted.
    const validRows = unitRows;

    // Sort by status SOLD first, then chronological (unitIndex ASC)
    validRows.sort((a, b) => {
      if (a.status === 'SOLD' && b.status !== 'SOLD') return -1;
      if (a.status !== 'SOLD' && b.status === 'SOLD') return 1;
      return a.unitIndex - b.unitIndex;
    });

    const total = validRows.length;
    const items = validRows.slice((page - 1) * limit, page * limit);

    return {
      data: items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
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
    const skus = overviewData.data.map((d: any) => d.sku);

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
    const summaryRows = overviewData.data;

    const carCodesStr = VINFAST_CAR_PART_CODES;

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

      let totalOutCogs = 0;
      let balanceValue = 0;

      // Tính Cogs của những đơn đã lọc (để báo cáo) hoặc toàn bộ?
      // Summary sheet thường show toàn bộ lịch sử (stock) nên lấy tất cả COGS
      for (const row of entries) {
        if (row.direction === 'OUT' && row.calculatedCogs) {
          totalOutCogs += row.calculatedCogs;
        }
      }
      for (const q of inQueue) {
        balanceValue += q.qty * q.unitCost;
      }
      const summaryItem = summaryRows.find((s: any) => s.sku === sku);
      if (summaryItem) {
        summaryItem.totalOutCogs = totalOutCogs;
        summaryItem.balanceValue = balanceValue;
        summaryItem.vehicleTypeStr = carCodesStr.includes(sku as any)
          ? 'Ô tô'
          : 'Xe máy';
      }
    }

    onProgress?.(70, totalProgress, 'Đang tạo Excel Workbook...');

    const workbook = new ExcelJS.Workbook();

    // Header format function
    const setupSheetHeader = (sheet: ExcelJS.Worksheet, colCount: number) => {
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).alignment = { horizontal: 'center' };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };
      sheet.views = [
        { state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' },
      ];
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: colCount },
      };
    };

    // --- SHEET 1: TỔNG HỢP ---
    const summarySheet = workbook.addWorksheet('Tổng hợp tồn kho');
    summarySheet.columns = [
      { header: 'Mã phụ tùng', key: 'sku', width: 20 },
      { header: 'Tên phụ tùng', key: 'name', width: 40 },
      { header: 'Loại xe', key: 'vehicleTypeStr', width: 14 },
      { header: 'ĐVT', key: 'uom', width: 12 },
      { header: 'Tổng SL nhập', key: 'qtyIn', width: 15 },
      { header: 'Tổng SL xuất', key: 'qtyOut', width: 15 },
      { header: 'Tồn cuối (SL)', key: 'qtyBalance', width: 15 },
      { header: 'Giá vốn FIFO xuất', key: 'totalOutCogs', width: 20 },
      { header: 'Giá trị tồn cuối FIFO', key: 'balanceValue', width: 20 },
    ];
    setupSheetHeader(summarySheet, 9);

    summaryRows.forEach((row: any) => {
      summarySheet.addRow({
        sku: row.sku,
        name: row.name,
        vehicleTypeStr: row.vehicleTypeStr,
        uom: row.uom,
        qtyIn: parseFloat(row.qtyIn || '0'),
        qtyOut: parseFloat(row.qtyOut || '0'),
        totalOutCogs: row.totalOutCogs || 0,
        qtyBalance: parseFloat(row.qtyBalance || '0'),
        balanceValue: row.balanceValue || 0,
      });
    });

    summarySheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        [
          'qtyIn',
          'qtyOut',
          'totalOutCogs',
          'qtyBalance',
          'balanceValue',
        ].forEach((k) => {
          row.getCell(k).numFmt = '#,##0.00';
        });
      }
    });

    // --- SHEET 2: XUẤT NHẬP TỒN (STOCK LEDGER) ---
    const ledgerSheet = workbook.addWorksheet('Xuất Nhập Tồn');
    ledgerSheet.columns = [
      { key: 'transactionDate', width: 15 },
      { key: 'invoiceNo', width: 15 },
      { key: 'partSku', width: 20 },
      { key: 'partName', width: 40 },
      { key: 'unit', width: 10 },
      { key: 'partnerName', width: 35 },
      { key: 'qtyIn', width: 15 },
      { key: 'unitCostIn', width: 18 },
      { key: 'amountIn', width: 20 },
      { key: 'qtyOut', width: 15 },
      { key: 'unitCostOut', width: 18 },
      { key: 'amountOut', width: 20 },
      { key: 'runningBalanceQty', width: 15 },
      { key: 'runningBalanceValue', width: 20 },
      { key: 'perfQty', width: 15 },
      { key: 'perfUnitCost', width: 18 },
      { key: 'perfTotalCost', width: 20 },
      { key: 'perfSellPrice', width: 18 },
      { key: 'perfTotalRevenue', width: 20 },
      { key: 'perfProfit', width: 20 },
      { key: 'perfMargin', width: 15 },
    ];

    // Double Header
    const row1 = ledgerSheet.addRow([
      'Ngày',
      'Số hóa đơn',
      'Mã phụ tùng',
      'Sản phẩm / Hàng hóa',
      'ĐVT',
      'Đối tác',
      'Nhập kho',
      '',
      '',
      'Xuất kho - FIFO',
      '',
      '',
      'Tồn kho',
      '',
      'Hiệu quả kinh doanh',
      '',
      '',
      '',
      '',
      '',
      '',
    ]);
    const row2 = ledgerSheet.addRow([
      '',
      '',
      '',
      '',
      '',
      '',
      'Số lượng',
      'Đơn giá',
      'Thành tiền',
      'Số lượng',
      'Đơn giá',
      'Thành tiền',
      'Số lượng',
      'Thành tiền',
      'Số lượng',
      'Đơn giá mua',
      'Giá mua',
      'Đơn giá bán',
      'Giá bán',
      'Lợi nhuận',
      '% Lợi nhuận',
    ]);

    // Merging for Header
    ledgerSheet.mergeCells('A1:A2');
    ledgerSheet.mergeCells('B1:B2');
    ledgerSheet.mergeCells('C1:C2');
    ledgerSheet.mergeCells('D1:D2');
    ledgerSheet.mergeCells('E1:E2');
    ledgerSheet.mergeCells('F1:F2');
    ledgerSheet.mergeCells('G1:I1');
    ledgerSheet.mergeCells('J1:L1');
    ledgerSheet.mergeCells('M1:N1');
    ledgerSheet.mergeCells('O1:U1');

    // Header styling
    [row1, row2].forEach((r) => {
      r.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      r.alignment = { horizontal: 'center', vertical: 'middle' };
      r.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF002B5E' },
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
          left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
          bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
          right: { style: 'thin', color: { argb: 'FFFFFFFF' } },
        };
      });
    });

    // Freeze pane
    ledgerSheet.views = [
      { state: 'frozen', xSplit: 0, ySplit: 2, activeCell: 'A3' },
    ];

    for (const section of ledgerSections) {
      if (
        section.rows.length === 0 &&
        section.openingBalanceQty === 0 &&
        section.closingBalanceQty === 0
      )
        continue;

      // Opening balance row
      if (dateFrom) {
        const obRow = ledgerSheet.addRow({
          transactionDate: 'Tồn đầu kỳ',
          partSku: section.sku,
          partName: section.partName,
          unit: section.unit,
          runningBalanceQty: section.openingBalanceQty,
          runningBalanceValue: section.openingBalanceValue,
        });
        obRow.font = { italic: true, bold: true };
        obRow.getCell('runningBalanceQty').numFmt = '#,##0.00';
        obRow.getCell('runningBalanceValue').numFmt = '#,##0';
      }

      // Ledger entries
      for (const row of section.rows) {
        const isOut = row.direction === 'OUT';
        const partnerName = isOut ? row.buyerName : row.sellerName;
        const isAdjNegative = row.isAdjustment && row.adjSign === -1;
        const rawQty = parseFloat(row.qty || '0');
        const displayQty = isAdjNegative ? -rawQty : rawQty;
        const unitCost = isOut
          ? parseFloat(row.calculatedUnitCost || '0')
          : parseFloat(row.unitCost || '0');
        const amount = isOut
          ? parseFloat(row.calculatedCogs || '0')
          : parseFloat(row.preVatAmount || '0');

        let perfQty: any = '';
        let perfUnitCost: any = '';
        let perfTotalCost: any = '';
        let perfSellPrice: any = '';
        let perfTotalRevenue: any = '';
        let perfProfit: any = '';
        let perfMargin: any = '';

        if (isOut) {
          const sellAmount = parseFloat(row.preVatAmount || '0');
          const sellPrice = rawQty !== 0 ? sellAmount / rawQty : 0;
          const profit = sellAmount - amount;
          const marginPct = sellAmount > 0 ? profit / sellAmount : 0;

          perfQty = displayQty;
          perfUnitCost = unitCost;
          perfTotalCost = amount;
          perfSellPrice = sellPrice;
          perfTotalRevenue = sellAmount;
          perfProfit = profit;
          perfMargin = marginPct;
        }

        const entryRow = ledgerSheet.addRow({
          transactionDate: row.transactionDate,
          invoiceNo: row.invoiceNo,
          partSku: row.partSku,
          partName: row.partName,
          unit: row.unit,
          partnerName,
          qtyIn: isOut ? '' : displayQty,
          unitCostIn: isOut ? '' : unitCost,
          amountIn: isOut ? '' : isAdjNegative ? -amount : amount,
          qtyOut: isOut ? displayQty : '',
          unitCostOut: isOut ? unitCost : '',
          amountOut: isOut ? amount : '',
          runningBalanceQty: row.runningBalanceQty,
          runningBalanceValue: row.runningBalanceValue,
          perfQty,
          perfUnitCost,
          perfTotalCost,
          perfSellPrice,
          perfTotalRevenue,
          perfProfit,
          perfMargin,
        });

        // formatting numbers
        [
          'unitCostIn',
          'amountIn',
          'unitCostOut',
          'amountOut',
          'runningBalanceValue',
          'perfUnitCost',
          'perfTotalCost',
          'perfSellPrice',
          'perfTotalRevenue',
          'perfProfit',
        ].forEach((k) => {
          entryRow.getCell(k).numFmt = '#,##0.00';
        });
        ['qtyIn', 'qtyOut', 'runningBalanceQty', 'perfQty'].forEach((k) => {
          entryRow.getCell(k).numFmt = '#,##0.00';
        });
        if (isOut) {
          entryRow.getCell('perfMargin').numFmt = '0.0%';
        }
      }
    }

    onProgress?.(95, totalProgress, 'Đang lưu file...');

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.isBuffer(buffer)
      ? buffer
      : Buffer.from(buffer as ArrayBuffer);
  }
}
