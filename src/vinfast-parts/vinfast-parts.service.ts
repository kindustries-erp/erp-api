import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
import { VinfastPartsCatalog } from './entities/vinfast-parts-catalog.entity';
import { VinfastPartsLedger } from './entities/vinfast-parts-ledger.entity';
import { ErpInvoiceItem } from '../erp-invoices-core/entities/erp_invoice_item.entity';
import { ErpInvoice } from '../erp-invoices-core/entities/erp_invoice.entity';

@Injectable()
export class VinfastPartsService {
  private readonly logger = new Logger(VinfastPartsService.name);

  constructor(
    @InjectRepository(VinfastPartsCatalog)
    private catalogRepo: Repository<VinfastPartsCatalog>,
    @InjectRepository(VinfastPartsLedger)
    private ledgerRepo: Repository<VinfastPartsLedger>,
    @InjectRepository(ErpInvoiceItem)
    private invoiceItemRepo: Repository<ErpInvoiceItem>,
  ) {}

  async syncCatalog() {
    this.logger.log('Starting VinFast Parts Catalog sync...');

    // 1. Get all distinct purchased items with parsed code
    const rawItems = await this.invoiceItemRepo
      .createQueryBuilder('ii')
      .innerJoin('ii.invoice', 'i')
      .select('ii.itemCode', 'sku')
      .addSelect('MAX(ii.description)', 'raw_description')
      .addSelect('MAX(ii.unit)', 'uom')
      .where('ii.itemCode IS NOT NULL')
      .andWhere('i.direction = :direction', { direction: 'IN' })
      .andWhere('i.taxInvoiceStatus != :status', { status: 6 })
      .groupBy('ii.itemCode')
      .getRawMany();

    this.logger.log(`Found ${rawItems.length} unique purchased items to sync.`);

    let addedCount = 0;

    // Process items in chunks
    for (const item of rawItems) {
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
    return {
      addedCount,
      totalProcessed: rawItems.length + warrantyItems.length,
    };
  }

  async syncLedger() {
    this.logger.log('Starting VinFast Parts Ledger sync...');

    // We process ALL items that have itemCode mapped to our catalog
    const invoiceItems = await this.invoiceItemRepo.find({
      where: { itemCode: Not(IsNull()) },
      relations: ['invoice'],
    });

    let processedCount = 0;
    let addedCount = 0;
    let skippedCount = 0;

    for (const ii of invoiceItems) {
      const i = ii.invoice;
      if (!i) continue;

      const sku = ii.itemCode;
      if (!sku) continue;

      processedCount++;

      // Make sure the SKU exists in catalog
      const catalogItem = await this.catalogRepo.findOne({ where: { sku } });
      if (!catalogItem) {
        // We only ledger items that exist in our catalog (skip raw unmapped)
        skippedCount++;
        continue;
      }

      // If the catalog item is a service, skip ledger tracking (no physical inventory)
      if (catalogItem.isService) {
        skippedCount++;
        continue;
      }

      // Check if already in ledger
      const existing = await this.ledgerRepo.findOne({
        where: { invoiceItemId: ii.id },
      });

      if (existing) {
        skippedCount++;
        continue;
      }

      // Apply Business Rules
      const status = i.taxInvoiceStatus;

      // 1. Canceled Invoice -> Skip
      if (status === 6) {
        skippedCount++;
        continue;
      }

      // 2. Fully Canceled Invoice -> Skip (wait, detecting fully canceled requires fetching all adjustment invoices.
      // For now we will rely on the adjustment sign)

      let qty = Number(ii.quantity) || 1;
      let preVatAmount = Number(ii.preVatAmount) || 0;
      let unitCost = Number(ii.unitPrice) || null;
      let isAdjustment = false;
      let adjSign = 1;

      if (status === 3) {
        isAdjustment = true;
        // Logic from ReportsCoreService: Dấu - nghĩa là điều chỉnh giảm, + là điều chỉnh tăng
        // Check amount
        if (preVatAmount < 0) {
          adjSign = -1;
        } else if (preVatAmount > 0) {
          adjSign = 1;
        }

        // Qty logic for adjustment
        if (qty === 1 && Math.abs(preVatAmount) > 0) {
          // If qty=1 but amount changed, usually means it's a price-only adjustment.
          // We set qty to 0 in ledger so it doesn't affect inventory count.
          qty = 0;
        } else if (qty < 0) {
          adjSign = -1;
        }

        // Take absolute value since adjSign handles the direction of adjustment
        qty = Math.abs(qty);
        preVatAmount = Math.abs(preVatAmount);
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
      `Ledger sync completed. Processed: ${processedCount}, Added: ${addedCount}, Skipped: ${skippedCount}`,
    );
    return { processedCount, addedCount, skippedCount };
  }
}
