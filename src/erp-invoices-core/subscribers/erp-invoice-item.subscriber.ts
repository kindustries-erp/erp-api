import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  UpdateEvent,
} from 'typeorm';
import { ErpInvoiceItem } from '../entities/erp_invoice_item.entity';
import { extractVinfastItemCode } from '../helpers/vinfast-part-code.helper';

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
      event.entity.itemCode = extractVinfastItemCode(event.entity.description);
    }
  }

  beforeUpdate(event: UpdateEvent<ErpInvoiceItem>) {
    if (!event.entity) return;
    if (
      event.entity.description !== undefined &&
      event.entity.description !== event.databaseEntity?.description
    ) {
      // Re-extract if description changed
      const extractedCode = extractVinfastItemCode(event.entity.description);
      if (extractedCode) {
        event.entity.itemCode = extractedCode;
      }
    }
  }
}
