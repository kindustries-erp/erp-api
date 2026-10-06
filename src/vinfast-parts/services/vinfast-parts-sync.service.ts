import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VinfastPartsCatalog } from '../entities/vinfast-parts-catalog.entity';
import { VinfastPartsLedger } from '../entities/vinfast-parts-ledger.entity';
import { ErpInvoiceItem } from '../../erp-invoices-core/entities/erp_invoice_item.entity';
import { extractVinfastItemCode } from '../../erp-invoices-core/helpers/vinfast-part-code.helper';

@Injectable()
export class VinfastPartsSyncService {
  private readonly logger = new Logger(VinfastPartsSyncService.name);

  public readonly VINFAST_SELLER_TAX_CODES = [
    '0108926276',
    '0318334886',
    '0202357718',
  ];

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
   */
  public resolveVinfastSku(
    itemCode: string | null | undefined,
    description: string | null | undefined,
  ): string | null {
    // 1. Kiểm tra nếu description hoặc itemCode match quy tắc phụ tùng VinFast
    const extractedFromDesc = extractVinfastItemCode(description);
    if (extractedFromDesc) return extractedFromDesc;

    const extractedFromCode = extractVinfastItemCode(itemCode);
    if (extractedFromCode) return extractedFromCode;

    // 2. Quy tắc ngoại lệ Pin cao áp
    const norm = (description || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_');
    if (norm.includes('VF5_HV_BATTERY_PACK_38_KWH')) return 'VF-EEP73110011AP';
    if (
      norm.includes('HV_BATTERY_41_9KWH') ||
      norm.includes('HV_BATTERY_41_9_KWH') ||
      norm.includes('BAT21001011')
    ) {
      return 'VF-BAT21001011';
    }
    if (norm.includes('HV_BATTERY_PACK')) return 'VF-EEP73110011ALL';

    // 3. Fallback regex trích xuất mã VinFast dạng [A-Z]{3}[0-9]...
    const upperDesc = (description || '').toUpperCase();
    const match = upperDesc.match(/([A-Z]{3}[0-9][A-Z0-9]*)/);
    if (match && match[1]) {
      return match[1].startsWith('VF-') ? match[1] : `VF-${match[1]}`;
    }

    if (itemCode) {
      const upperCode = itemCode.trim().toUpperCase();
      if (upperCode.startsWith('VF-')) return upperCode;
      if (/^[A-Z]{3}[0-9]/.test(upperCode)) return `VF-${upperCode}`;
      return `VF-${upperCode}`;
    }

    return null;
  }

  async syncCatalog(options?: {
    dateFrom?: string;
    dateTo?: string;
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
      .andWhere('i.sellerTaxCode IN (:...taxCodes)', {
        taxCodes: this.VINFAST_SELLER_TAX_CODES,
      })
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

        // Check if service
        const isService = [
          'EEH',
          'EMT',
          'LFP',
          'VF-EEH',
          'VF-EMT',
          'VF-LFP',
        ].some(
          (prefix) => sku.startsWith(prefix) || bareSku.startsWith(prefix),
        );

        const newItem = this.catalogRepo.create({
          sku: sku.slice(0, 32),
          name: name.slice(0, 255),
          uom: normalizedUom.slice(0, 32),
          isService,
        });

        await this.catalogRepo.save(newItem);
        addedCount++;
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
    progress$?: any;
  }) {
    this.logger.log('Starting VinFast Parts Ledger sync...');

    const qb = this.invoiceItemRepo
      .createQueryBuilder('ii')
      .innerJoinAndSelect('ii.invoice', 'i')
      .where('ii.itemCode IS NOT NULL')
      .andWhere(
        '( (i.direction = :inDir AND i.sellerTaxCode IN (:...taxCodes)) OR i.direction = :outDir )',
        {
          inDir: 'IN',
          outDir: 'OUT',
          taxCodes: this.VINFAST_SELLER_TAX_CODES,
        },
      );

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

      const sku = this.resolveVinfastSku(ii.itemCode, ii.description);
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

      // Canceled Invoice -> Delete if exists, otherwise skip
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

      if (Number(i.invoiceType) === 2 || status === 3 || status === 5) {
        isAdjustment = true;
        if (qty < 0 || preVatAmount < 0) {
          adjSign = -1;
          qty = Math.abs(qty);
          preVatAmount = Math.abs(preVatAmount);
          if (unitCost !== null) unitCost = Math.abs(unitCost);
        }
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
        Object.assign(existing, ledgerData);
        await this.ledgerRepo.save(existing);
        updatedCount++;
      } else {
        await this.ledgerRepo.save(this.ledgerRepo.create(ledgerData));
        addedCount++;
      }
    }

    this.logger.log(
      `Ledger sync completed. Processed: ${processedCount}, Added: ${addedCount}, Updated: ${updatedCount}, Deleted: ${deletedCount}, Skipped: ${skippedCount}`,
    );

    if (options?.progress$) {
      options.progress$.next({
        processId: 'vinfast-sync',
        type: 'ledger',
        total: invoiceItems.length,
        current: invoiceItems.length,
        message: `Hoàn tất Sổ cái (Ledger): Thêm mới ${addedCount}, Cập nhật ${updatedCount}, Xóa ${deletedCount}, Bỏ qua ${skippedCount}.`,
        completed: true,
      });
    }

    return {
      totalProcessed: processedCount,
      addedCount,
      updatedCount,
      deletedCount,
      skippedCount,
    };
  }
}
