import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { VinfastPartsCatalog } from '../entities/vinfast-parts-catalog.entity';
import { VinfastPartsLedger } from '../entities/vinfast-parts-ledger.entity';
import { ErpInvoiceItem } from '../../erp-invoices-core/entities/erp_invoice_item.entity';
import {
  extractVinfastItemCode,
  GREENWAY_AUTOMOTIVES_TAX_CODE,
} from '../../erp-invoices-core/helpers/vinfast-part-code.helper';
import {
  isVinfastServicePrefix,
  resolveAdjustmentLedgerQty,
} from '../helpers/vinfast-ledger-rules.helper';

@Injectable()
export class VinfastPartsSyncService {
  private readonly logger = new Logger(VinfastPartsSyncService.name);

  constructor(
    @InjectRepository(VinfastPartsCatalog)
    private readonly catalogRepo: Repository<VinfastPartsCatalog>,
    @InjectRepository(VinfastPartsLedger)
    private readonly ledgerRepo: Repository<VinfastPartsLedger>,
    @InjectRepository(ErpInvoiceItem)
    private readonly invoiceItemRepo: Repository<ErpInvoiceItem>,
  ) {}

  /**
   * Bóc tách và chuẩn hóa mã phụ tùng VinFast luôn có tiền tố VF-<PART_NO>.
   * Chỉ nhận mã khớp mẫu VinFast (diễn giải trước, mã hàng sau). Không đoán mã từ chuỗi bất kỳ,
   * tránh biến băng dính, xăng... thành SKU rác.
   */
  public resolveVinfastSku(
    itemCode: string | null | undefined,
    description: string | null | undefined,
  ): string | null {
    // Mã hàng hóa trên dòng hóa đơn đã là mã chuẩn (theo quy tắc gán mã của hóa đơn):
    // chỉ mã VF- là phụ tùng. Mã DV-/PT-/VT-/CK- không vào sổ cái phụ tùng.
    const code = (itemCode ?? '').trim().toUpperCase();
    if (code) return code.startsWith('VF-') ? code : null;
    return extractVinfastItemCode(description);
  }

  async syncCatalog(options?: {
    dateFrom?: string;
    dateTo?: string;
    invoiceIds?: string[];
    progress$?: any;
    clearDb?: boolean;
  }) {
    this.logger.log('Starting VinFast Parts Catalog sync...');
    if (options?.clearDb) {
      this.logger.log('Clearing old VinFast ledger and catalog before sync...');
      await this.ledgerRepo.delete({});
      await this.catalogRepo.delete({});
      if (options.progress$) {
        options.progress$.next({
          processId: 'vinfast-sync',
          type: 'clear',
          total: 0,
          current: 0,
          message: 'Đã xóa sạch dữ liệu Danh mục và Sổ cái cũ.',
          completed: false,
        });
      }
    }

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
      .andWhere('i.taxInvoiceStatus != :status', { status: 6 })
      .andWhere(
        '(UPPER(i.sellerName) LIKE :vinfastName OR i.sellerTaxCode LIKE :greenwayTaxCode)',
        {
          vinfastName: '%VINFAST%',
          greenwayTaxCode: `${GREENWAY_AUTOMOTIVES_TAX_CODE}%`,
        },
      );

    if (options?.dateFrom && options?.dateTo) {
      qb.andWhere('i.invoiceDate >= :dateFrom AND i.invoiceDate <= :dateTo', {
        dateFrom: options.dateFrom,
        dateTo: options.dateTo,
      });
    }
    if (options?.invoiceIds?.length) {
      qb.andWhere('i.id IN (:...invoiceIds)', {
        invoiceIds: options.invoiceIds,
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

    for (const item of rawItems) {
      let { sku, raw_description, uom } = item;
      sku = this.resolveVinfastSku(sku, raw_description);
      if (!sku) continue;

      const existing = await this.catalogRepo.findOne({ where: { sku } });
      if (!existing) {
        // Extract name by removing the code from the beginning
        const bareSku = sku.replace(/^VF-/, '');
        const nameRegex = new RegExp(`^(?:VF-)?${bareSku}\\s*[-–]?\\s*(.*)$`);
        const match = (raw_description || '').match(nameRegex);
        const name =
          match && match[1] ? match[1].trim() : (raw_description || sku).trim();

        // Normalize UOM
        let normalizedUom = uom || 'Chiếc';
        if (normalizedUom.toUpperCase() === 'CHIẾC') normalizedUom = 'Chiếc';
        if (normalizedUom.toUpperCase() === 'CÁI') normalizedUom = 'Cái';

        const newItem = this.catalogRepo.create({
          sku: sku.slice(0, 32),
          name: name.slice(0, 255),
          uom: normalizedUom.slice(0, 32),
          isService: isVinfastServicePrefix(sku),
        });

        await this.catalogRepo.save(newItem);
        addedCount++;
      } else if (!existing.isService && isVinfastServicePrefix(sku)) {
        // Mã dịch vụ đã nạp trước đó với cờ sai (hóa đơn bán lọt vào danh mục)
        existing.isService = true;
        await this.catalogRepo.save(existing);
      }
    }

    // Add specific warranty items that might not have IN invoices
    const warrantyItems = [
      { sku: 'VF-BAT21001011', name: 'HV BATTERY 41.9KWH', isService: false },
      {
        sku: 'VF-PVT20030000',
        name: 'Động cơ điện (Bảo hành)',
        isService: false,
      },
      { sku: 'VF-BEX69063002AB', name: 'ĐÈN HẬU PHẢI', isService: false },
    ];

    for (const wItem of warrantyItems) {
      const existing = await this.catalogRepo.findOne({
        where: { sku: wItem.sku },
      });
      if (!existing) {
        await this.catalogRepo.save(
          this.catalogRepo.create({
            sku: wItem.sku.slice(0, 32),
            name: wItem.name.slice(0, 255),
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
    invoiceIds?: string[];
    progress$?: any;
  }) {
    this.logger.log('Starting VinFast Parts Ledger sync...');

    const qb = this.invoiceItemRepo
      .createQueryBuilder('ii')
      .innerJoin('ii.invoice', 'i')
      .select([
        'ii.id',
        'ii.itemCode',
        'ii.description',
        'ii.unit',
        'ii.quantity',
        'ii.unitPrice',
        'ii.preVatAmount',
        'i.id',
        'i.direction',
        'i.invoiceType',
        'i.taxInvoiceStatus',
        'i.invoiceDate',
        'i.licensePlate',
      ])
      .where('ii.itemCode IS NOT NULL')
      .andWhere(
        '(i.direction = :outDir OR (i.direction = :inDir AND (UPPER(i.sellerName) LIKE :vinfastName OR i.sellerTaxCode LIKE :greenwayTaxCode)))',
        {
          inDir: 'IN',
          outDir: 'OUT',
          vinfastName: '%VINFAST%',
          greenwayTaxCode: `${GREENWAY_AUTOMOTIVES_TAX_CODE}%`,
        },
      );

    if (options?.dateFrom && options?.dateTo) {
      qb.andWhere('i.invoiceDate >= :dateFrom AND i.invoiceDate <= :dateTo', {
        dateFrom: options.dateFrom,
        dateTo: options.dateTo,
      });
    }
    if (options?.invoiceIds?.length) {
      qb.andWhere('i.id IN (:...invoiceIds)', {
        invoiceIds: options.invoiceIds,
      });
    }

    const invoiceItems = await qb.getMany();
    const total = invoiceItems.length;

    // Nạp trước theo lô: danh mục và sổ cái hiện có, không truy vấn từng dòng
    const catalogBySku = new Map<string, { isService: boolean }>(
      (await this.catalogRepo.find()).map((c) => [c.sku, c]),
    );
    const existingByItem = new Map<string, VinfastPartsLedger>();
    const itemIds = invoiceItems.map((ii) => ii.id);
    for (let k = 0; k < itemIds.length; k += LEDGER_LOOKUP_BATCH) {
      const rows = await this.ledgerRepo.find({
        where: { invoiceItemId: In(itemIds.slice(k, k + LEDGER_LOOKUP_BATCH)) },
      });
      rows.forEach((r) => existingByItem.set(r.invoiceItemId, r));
    }

    let processedCount = 0;
    let addedCount = 0;
    let skippedCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;
    let deletedCount = 0;

    for (let idx = 0; idx < total; idx++) {
      const ii = invoiceItems[idx];
      if (options?.progress$ && (idx + 1) % PROGRESS_EVERY === 0) {
        options.progress$.next({
          processId: 'vinfast-sync',
          type: 'ledger',
          total,
          current: idx + 1,
          message: `Đang xử lý Sổ cái: ${idx + 1}/${total} dòng...`,
          completed: false,
        });
      }

      const i = ii.invoice;
      if (!i) continue;
      const existing = existingByItem.get(ii.id);

      const sku = this.resolveVinfastSku(ii.itemCode, ii.description);
      if (!sku) {
        // Dòng không còn là phụ tùng: gỡ dòng sổ cái cũ (nếu có) để tồn khớp mã hóa đơn
        if (existing) {
          await this.ledgerRepo.remove(existing);
          existingByItem.delete(ii.id);
          deletedCount++;
        }
        continue;
      }

      processedCount++;

      const catalogItem = catalogBySku.get(sku);
      if (!catalogItem || catalogItem.isService) {
        skippedCount++;
        continue;
      }

      const status = i.taxInvoiceStatus;

      // Canceled Invoice -> Delete if exists, otherwise skip
      if (status === 6) {
        if (existing) {
          await this.ledgerRepo.remove(existing);
          existingByItem.delete(ii.id);
          deletedCount++;
        } else {
          skippedCount++;
        }
        continue;
      }

      let preVatAmount = Number(ii.preVatAmount) || 0;
      let unitCost = Number(ii.unitPrice) || null;

      const isAdjustment =
        Number(i.invoiceType) === 2 || status === 3 || status === 5;
      let qty: number;
      let adjSign: 1 | -1 = 1;

      if (isAdjustment) {
        // Điều chỉnh: số lượng quyết định bởi resolveAdjustmentLedgerQty (không dùng `|| 1`)
        ({ qty, adjSign } = resolveAdjustmentLedgerQty({
          quantity: ii.quantity,
          description: ii.description,
        }));
        preVatAmount = Math.abs(preVatAmount);
        if (unitCost !== null) unitCost = Math.abs(unitCost);
      } else {
        qty = Number(ii.quantity) || 1;
      }

      if (unitCost === null && qty !== 0) {
        unitCost = preVatAmount / qty;
      }

      let licensePlate: string | null = i.licensePlate || null;
      let settlementOrder: string | null = null;

      if (i.direction === 'OUT') {
        const desc = ii.description || '';
        const lpMatch = desc.match(/([0-9]{2}[A-Z][0-9]{4,6})/);
        if (lpMatch && lpMatch[1]) {
          licensePlate = lpMatch[1];
        }
        const roMatch = desc.match(/(RO\s*[0-9]+|BG\s*GR-PDV[0-9-]+)/i);
        if (roMatch && roMatch[1]) {
          settlementOrder = roMatch[1];
        }
      }

      const ledgerData = {
        partSku: sku.slice(0, 32),
        invoiceItemId: ii.id,
        invoiceId: i.id,
        direction: i.direction as 'IN' | 'OUT',
        qty,
        unitCost,
        preVatAmount,
        transactionDate: i.invoiceDate,
        licensePlate: licensePlate ? licensePlate.slice(0, 32) : null,
        settlementOrder: settlementOrder ? settlementOrder.slice(0, 64) : null,
        isAdjustment,
        adjSign,
      };

      if (existing) {
        if (isSameLedgerData(existing, ledgerData)) {
          unchangedCount++;
          continue;
        }
        Object.assign(existing, ledgerData);
        await this.ledgerRepo.save(existing);
        updatedCount++;
      } else {
        const created = await this.ledgerRepo.save(
          this.ledgerRepo.create(ledgerData),
        );
        existingByItem.set(ii.id, created);
        addedCount++;
      }
    }

    this.logger.log(
      `Ledger sync completed. Processed: ${processedCount}, Added: ${addedCount}, Updated: ${updatedCount}, Unchanged: ${unchangedCount}, Deleted: ${deletedCount}, Skipped: ${skippedCount}`,
    );

    if (options?.progress$) {
      options.progress$.next({
        processId: 'vinfast-sync',
        type: 'ledger',
        total,
        current: total,
        message: `Hoàn tất Sổ cái (Ledger): Thêm mới ${addedCount}, Cập nhật ${updatedCount}, Không đổi ${unchangedCount}, Xóa ${deletedCount}, Bỏ qua ${skippedCount}.`,
        completed: true,
      });
    }

    return {
      totalProcessed: processedCount,
      addedCount,
      updatedCount,
      unchangedCount,
      deletedCount,
      skippedCount,
    };
  }
}

const LEDGER_LOOKUP_BATCH = 1000;
const PROGRESS_EVERY = 200;

function sameNumber(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return a == null && b == null;
  return Math.abs(Number(a) - Number(b)) < 0.0001;
}

function sameDate(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return a == null && b == null;
  return new Date(a as any).getTime() === new Date(b as any).getTime();
}

/** So sánh các trường nghiệp vụ của dòng sổ cái để bỏ qua ghi lại khi không đổi. */
function isSameLedgerData(
  existing: VinfastPartsLedger,
  data: {
    partSku: string;
    invoiceId: string;
    direction: string;
    qty: number;
    unitCost: number | null;
    preVatAmount: number;
    transactionDate: Date | string;
    licensePlate: string | null;
    settlementOrder: string | null;
    isAdjustment: boolean;
    adjSign: number;
  },
): boolean {
  return (
    existing.partSku === data.partSku &&
    existing.invoiceId === data.invoiceId &&
    existing.direction === data.direction &&
    sameNumber(existing.qty, data.qty) &&
    sameNumber(existing.unitCost, data.unitCost) &&
    sameNumber(existing.preVatAmount, data.preVatAmount) &&
    sameDate(existing.transactionDate, data.transactionDate) &&
    (existing.licensePlate ?? null) === data.licensePlate &&
    (existing.settlementOrder ?? null) === data.settlementOrder &&
    existing.isAdjustment === data.isAdjustment &&
    sameNumber(existing.adjSign, data.adjSign)
  );
}
