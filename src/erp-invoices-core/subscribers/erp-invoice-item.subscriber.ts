import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  UpdateEvent,
} from 'typeorm';
import { ErpInvoiceItem } from '../entities/erp_invoice_item.entity';
import { extractStandardItemCode } from '../helpers/vinfast-part-code.helper';

@EventSubscriber()
export class ErpInvoiceItemSubscriber implements EntitySubscriberInterface<ErpInvoiceItem> {
  constructor(dataSource: DataSource) {
    dataSource.subscribers.push(this);
  }

  listenTo() {
    return ErpInvoiceItem;
  }

  beforeInsert(event: InsertEvent<ErpInvoiceItem>) {
    if (event.entity && event.entity.description && !event.entity.itemCode) {
      const resolved = extractStandardItemCode({
        description: event.entity.description,
        itemCode: event.entity.itemCode,
        unit: event.entity.unit,
        discountAmount: event.entity.discountAmount
          ? Number(event.entity.discountAmount)
          : null,
        preVatAmount: event.entity.preVatAmount
          ? Number(event.entity.preVatAmount)
          : null,
      });
      if (resolved.itemCode) {
        event.entity.itemCode = resolved.itemCode;
      }
    }
  }

  beforeUpdate(event: UpdateEvent<ErpInvoiceItem>) {
    if (!event.entity) return;
    if (
      event.entity.description !== undefined &&
      event.entity.description !== event.databaseEntity?.description
    ) {
      // Re-extract if description changed
      const resolved = extractStandardItemCode({
        description: event.entity.description,
        itemCode: event.entity.itemCode,
        unit: event.entity.unit,
        discountAmount: event.entity.discountAmount
          ? Number(event.entity.discountAmount)
          : null,
        preVatAmount: event.entity.preVatAmount
          ? Number(event.entity.preVatAmount)
          : null,
      });
      if (resolved.itemCode) {
        event.entity.itemCode = resolved.itemCode;
      }
    }
  }
}
