import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  UpdateEvent,
} from 'typeorm';
import { ErpInvoiceItem } from '../entities/erp_invoice_item.entity';

@EventSubscriber()
export class ErpInvoiceItemSubscriber implements EntitySubscriberInterface<ErpInvoiceItem> {
  listenTo() {
    return ErpInvoiceItem;
  }

  private extractItemCode(description: string | null): string | null {
    if (!description) return null;

    // Hardcode mappings for specific known items that don't follow standard format
    // or are missing the code in the description.
    const upperDesc = description.toUpperCase();
    if (
      upperDesc.includes('HV_BATTERY_41.9KWH') ||
      upperDesc.includes('HV BATTERY 41.9KWH')
    ) {
      return 'BAT21001011';
    }
    if (
      upperDesc.includes('VF5_HV_BATTERY_PACK_38_KWH') ||
      upperDesc.includes('VF5 HV BATTERY PACK 38 KWH')
    ) {
      return 'EEP73110011AP';
    }
    if (upperDesc.includes('ĐỘNG CƠ ĐIỆN') && upperDesc.includes('BẢO HÀNH')) {
      return 'PVT20030000';
    }

    // Standard VinFast part code format: 3 uppercase letters, 8 digits, optional 1-2 alphanumeric
    // Example: BAT21001011, FLU20050001
    const regex = /^([A-Z]{3}[0-9]{8}[A-Z0-9]{0,2})(?:[\s-]|$)/i;
    const match = description.match(regex);

    if (match && match[1]) {
      return match[1].toUpperCase();
    }

    return null;
  }

  beforeInsert(event: InsertEvent<ErpInvoiceItem>) {
    if (event.entity && event.entity.description && !event.entity.itemCode) {
      event.entity.itemCode = this.extractItemCode(event.entity.description);
    }
  }

  beforeUpdate(event: UpdateEvent<ErpInvoiceItem>) {
    if (!event.entity) return;
    if (
      event.entity.description !== undefined &&
      event.entity.description !== event.databaseEntity?.description
    ) {
      // Re-extract if description changed
      const extractedCode = this.extractItemCode(event.entity.description);
      if (extractedCode) {
        event.entity.itemCode = extractedCode;
      }
    }
  }
}
