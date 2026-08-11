import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
import { VinfastPartsCatalog } from './entities/vinfast-parts-catalog.entity';
import { VinfastPartsLedger } from './entities/vinfast-parts-ledger.entity';
import { ErpInvoiceItem } from '../erp-invoices-core/entities/erp_invoice_item.entity';
import { ErpInvoice } from '../erp-invoices-core/entities/erp_invoice.entity';

import { Subject } from 'rxjs';
import { VINFAST_CAR_PART_CODES } from '../reports-core/vinfast-car-part-codes';

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

    let vehicleTypeFilter = '';
    if (vehicleType === 'oto') {
      vehicleTypeFilter = `AND c.sku IN (${carCodesStr})`;
    } else if (vehicleType === 'xemay') {
      vehicleTypeFilter = `AND c.sku NOT IN (${carCodesStr})`;
    }

    const params: any[] = [];
    let paramIndex = 1;

    let searchFilter = '';
    if (search) {
      searchFilter += ` AND (c.sku ILIKE $${paramIndex} OR c.name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    let cSearchFilter = '';
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
          }
        }
      } catch (e) {}
    }

    let cFiltersSql = '';
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
          } else if (col === 'vehicleType') {
            // vehicleType filtering from frontend (if it passes 'CAR' or 'MOTORBIKE')
            const isCar = arr.includes('CAR');
            const isMoto = arr.includes('MOTORBIKE');
            if (isCar && !isMoto) {
              cFiltersSql += ` AND c.sku IN (${carCodesStr})`;
            } else if (!isCar && isMoto) {
              cFiltersSql += ` AND c.sku NOT IN (${carCodesStr})`;
            }
          }
        }
      } catch (e) {}
    }

    let orderSql = 'ORDER BY "qtyBalance" DESC, c.sku ASC';
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
            if (col === 'sku') sqlCol = 'c.sku';
            else if (col === 'name') sqlCol = 'c.name';
            else if (col === 'uom') sqlCol = 'c.uom';
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
      if (sortBy === 'sku') sqlCol = 'c.sku';
      else if (sortBy === 'name') sqlCol = 'c.name';
      else if (sortBy === 'uom') sqlCol = 'c.uom';
      else if (sortBy === 'qtyIn') sqlCol = '"qtyIn"';
      else if (sortBy === 'qtyOut') sqlCol = '"qtyOut"';
      else if (sortBy === 'qtyBalance') sqlCol = '"qtyBalance"';

      const dir = sortDir === 'asc' ? 'ASC' : 'DESC';
      if (sqlCol) orderSql = `ORDER BY ${sqlCol} ${dir} NULLS LAST`;
    }

    const whereClause = `WHERE c.is_service = false ${vehicleTypeFilter} ${searchFilter} ${cSearchFilter} ${cFiltersSql}`;

    const query = `
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
    `;

    const countQuery = `
      SELECT COUNT(DISTINCT c.sku) as total
      FROM vinfast_parts_catalog c
      ${whereClause}
    `;

    const finalQuery = `
      ${query}
      ${orderSql}
      LIMIT ${limit} OFFSET ${(page - 1) * limit}
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
  ) {
    const carCodesStr = VINFAST_CAR_PART_CODES.map((c) => `'${c}'`).join(',');
    const params: any[] = [];
    let paramIndex = 1;

    let filterSql = '';
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
              filterSql += ` AND c.sku IN (${carCodesStr})`;
            } else if (!isCar && isMoto) {
              filterSql += ` AND c.sku NOT IN (${carCodesStr})`;
            }
          } else if (col !== columnKey) {
            if (col === 'sku') {
              filterSql += ` AND c.sku = ANY($${paramIndex})`;
              params.push(arr);
              paramIndex++;
            } else if (col === 'name') {
              filterSql += ` AND c.name = ANY($${paramIndex})`;
              params.push(arr);
              paramIndex++;
            }
          }
        }
      } catch (e) {}
    }

    let searchSql = '';
    if (search) {
      if (columnKey === 'sku') {
        searchSql = ` AND c.sku ILIKE $${paramIndex}`;
        params.push(`%${search}%`);
        paramIndex++;
      } else if (columnKey === 'name') {
        searchSql = ` AND c.name ILIKE $${paramIndex}`;
        params.push(`%${search}%`);
        paramIndex++;
      }
    }

    let selectCol = 'c.sku';
    if (columnKey === 'name') selectCol = 'c.name';
    else if (columnKey === 'sku') selectCol = 'c.sku';

    const query = `
      SELECT DISTINCT ${selectCol} as value
      FROM vinfast_parts_catalog c
      WHERE c.is_service = false ${filterSql} ${searchSql}
      ORDER BY value ASC
      LIMIT ${limit} OFFSET ${(page - 1) * limit}
    `;

    const countQuery = `
      SELECT COUNT(DISTINCT ${selectCol}) as total
      FROM vinfast_parts_catalog c
      WHERE c.is_service = false ${filterSql} ${searchSql}
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
}
